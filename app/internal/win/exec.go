//go:build windows

package win

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"

	"fpsboost.ir/app/internal/engine"
)

// Run executes a command with no console window and a timeout.
func Run(timeout time.Duration, cmd string, args ...string) engine.RunResult {
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	c := exec.CommandContext(ctx, cmd, args...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: CREATE_NO_WINDOW}
	var out, errb bytes.Buffer
	c.Stdout, c.Stderr = &out, &errb
	err := c.Run()
	r := engine.RunResult{Out: decode(out.Bytes()), Err: decode(errb.Bytes())}
	if err != nil {
		r.Code = 1
		if ee, ok := err.(*exec.ExitError); ok {
			r.Code = ee.ExitCode()
			if r.Code == 0 {
				r.Code = 1
			}
		}
		if ctx.Err() != nil {
			r.Err = "timed out: " + r.Err
		} else if r.Err == "" && r.Out == "" {
			r.Err = err.Error()
		}
	}
	return r
}

// decode turns console output into a string (handles the UTF-16 BOM PowerShell / reg sometimes emit).
func decode(b []byte) string {
	if len(b) >= 2 && b[0] == 0xff && b[1] == 0xfe {
		u := make([]uint16, (len(b)-2)/2)
		for i := range u {
			u[i] = binary.LittleEndian.Uint16(b[2+2*i:])
		}
		return string(utf16.Decode(u))
	}
	return string(b)
}

// StartDetached launches a program and does not wait (the installer, the website).
func StartDetached(path string, args ...string) error {
	c := exec.Command(path, args...)
	c.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NEW_PROCESS_GROUP | windows.DETACHED_PROCESS}
	if err := c.Start(); err != nil {
		return err
	}
	return c.Process.Release()
}

/* ---- start with Windows: a logon task with highest privileges (no UAC prompt), not limited to AC power or 72 h ---- */

const taskName = "FPS Boost"

func taskXML(exe string) string {
	user, _ := currentUser()
	return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Starts FPS Boost in the background when you sign in.</Description><Author>FPS Boost</Author></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>` + xmlEsc(user) + `</UserId></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>` + xmlEsc(user) + `</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>5</Priority>
  </Settings>
  <Actions Context="Author"><Exec><Command>` + xmlEsc(exe) + `</Command><Arguments>--tray</Arguments></Exec></Actions>
</Task>`
}

func xmlEsc(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;").Replace(s)
}

func currentUser() (string, error) {
	var tok windows.Token
	if err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &tok); err != nil {
		return "", err
	}
	defer tok.Close()
	u, err := tok.GetTokenUser()
	if err != nil {
		return "", err
	}
	acc, dom, _, err := u.User.Sid.LookupAccount("")
	if err != nil {
		return u.User.Sid.String(), nil
	}
	return dom + `\` + acc, nil
}

// IsWine reports whether we run under Wine (local test builds): schtasks and friends hang there.
func IsWine() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Wine`, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	k.Close()
	return true
}

// InstallStartupTask registers (or refreshes) the logon task.
func InstallStartupTask(exe string) error {
	if IsWine() {
		return fmt.Errorf("skipped under Wine")
	}
	f := filepath.Join(os.TempDir(), "fpsboost-task.xml")
	// UTF-16LE with BOM, as schtasks expects
	u := utf16.Encode([]rune(taskXML(exe)))
	b := make([]byte, 2+2*len(u))
	b[0], b[1] = 0xff, 0xfe
	for i, c := range u {
		binary.LittleEndian.PutUint16(b[2+2*i:], c)
	}
	if err := os.WriteFile(f, b, 0o600); err != nil {
		return err
	}
	defer os.Remove(f)
	r := Run(30*time.Second, "schtasks", "/Create", "/TN", taskName, "/XML", f, "/F")
	if r.Code != 0 {
		return fmt.Errorf("schtasks: %s", strings.TrimSpace(r.Err+r.Out))
	}
	return nil
}

// RemoveStartupTask deletes the logon task (also used by the uninstaller through --unregister).
func RemoveStartupTask() {
	if IsWine() {
		return
	}
	Run(30*time.Second, "schtasks", "/Delete", "/TN", taskName, "/F")
}

// HasStartupTask reports whether the task exists.
func HasStartupTask() bool {
	if IsWine() {
		return false
	}
	return Run(30*time.Second, "schtasks", "/Query", "/TN", taskName).Code == 0
}

// StartVisible launches a program in its own window and does not wait: a console program (cmd.exe running sfc,
// chkdsk…) gets a fresh console the user can watch; a GUI program just opens. cmdLine, when set, is passed to Windows
// verbatim (cmd.exe's own quoting rules, not Go's) and must start with the program name.
func StartVisible(exe, cmdLine string) error {
	c := exec.Command(exe)
	c.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NEW_CONSOLE | windows.CREATE_NEW_PROCESS_GROUP, CmdLine: cmdLine}
	if err := c.Start(); err != nil {
		return err
	}
	return c.Process.Release()
}
