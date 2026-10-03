// Package update is the self-updater: ask the server (signed answer) for the latest version, download the installer into
// <data>/update, verify its SHA-256 against the signed manifest, then run it silently (NSIS /S) — on "Update now" or when
// the app quits. Nothing is ever installed that the server did not sign a hash for.
package update

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Poster is what auth.Auth provides.
type Poster interface {
	Post(path string, body map[string]any) (map[string]any, error)
}

// State is what the UI sees.
type State struct {
	Status   string `json:"status"` // idle | checking | uptodate | available | downloading | ready | installing | error
	Current  string `json:"current"`
	Latest   string `json:"latest"`
	Progress int    `json:"progress"`
	File     string `json:"file"`
	Error    string `json:"error"`
}

type manifest struct {
	Latest, URL, SHA256 string
}

// Updater downloads and installs.
type Updater struct {
	Poster  Poster
	Version string
	Dir     string
	Client  *http.Client
	OnState func(State)
	// Launch starts the installer detached (platform specific); nil = cannot install (tests, Linux).
	Launch func(path string, args ...string) error

	mu   sync.Mutex
	st   State
	m    *manifest
	busy bool
}

func New(p Poster, version, dir string, onState func(State)) *Updater {
	u := &Updater{Poster: p, Version: version, Dir: dir, Client: &http.Client{Timeout: 20 * time.Minute}, OnState: onState}
	u.st = State{Status: "idle", Current: version}
	return u
}

func (u *Updater) set(fn func(s *State)) State {
	u.mu.Lock()
	fn(&u.st)
	s := u.st
	u.mu.Unlock()
	if u.OnState != nil {
		u.OnState(s)
	}
	return s
}

// State returns a copy.
func (u *Updater) State() State {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.st
}

var verRe = regexp.MustCompile(`^\d+\.\d+\.\d+$`)
var shaRe = regexp.MustCompile(`^[0-9a-f]{64}$`)

// Cmp compares dotted versions.
func Cmp(a, b string) int {
	x, y := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var p, q int
		if i < len(x) {
			p, _ = strconv.Atoi(x[i])
		}
		if i < len(y) {
			q, _ = strconv.Atoi(y[i])
		}
		if p != q {
			return p - q
		}
	}
	return 0
}

// Check asks for the signed manifest; 'available' when it is newer than us, 'ready' when it is already downloaded.
func (u *Updater) Check() State {
	u.mu.Lock()
	if u.busy {
		s := u.st
		u.mu.Unlock()
		return s
	}
	u.mu.Unlock()
	u.set(func(s *State) { s.Status = "checking"; s.Error = "" })
	d, err := u.Poster.Post("/api/app/update", map[string]any{"version": u.Version})
	if err != nil {
		return u.set(func(s *State) { s.Status = "error"; s.Error = err.Error() })
	}
	m := &manifest{Latest: str(d["latest"]), URL: str(d["url"]), SHA256: strings.ToLower(str(d["sha256"]))}
	if !verRe.MatchString(m.Latest) || !strings.HasPrefix(m.URL, "https://") || !shaRe.MatchString(m.SHA256) {
		return u.set(func(s *State) { s.Status = "uptodate"; s.Latest = m.Latest })
	}
	u.mu.Lock()
	u.m = m
	u.mu.Unlock()
	if Cmp(m.Latest, u.Version) <= 0 {
		return u.set(func(s *State) { s.Status = "uptodate"; s.Latest = m.Latest })
	}
	if f := u.readyFile(m); f != "" {
		return u.set(func(s *State) { s.Status = "ready"; s.Latest = m.Latest; s.File = f; s.Progress = 100 })
	}
	return u.set(func(s *State) { s.Status = "available"; s.Latest = m.Latest })
}

func (u *Updater) file(m *manifest) string {
	return filepath.Join(u.Dir, "FPSBoost-Setup-"+m.Latest+".exe")
}

func (u *Updater) readyFile(m *manifest) string {
	f := u.file(m)
	if sum, err := FileSHA256(f); err == nil && sum == m.SHA256 {
		return f
	}
	return ""
}

// Download streams the installer to disk, hashing as it goes; keeps it only if the hash matches the signed one.
func (u *Updater) Download() State {
	u.mu.Lock()
	if u.busy || u.m == nil || u.st.Status == "ready" {
		s := u.st
		u.mu.Unlock()
		return s
	}
	u.busy = true
	m := *u.m
	u.mu.Unlock()
	defer func() { u.mu.Lock(); u.busy = false; u.mu.Unlock() }()
	u.set(func(s *State) { s.Status = "downloading"; s.Progress = 0; s.Error = "" })
	final := u.file(&m)
	tmp := final + ".part"
	fail := func(err error) State {
		os.Remove(tmp)
		return u.set(func(s *State) { s.Status = "error"; s.Error = err.Error(); s.Progress = 0 })
	}
	if err := os.MkdirAll(u.Dir, 0o755); err != nil {
		return fail(err)
	}
	resp, err := u.Client.Get(m.URL)
	if err != nil {
		return fail(fmt.Errorf("download failed: %v", err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fail(fmt.Errorf("download failed: HTTP %d", resp.StatusCode))
	}
	out, err := os.Create(tmp)
	if err != nil {
		return fail(err)
	}
	h := sha256.New()
	total := resp.ContentLength
	var got int64
	last := -1
	buf := make([]byte, 256<<10)
	for {
		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			h.Write(buf[:n])
			if _, werr := out.Write(buf[:n]); werr != nil {
				out.Close()
				return fail(werr)
			}
			got += int64(n)
			if total > 0 {
				if pc := int(got * 100 / total); pc != last {
					last = pc
					u.set(func(s *State) { s.Progress = pc })
				}
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			out.Close()
			return fail(fmt.Errorf("download interrupted: %v", rerr))
		}
	}
	if err := out.Close(); err != nil {
		return fail(err)
	}
	if hex.EncodeToString(h.Sum(nil)) != m.SHA256 {
		return fail(errors.New("downloaded file does not match the signed checksum"))
	}
	if err := os.Rename(tmp, final); err != nil {
		return fail(err)
	}
	if entries, err := os.ReadDir(u.Dir); err == nil { // old downloads
		for _, e := range entries {
			if e.Name() != filepath.Base(final) {
				os.Remove(filepath.Join(u.Dir, e.Name()))
			}
		}
	}
	return u.set(func(s *State) { s.Status = "ready"; s.File = final; s.Progress = 100 })
}

// Install runs the verified installer silently; the caller quits right after.
func (u *Updater) Install() error {
	u.mu.Lock()
	st, m := u.st, u.m
	u.mu.Unlock()
	if st.Status != "ready" || st.File == "" || m == nil {
		return errors.New("no update downloaded")
	}
	if sum, err := FileSHA256(st.File); err != nil || sum != m.SHA256 {
		os.Remove(st.File)
		u.set(func(s *State) { s.Status = "available"; s.File = "" })
		return errors.New("installer changed on disk — download it again")
	}
	if u.Launch == nil {
		return errors.New("installing is not possible on this platform")
	}
	if err := u.Launch(st.File, "/S"); err != nil {
		return err
	}
	u.set(func(s *State) { s.Status = "installing" })
	return nil
}

// Ready reports a verified installer waiting (for install-at-quit).
func (u *Updater) Ready() bool { return u.State().Status == "ready" }

// FileSHA256 hashes a file.
func FileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func str(v any) string {
	s, _ := v.(string)
	return s
}
