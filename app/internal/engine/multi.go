package engine

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

/* ---- several Windows services in one tweak ---- */

// ServicesTweak disables (and stops) every listed service that is installed; services missing on this PC are skipped.
// Check = at least one is installed and every installed one is disabled. Revert restores each one's start type.
func ServicesTweak(m Meta, services ...string) *Tweak {
	t := &Tweak{Meta: m, services: services}
	key := func(svc string) string { return servicesKey + `\` + svc }
	t.Check = func(c *Ctx) (bool, error) {
		found := false
		for _, svc := range services {
			start, ok := RegUint(c.Sys, key(svc), "Start")
			if !ok {
				continue
			}
			found = true
			if start != 4 {
				return false, nil
			}
		}
		return found, nil
	}
	t.Apply = func(c *Ctx) error {
		originals := map[string]serviceBackup{}
		for _, svc := range services {
			start, ok := RegUint(c.Sys, key(svc), "Start")
			if !ok {
				continue
			}
			delayed, _ := RegUint(c.Sys, key(svc), "DelayedAutostart")
			originals[svc] = serviceBackup{Start: start, Delayed: delayed == 1}
		}
		if len(originals) == 0 {
			return fmt.Errorf("none of these services exist on this PC")
		}
		if _, err := c.Backup.SaveOnce(c.ID, originals); err != nil {
			return err
		}
		var failed []string
		for svc := range originals {
			if _, err := Must(c.Sys, shortTimeout, "sc", "config", svc, "start=", "disabled"); err != nil {
				failed = append(failed, svc)
				continue
			}
			c.Sys.Run(longTimeout, "sc", "stop", svc) // may already be stopped
		}
		if len(failed) > 0 {
			sort.Strings(failed)
			return fmt.Errorf("could not disable: %s", strings.Join(failed, ", "))
		}
		return nil
	}
	t.Revert = func(c *Ctx) error {
		originals := map[string]serviceBackup{}
		if !c.Backup.Get(c.ID, &originals) {
			for _, svc := range services { // no backup: put the installed ones back to manual, the safe default
				if _, ok := RegUint(c.Sys, key(svc), "Start"); ok {
					originals[svc] = serviceBackup{Start: 3}
				}
			}
		}
		for svc, b := range originals {
			mode := startMode(b)
			if _, err := Must(c.Sys, shortTimeout, "sc", "config", svc, "start=", mode); err != nil {
				return err
			}
			if mode == "auto" || mode == "delayed-auto" {
				c.Sys.Run(longTimeout, "sc", "start", svc)
			}
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

func startMode(b serviceBackup) string {
	switch {
	case b.Start == 3:
		return "demand"
	case b.Start == 4:
		return "disabled"
	case b.Start == 2 && b.Delayed:
		return "delayed-auto"
	}
	return "auto"
}

/* ---- several power settings in one tweak, optionally AC (plugged in) only ---- */

// PowerSetting is one powercfg knob: sub group GUID, setting GUID and the index / value wanted.
type PowerSetting struct {
	Sub, Setting string
	Want         uint64
}

// PowerSettingsTweak sets every listed setting of the active plan. Settings that do not exist on this PC (no battery, no
// Wi-Fi…) are skipped; Check = at least one exists and every existing one has the wanted value. acOnly leaves the
// on-battery value alone (laptops keep saving power when unplugged).
func PowerSettingsTweak(m Meta, acOnly bool, items ...PowerSetting) *Tweak {
	t := &Tweak{Meta: m}
	id := func(p PowerSetting) string { return p.Sub + "/" + p.Setting }
	t.Check = func(c *Ctx) (bool, error) {
		found := false
		for _, p := range items {
			ac, dc, err := powercfgRead(c.Sys, p.Sub, p.Setting)
			if err != nil {
				continue
			}
			found = true
			if ac != p.Want || (!acOnly && dc != p.Want) {
				return false, nil
			}
		}
		return found, nil
	}
	t.Apply = func(c *Ctx) error {
		originals := map[string]powerBackup{}
		for _, p := range items {
			ac, dc, err := powercfgRead(c.Sys, p.Sub, p.Setting)
			if err != nil {
				continue
			}
			originals[id(p)] = powerBackup{AC: ac, DC: dc}
		}
		if len(originals) == 0 {
			return fmt.Errorf("these power settings are %s", errNotAvailable)
		}
		if _, err := c.Backup.SaveOnce(c.ID, originals); err != nil {
			return err
		}
		for _, p := range items {
			if _, ok := originals[id(p)]; !ok {
				continue
			}
			w := strconv.FormatUint(p.Want, 10)
			if _, err := Must(c.Sys, shortTimeout, "powercfg", "/setacvalueindex", "SCHEME_CURRENT", p.Sub, p.Setting, w); err != nil {
				return err
			}
			if !acOnly {
				c.Sys.Run(shortTimeout, "powercfg", "/setdcvalueindex", "SCHEME_CURRENT", p.Sub, p.Setting, w)
			}
		}
		_, err := Must(c.Sys, shortTimeout, "powercfg", "/setactive", "SCHEME_CURRENT")
		return err
	}
	t.Revert = func(c *Ctx) error {
		originals := map[string]powerBackup{}
		if !c.Backup.Get(c.ID, &originals) {
			return c.Backup.Clear(c.ID) // nothing known to restore
		}
		for _, p := range items {
			b, ok := originals[id(p)]
			if !ok {
				continue
			}
			c.Sys.Run(shortTimeout, "powercfg", "/setacvalueindex", "SCHEME_CURRENT", p.Sub, p.Setting, strconv.FormatUint(b.AC, 10))
			if !acOnly {
				c.Sys.Run(shortTimeout, "powercfg", "/setdcvalueindex", "SCHEME_CURRENT", p.Sub, p.Setting, strconv.FormatUint(b.DC, 10))
			}
		}
		c.Sys.Run(shortTimeout, "powercfg", "/setactive", "SCHEME_CURRENT")
		return c.Backup.Clear(c.ID)
	}
	return t
}
