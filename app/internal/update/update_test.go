package update_test

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"fpsboost.ir/app/internal/update"
)

type poster struct{ m map[string]any }

func (p poster) Post(string, map[string]any) (map[string]any, error) { return p.m, nil }

func TestCheckDownloadVerifyInstall(t *testing.T) {
	payload := []byte("fake installer bytes")
	sum := sha256.Sum256(payload)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(payload) }))
	defer srv.Close()
	dir := t.TempDir()
	var states []string
	u := update.New(poster{map[string]any{"latest": "1.2.0", "url": srv.URL + "/x.exe", "sha256": hex.EncodeToString(sum[:])}}, "1.0.0", dir, func(s update.State) { states = append(states, s.Status) })
	// http (not https) urls are refused by the manifest check → up to date; test with https rewritten client
	u.Client = srv.Client()
	st := u.Check()
	if st.Status != "uptodate" {
		t.Fatalf("http url must be refused: %+v", st)
	}
	u2 := update.New(poster{map[string]any{"latest": "1.2.0", "url": "https://example.invalid/x.exe", "sha256": hex.EncodeToString(sum[:])}}, "1.0.0", dir, nil)
	u2.Client = &http.Client{Transport: rewrite{srv.URL}}
	if st := u2.Check(); st.Status != "available" || st.Latest != "1.2.0" {
		t.Fatalf("check %+v", st)
	}
	st = u2.Download()
	if st.Status != "ready" || st.Progress != 100 {
		t.Fatalf("download %+v", st)
	}
	launched := ""
	u2.Launch = func(p string, args ...string) error { launched = p + " " + args[0]; return nil }
	if err := u2.Install(); err != nil || launched != filepath.Join(dir, "FPSBoost-Setup-1.2.0.exe")+" /S" {
		t.Fatalf("install %v %q", err, launched)
	}
	// tampered file is refused
	_ = os.WriteFile(st.File, []byte("evil"), 0o644)
	u2.Check()
	u3 := update.New(poster{map[string]any{"latest": "1.2.0", "url": "https://example.invalid/x.exe", "sha256": hex.EncodeToString(sum[:])}}, "1.0.0", dir, nil)
	u3.Client = &http.Client{Transport: rewrite{srv.URL}}
	if st := u3.Check(); st.Status != "available" {
		t.Fatalf("tampered download must not be 'ready': %+v", st)
	}
	if update.Cmp("1.10.0", "1.9.9") <= 0 || update.Cmp("1.0.0", "1.0.0") != 0 {
		t.Fatal("cmp")
	}
}

type rewrite struct{ base string }

func (r rewrite) RoundTrip(req *http.Request) (*http.Response, error) {
	req2 := req.Clone(req.Context())
	req2.URL.Scheme = "http"
	req2.URL.Host = r.base[len("http://"):]
	return http.DefaultTransport.RoundTrip(req2)
}
