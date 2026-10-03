package engine

import (
	"fmt"
	"strings"
	"time"
)

/* ---- scheduled tasks: disable a list of Task Scheduler tasks, re-enable the ones that were enabled ---- */

// taskState is what Get-ScheduledTask reports per task (State: 0 unknown, 1 disabled, 2 queued, 3 ready, 4 running).
type taskState struct {
	Name  string `json:"n"`
	State int    `json:"s"`
}

const stateDisabled = 1

// psList renders Go strings as a PowerShell array literal of single-quoted strings.
func psList(items []string) string {
	q := make([]string, len(items))
	for i, s := range items {
		q[i] = "'" + strings.ReplaceAll(s, "'", "''") + "'"
	}
	return "@(" + strings.Join(q, ",") + ")"
}

// taskLoop is the PowerShell that splits '\Folder\Sub\Name' into -TaskPath '\Folder\Sub\' and -TaskName 'Name'.
const taskLoop = `foreach ($t in %s) { $i = $t.LastIndexOf('\'); $p = $t.Substring(0, $i + 1); $n = $t.Substring($i + 1); %s }`

func queryTasks(s Sys, tasks []string) ([]taskState, error) {
	body := `$x = Get-ScheduledTask -TaskPath $p -TaskName $n -ErrorAction SilentlyContinue; if ($x) { $r += [pscustomobject]@{ n = $t; s = [int]$x.State } }`
	script := "$r = @(); " + fmt.Sprintf(taskLoop, psList(tasks), body) + "; ConvertTo-Json -Compress -InputObject $r"
	out, err := PS(s, 60*time.Second, script)
	if err != nil {
		return nil, err
	}
	out = strings.TrimSpace(strings.TrimPrefix(out, "\xef\xbb\xbf"))
	if out == "" || out == "null" {
		return nil, nil
	}
	var list []taskState
	if strings.HasPrefix(out, "{") { // a single object (older PowerShell unwraps one-element arrays)
		var one taskState
		if err := UnmarshalJSON(out, &one); err != nil {
			return nil, err
		}
		return []taskState{one}, nil
	}
	return list, UnmarshalJSON(out, &list)
}

func setTasks(s Sys, tasks []string, enable bool) error {
	if len(tasks) == 0 {
		return nil
	}
	verb := "Disable-ScheduledTask"
	if enable {
		verb = "Enable-ScheduledTask"
	}
	body := verb + " -TaskPath $p -TaskName $n -ErrorAction SilentlyContinue | Out-Null"
	_, err := PS(s, 90*time.Second, fmt.Sprintf(taskLoop, psList(tasks), body))
	return err
}

// TasksTweak disables the listed scheduled tasks (full paths like `\Microsoft\Windows\Defrag\ScheduledDefrag`); tasks
// missing on this PC are skipped. The backup is the list of tasks that were enabled, so revert re-enables exactly those.
func TasksTweak(m Meta, tasks ...string) *Tweak {
	t := &Tweak{Meta: m}
	t.Check = func(c *Ctx) (bool, error) {
		list, err := queryTasks(c.Sys, tasks)
		if err != nil {
			return false, err
		}
		if len(list) == 0 {
			return false, nil
		}
		for _, x := range list {
			if x.State != stateDisabled {
				return false, nil
			}
		}
		return true, nil
	}
	t.Apply = func(c *Ctx) error {
		list, err := queryTasks(c.Sys, tasks)
		if err != nil {
			return err
		}
		if len(list) == 0 {
			return fmt.Errorf("none of these scheduled tasks exist on this PC")
		}
		var enabled []string
		for _, x := range list {
			if x.State != stateDisabled {
				enabled = append(enabled, x.Name)
			}
		}
		if _, err := c.Backup.SaveOnce(c.ID, enabled); err != nil {
			return err
		}
		return setTasks(c.Sys, enabled, false)
	}
	t.Revert = func(c *Ctx) error {
		var enabled []string
		if !c.Backup.Get(c.ID, &enabled) {
			enabled = tasks // no backup: enable everything we know (the Windows default for all of them)
		}
		if err := setTasks(c.Sys, enabled, true); err != nil {
			return err
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}
