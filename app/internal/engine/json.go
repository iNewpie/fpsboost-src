package engine

import (
	"encoding/json"
	"strings"
	"time"
)

// UnmarshalJSON decodes command output (BOM / whitespace tolerant).
func UnmarshalJSON(s string, v any) error {
	s = strings.TrimSpace(strings.TrimPrefix(s, "\xef\xbb\xbf"))
	return json.Unmarshal([]byte(s), v)
}

// PSJSON runs PowerShell and decodes its JSON output.
func PSJSON(s Sys, timeout time.Duration, script string, v any) error {
	out, err := PS(s, timeout, script)
	if err != nil {
		return err
	}
	if strings.TrimSpace(out) == "" {
		return errNotAvailable
	}
	return UnmarshalJSON(out, v)
}
