//go:build windows

package win

import (
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Foreground returns the foreground window's process id and exe name (lower-case base name), plus whether the window
// covers its whole monitor (fullscreen / borderless).
func Foreground() (pid uint32, exe string, fullscreen bool, hwnd uintptr) {
	hwnd, _, _ = pGetForegroundWindow.Call()
	if hwnd == 0 {
		return
	}
	pGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return
	}
	exe = strings.ToLower(filepath.Base(ProcessPath(pid)))
	var wr Rect
	pGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&wr)))
	m, _, _ := pMonitorFromWindow.Call(hwnd, MONITOR_DEFAULTTONEAREST)
	if m != 0 {
		var mi MonitorInfo
		mi.CbSize = uint32(unsafe.Sizeof(mi))
		if r, _, _ := pGetMonitorInfoW.Call(m, uintptr(unsafe.Pointer(&mi))); r != 0 {
			fullscreen = wr.Left <= mi.RcMonitor.Left && wr.Top <= mi.RcMonitor.Top && wr.Right >= mi.RcMonitor.Right && wr.Bottom >= mi.RcMonitor.Bottom
		}
	}
	return
}

// ProcessPath returns the full image path of a process ("" when inaccessible).
func ProcessPath(pid uint32) string {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return ""
	}
	defer windows.CloseHandle(h)
	buf := make([]uint16, windows.MAX_PATH*2)
	n := uint32(len(buf))
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &n); err != nil {
		return ""
	}
	return windows.UTF16ToString(buf[:n])
}

// SetPriority changes a process's priority class; returns the previous class.
func SetPriority(pid uint32, class uint32) (prev uint32, err error) {
	h, err := windows.OpenProcess(windows.PROCESS_SET_INFORMATION|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return 0, err
	}
	defer windows.CloseHandle(h)
	p, _, _ := pGetPriorityClass.Call(uintptr(h))
	prev = uint32(p)
	if prev == class {
		return prev, nil
	}
	return prev, windows.SetPriorityClass(h, class)
}

// Process is one running process.
type Process struct {
	PID uint32
	Exe string // lower-case base name
}

// Processes lists running processes.
func Processes() []Process {
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(snap)
	var pe windows.ProcessEntry32
	pe.Size = uint32(unsafe.Sizeof(pe))
	var out []Process
	if err := windows.Process32First(snap, &pe); err != nil {
		return nil
	}
	for {
		out = append(out, Process{PID: pe.ProcessID, Exe: strings.ToLower(windows.UTF16ToString(pe.ExeFile[:]))})
		if err := windows.Process32Next(snap, &pe); err != nil {
			break
		}
	}
	return out
}

// Memory returns total and available physical memory in MB plus the load percentage.
func Memory() (totalMB, availMB int, load int) {
	var ms MemoryStatusEx
	ms.Length = uint32(unsafe.Sizeof(ms))
	if r, _, _ := pGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&ms))); r == 0 {
		return 0, 0, 0
	}
	return int(ms.TotalPhys >> 20), int(ms.AvailPhys >> 20), int(ms.MemoryLoad)
}

// EmptyWorkingSet trims a process's working set (pages go to the standby list, come back on demand).
func EmptyWorkingSet(pid uint32) bool {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_INFORMATION|windows.PROCESS_SET_QUOTA, false, pid)
	if err != nil {
		return false
	}
	defer windows.CloseHandle(h)
	r, _, _ := pEmptyWorkingSet.Call(uintptr(h))
	return r != 0
}

// EnablePrivilege turns a privilege on for this process (e.g. SeProfileSingleProcessPrivilege).
func EnablePrivilege(name string) error {
	var tok windows.Token
	if err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_ADJUST_PRIVILEGES|windows.TOKEN_QUERY, &tok); err != nil {
		return err
	}
	defer tok.Close()
	var luid windows.LUID
	if err := windows.LookupPrivilegeValue(nil, wstr(name), &luid); err != nil {
		return err
	}
	tp := windows.Tokenprivileges{PrivilegeCount: 1}
	tp.Privileges[0] = windows.LUIDAndAttributes{Luid: luid, Attributes: windows.SE_PRIVILEGE_ENABLED}
	return windows.AdjustTokenPrivileges(tok, false, &tp, 0, nil, nil)
}

// PurgeStandbyList drops the standby (cached) memory list so it is free for the game. Needs
// SeProfileSingleProcessPrivilege — available to administrators.
func PurgeStandbyList() bool {
	_ = EnablePrivilege("SeProfileSingleProcessPrivilege")
	const systemMemoryListInformation = 0x50
	cmd := int32(4) // MemoryPurgeStandbyList
	r, _, _ := pNtSetSystemInformation.Call(systemMemoryListInformation, uintptr(unsafe.Pointer(&cmd)), 4)
	return int32(r) >= 0
}

// TimerResolution requests (set) or releases a 0.5 ms system timer for this process. With the GlobalTimerResolutionRequests
// registry value (tweak timer_global) the request applies system-wide on Windows 10 2004+ / 11.
func TimerResolution(set bool) {
	var actual uint32
	setFlag := uintptr(0)
	if set {
		setFlag = 1
	}
	pNtSetTimerResolution.Call(5000, setFlag, uintptr(unsafe.Pointer(&actual))) // 100 ns units → 0.5 ms
}

// IsAdmin reports whether the process token is elevated.
func IsAdmin() bool {
	var tok windows.Token
	if err := windows.OpenProcessToken(windows.CurrentProcess(), windows.TOKEN_QUERY, &tok); err != nil {
		return false
	}
	defer tok.Close()
	return tok.IsElevated()
}

// ExePath is our own executable.
func ExePath() string {
	buf := make([]uint16, windows.MAX_PATH*2)
	n, err := windows.GetModuleFileName(0, &buf[0], uint32(len(buf)))
	if err != nil {
		return ""
	}
	return windows.UTF16ToString(buf[:n])
}
