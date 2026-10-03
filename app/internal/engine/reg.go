package engine

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// RegVal is one registry value a declarative tweak wants.
type RegVal struct {
	Key   string
	Name  string
	Type  string // REG_DWORD | REG_SZ | REG_QWORD | REG_EXPAND_SZ
	Value any
}

// DW / SZ build RegVals.
func DW(key, name string, v uint32) RegVal {
	return RegVal{Key: key, Name: name, Type: "REG_DWORD", Value: v}
}
func SZ(key, name, v string) RegVal { return RegVal{Key: key, Name: name, Type: "REG_SZ", Value: v} }

// original is what the backup stores per value: {"key":..,"name":..,"was":{type,value}|null} — the Electron format.
type original struct {
	Key  string    `json:"key"`
	Name string    `json:"name"`
	Was  *RegValue `json:"was"`
}

// RegTweak: check = every value present and equal, apply = backup + set, revert = restore or delete.
func RegTweak(m Meta, values ...RegVal) *Tweak {
	t := &Tweak{Meta: m, regValues: values}
	t.Check = func(c *Ctx) (bool, error) {
		for _, v := range values {
			cur, err := c.Sys.RegGet(v.Key, v.Name)
			if err != nil {
				return false, err
			}
			if cur == nil || !Same(cur.Value, v.Value) {
				return false, nil
			}
		}
		return true, nil
	}
	t.Apply = func(c *Ctx) error {
		originals := make([]original, 0, len(values))
		for _, v := range values {
			cur, err := c.Sys.RegGet(v.Key, v.Name)
			if err != nil {
				return err
			}
			originals = append(originals, original{Key: v.Key, Name: v.Name, Was: cur})
		}
		if _, err := c.Backup.SaveOnce(c.ID, originals); err != nil {
			return err
		}
		for _, v := range values {
			if err := c.Sys.RegSet(v.Key, v.Name, RegValue{Type: v.Type, Value: v.Value}); err != nil {
				return err
			}
		}
		return nil
	}
	t.Revert = func(c *Ctx) error {
		var originals []original
		if !c.Backup.Get(c.ID, &originals) {
			for _, v := range values { // no backup: the value did not exist before us, most likely
				originals = append(originals, original{Key: v.Key, Name: v.Name})
			}
		}
		for _, o := range originals {
			var err error
			if o.Was != nil {
				err = c.Sys.RegSet(o.Key, o.Name, *o.Was)
			} else {
				err = c.Sys.RegDel(o.Key, o.Name)
			}
			if err != nil {
				return err
			}
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

// RegUint reads a DWORD-ish value; ok=false when missing.
func RegUint(s Sys, key, name string) (uint64, bool) {
	v, err := s.RegGet(key, name)
	if err != nil || v == nil {
		return 0, false
	}
	n, ok := Num(v.Value)
	return uint64(n), ok
}

/* ---- Windows services: Start 2 = automatic, 3 = manual, 4 = disabled ---- */

const servicesKey = `HKLM\SYSTEM\CurrentControlSet\Services`

type serviceBackup struct {
	Start   uint64 `json:"start"`
	Delayed bool   `json:"delayed"`
}

// ServiceTweak disables a service (and stops it); revert restores its start type and starts it again.
func ServiceTweak(m Meta, service string) *Tweak {
	key := servicesKey + `\` + service
	t := &Tweak{Meta: m, services: []string{service}}
	t.Check = func(c *Ctx) (bool, error) {
		start, ok := RegUint(c.Sys, key, "Start")
		if !ok {
			return false, nil // service not installed
		}
		return start == 4, nil
	}
	t.Apply = func(c *Ctx) error {
		start, ok := RegUint(c.Sys, key, "Start")
		if !ok {
			return fmt.Errorf("service %s is not installed", service)
		}
		delayed, _ := RegUint(c.Sys, key, "DelayedAutostart")
		if _, err := c.Backup.SaveOnce(c.ID, serviceBackup{Start: start, Delayed: delayed == 1}); err != nil {
			return err
		}
		if _, err := Must(c.Sys, shortTimeout, "sc", "config", service, "start=", "disabled"); err != nil {
			return err
		}
		c.Sys.Run(longTimeout, "sc", "stop", service) // may already be stopped
		return nil
	}
	t.Revert = func(c *Ctx) error {
		b := serviceBackup{Start: 2}
		c.Backup.Get(c.ID, &b)
		mode := "auto"
		switch {
		case b.Start == 3:
			mode = "demand"
		case b.Start == 4:
			mode = "disabled"
		case b.Start == 2 && b.Delayed:
			mode = "delayed-auto"
		}
		if _, err := Must(c.Sys, shortTimeout, "sc", "config", service, "start=", mode); err != nil {
			return err
		}
		if mode == "auto" || mode == "delayed-auto" {
			c.Sys.Run(longTimeout, "sc", "start", service)
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

/* ---- powercfg settings (AC + DC index of one setting in the active scheme) ---- */

type powerBackup struct {
	AC uint64 `json:"ac"`
	DC uint64 `json:"dc"`
}

var hexRe = regexp.MustCompile(`0x[0-9a-fA-F]{8}`)

// powercfgRead returns the current AC and DC index of a setting. The labels are localized but the two "Current … Power
// Setting Index: 0x…" values are always the last two hex words of the output.
func powercfgRead(s Sys, sub, setting string) (ac, dc uint64, err error) {
	r := s.Run(shortTimeout, "powercfg", "/q", "SCHEME_CURRENT", sub, setting)
	hx := hexRe.FindAllString(r.Out, -1)
	if r.Code != 0 || len(hx) < 2 {
		// hidden settings (core parking, many processor knobs) are invisible to /q until their ATTRIB_HIDE is cleared
		s.Run(shortTimeout, "powercfg", "/attributes", sub, setting, "-ATTRIB_HIDE")
		r = s.Run(shortTimeout, "powercfg", "/q", "SCHEME_CURRENT", sub, setting)
		hx = hexRe.FindAllString(r.Out, -1)
	}
	if r.Code != 0 || len(hx) < 2 {
		return 0, 0, errNotAvailable
	}
	ac, _ = strconv.ParseUint(hx[len(hx)-2][2:], 16, 64)
	dc, _ = strconv.ParseUint(hx[len(hx)-1][2:], 16, 64)
	return ac, dc, nil
}

// PowercfgTweak sets one power setting (both AC and DC) of the active plan to want.
func PowercfgTweak(m Meta, sub, setting string, want uint64) *Tweak {
	t := &Tweak{Meta: m}
	t.Check = func(c *Ctx) (bool, error) {
		ac, dc, err := powercfgRead(c.Sys, sub, setting)
		if err != nil {
			return false, nil // the setting does not exist on this PC (e.g. no wireless adapter)
		}
		return ac == want && dc == want, nil
	}
	t.Apply = func(c *Ctx) error {
		ac, dc, err := powercfgRead(c.Sys, sub, setting)
		if err != nil {
			return fmt.Errorf("this power setting is %s", err)
		}
		if _, err := c.Backup.SaveOnce(c.ID, powerBackup{AC: ac, DC: dc}); err != nil {
			return err
		}
		w := strconv.FormatUint(want, 10)
		if _, err := Must(c.Sys, shortTimeout, "powercfg", "/setacvalueindex", "SCHEME_CURRENT", sub, setting, w); err != nil {
			return err
		}
		c.Sys.Run(shortTimeout, "powercfg", "/setdcvalueindex", "SCHEME_CURRENT", sub, setting, w)
		_, err = Must(c.Sys, shortTimeout, "powercfg", "/setactive", "SCHEME_CURRENT")
		return err
	}
	t.Revert = func(c *Ctx) error {
		var b powerBackup
		if !c.Backup.Get(c.ID, &b) {
			return c.Backup.Clear(c.ID) // nothing known to restore
		}
		c.Sys.Run(shortTimeout, "powercfg", "/setacvalueindex", "SCHEME_CURRENT", sub, setting, strconv.FormatUint(b.AC, 10))
		c.Sys.Run(shortTimeout, "powercfg", "/setdcvalueindex", "SCHEME_CURRENT", sub, setting, strconv.FormatUint(b.DC, 10))
		c.Sys.Run(shortTimeout, "powercfg", "/setactive", "SCHEME_CURRENT")
		return c.Backup.Clear(c.ID)
	}
	return t
}

// GUIDRe finds a GUID in command output.
var GUIDRe = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

// FirstGUID returns the first GUID in s, lower-cased.
func FirstGUID(s string) string { return strings.ToLower(GUIDRe.FindString(s)) }
