package auth_test

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"fpsboost.ir/app/internal/auth"
)

func server(t *testing.T, priv ed25519.PrivateKey, mode *string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var b map[string]any
		_ = json.Unmarshal(body, &b)
		switch *mode {
		case "down":
			w.WriteHeader(502)
			return
		case "401":
			w.WriteHeader(401)
			_, _ = w.Write([]byte(`{"error":"token expired, log in again"}`))
			return
		}
		payload := map[string]any{"username": "bob", "active": true, "expires": float64(time.Now().Add(72 * time.Hour).UnixMilli()), "now": time.Now().UnixMilli(), "nonce": b["nonce"], "machine": b["machine"]}
		if r.URL.Path == "/api/app/login" {
			if b["password"] != "pw" {
				w.WriteHeader(401)
				_, _ = w.Write([]byte(`{"error":"wrong username or password"}`))
				return
			}
			payload["token"] = "tok"
		}
		if *mode == "tamper" {
			payload["nonce"] = "x"
		}
		d, _ := json.Marshal(payload)
		sig := ed25519.Sign(priv, d)
		_ = json.NewEncoder(w).Encode(map[string]string{"d": string(d), "sig": base64.StdEncoding.EncodeToString(sig)})
	}))
}

func TestLoginStatusOfflineGraceAnd401(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	der, _ := x509.MarshalPKIXPublicKey(pub)
	mode := "ok"
	srv := server(t, priv, &mode)
	defer srv.Close()
	a, err := auth.New(srv.URL, filepath.Join(t.TempDir(), "auth.json"), base64.StdEncoding.EncodeToString(der), "guid", 7)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	a.Now = func() time.Time { return now }
	if _, err := a.Login("bob", "nope"); err == nil {
		t.Fatal("bad password accepted")
	}
	v, err := a.Login("bob", "pw")
	if err != nil || !v.LoggedIn || !v.Active || v.Username != "bob" {
		t.Fatalf("login %+v %v", v, err)
	}
	mode = "tamper"
	if _, err := a.Post("/api/app/status", map[string]any{"token": "tok"}); err == nil {
		t.Fatal("tampered nonce accepted")
	}
	mode = "down"
	now = now.Add(2 * time.Minute)
	v = a.Status()
	if !v.Active || !v.Offline {
		t.Fatalf("offline grace should keep active: %+v", v)
	}
	now = now.Add(8 * 24 * time.Hour)
	v = a.Status()
	if v.Active {
		t.Fatalf("grace over: %+v", v)
	}
	mode = "401"
	v = a.Status() // retried at most once a minute: still the offline view
	if !v.LoggedIn {
		t.Fatal("should not have asked the server yet")
	}
	now = now.Add(2 * time.Minute)
	v = a.Status()
	if v.LoggedIn {
		t.Fatalf("401 must log out: %+v", v)
	}
}

func TestRealServerKeyParses(t *testing.T) {
	if _, err := auth.New("https://fpsboost.ir", "", "MCowBQYDK2VwAyEA1d/ViohKoa82uZmqlMWyFa/YoHlQxMI7G3W35wdW3iU=", "", 7); err != nil {
		t.Fatal(err)
	}
}
