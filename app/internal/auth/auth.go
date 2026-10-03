// Package auth logs the app into the site worker (/api/app/*), keeps the token on disk and tolerates being offline for
// a grace period after the last "active" answer. Every answer is { d: '<json>', sig }: d is signed by the server's
// Ed25519 key and echoes our nonce and machine id, so a fake server, a proxy rewriting "active" or a replayed old answer
// cannot unlock the app.
package auth

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// HTTPError carries the status so callers can tell "rejected" (401/403) from "unreachable".
type HTTPError struct {
	Status int
	Msg    string
}

func (e *HTTPError) Error() string { return e.Msg }

// cache is auth.json — the Electron app's format, so an existing login carries over.
type cache struct {
	Token    string `json:"token,omitempty"`
	Username string `json:"username,omitempty"`
	Active   bool   `json:"active,omitempty"`
	Expires  int64  `json:"expires,omitempty"`
	Checked  int64  `json:"checked,omitempty"`
	Offline  bool   `json:"offline,omitempty"`
}

// View is what the UI sees.
type View struct {
	LoggedIn bool   `json:"loggedIn"`
	Username string `json:"username"`
	Active   bool   `json:"active"`
	Expires  int64  `json:"expires"`
	Checked  int64  `json:"checked"`
	Offline  bool   `json:"offline"`
	Error    string `json:"error,omitempty"`
}

// Auth is the client.
type Auth struct {
	ServerURL string
	File      string
	Grace     time.Duration
	Client    *http.Client
	MachineID string // sha256(MachineGuid|hostname)[:32]
	key       ed25519.PublicKey

	mu        sync.Mutex
	c         *cache
	lastTry   time.Time
	lastError string
	Now       func() time.Time
}

// New parses the SPKI public key. machineGUID is Windows' HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid ("" when unknown).
func New(serverURL, file, pubKeyB64, machineGUID string, graceDays int) (*Auth, error) {
	der, err := base64.StdEncoding.DecodeString(pubKeyB64)
	if err != nil {
		return nil, err
	}
	pk, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, err
	}
	ed, ok := pk.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("server key is not Ed25519")
	}
	host, _ := os.Hostname()
	sum := sha256.Sum256([]byte(machineGUID + "|" + host))
	return &Auth{
		ServerURL: strings.TrimRight(serverURL, "/"), File: file, Grace: time.Duration(graceDays) * 24 * time.Hour,
		Client: &http.Client{Timeout: 10 * time.Second}, MachineID: hex.EncodeToString(sum[:])[:32], key: ed, Now: time.Now,
	}, nil
}

func (a *Auth) load() *cache {
	if a.c == nil {
		a.c = &cache{}
		if raw, err := os.ReadFile(a.File); err == nil {
			_ = json.Unmarshal(raw, a.c)
		}
	}
	return a.c
}

func (a *Auth) save() {
	_ = os.MkdirAll(filepath.Dir(a.File), 0o755)
	raw, _ := json.Marshal(a.c)
	_ = os.WriteFile(a.File, raw, 0o600)
}

func (a *Auth) nowMs() int64 { return a.Now().UnixMilli() }

// Post sends {body..., machine, nonce} and returns the verified payload.
func (a *Auth) Post(path string, body map[string]any) (map[string]any, error) {
	nb := make([]byte, 16)
	if _, err := rand.Read(nb); err != nil {
		return nil, err
	}
	nonce := hex.EncodeToString(nb)
	req := map[string]any{}
	for k, v := range body {
		req[k] = v
	}
	req["machine"] = a.MachineID
	req["nonce"] = nonce
	raw, _ := json.Marshal(req)
	resp, err := a.Client.Post(a.ServerURL+path, "application/json", bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("cannot reach %s", a.ServerURL)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var j struct {
		D     string `json:"d"`
		Sig   string `json:"sig"`
		Error string `json:"error"`
	}
	_ = json.Unmarshal(data, &j)
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		msg := j.Error
		if msg == "" {
			msg = "HTTP " + resp.Status
		}
		return nil, &HTTPError{Status: resp.StatusCode, Msg: msg}
	}
	sig, err := base64.StdEncoding.DecodeString(j.Sig)
	if err != nil || j.D == "" || !ed25519.Verify(a.key, []byte(j.D), sig) {
		return nil, errors.New("bad server signature")
	}
	var d map[string]any
	if err := json.Unmarshal([]byte(j.D), &d); err != nil {
		return nil, errors.New("bad server answer")
	}
	if d["nonce"] != nonce || d["machine"] != a.MachineID {
		return nil, errors.New("server answer does not match this request")
	}
	return d, nil
}

func str(v any) string {
	s, _ := v.(string)
	return s
}
func num(v any) int64 {
	f, _ := v.(float64)
	return int64(f)
}
func boolean(v any) bool {
	b, _ := v.(bool)
	return b
}

// Login signs in and stores the token.
func (a *Auth) Login(username, password string) (View, error) {
	d, err := a.Post("/api/app/login", map[string]any{"username": username, "password": password})
	if err != nil {
		return a.View(), err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.c = &cache{Token: str(d["token"]), Username: str(d["username"]), Active: boolean(d["active"]), Expires: num(d["expires"]), Checked: a.nowMs()}
	a.save()
	return a.view(), nil
}

// Logout forgets the token.
func (a *Auth) Logout() View {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.c = &cache{}
	a.save()
	return a.view()
}

func (a *Auth) view() View {
	c := a.load()
	return View{LoggedIn: c.Token != "", Username: c.Username, Active: c.Active && c.Expires > a.nowMs(), Expires: c.Expires, Checked: c.Checked, Offline: c.Offline}
}

// View is the cached state, no network.
func (a *Auth) View() View {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.view()
}

// Status asks the server when it is time to (at most once a minute); otherwise answers from the cache. Offline, the
// subscription stays active for the grace period after the last successful check.
func (a *Auth) Status() View {
	a.mu.Lock()
	defer a.mu.Unlock()
	c := a.load()
	if c.Token == "" {
		return a.view()
	}
	now := a.Now()
	if !c.Offline && now.UnixMilli()-c.Checked < 60_000 {
		return a.view()
	}
	if now.Sub(a.lastTry) < time.Minute {
		return a.offlineView(a.lastError)
	}
	a.lastTry = now
	token := c.Token
	a.mu.Unlock() // network without the lock
	d, err := a.Post("/api/app/status", map[string]any{"token": token})
	a.mu.Lock()
	c = a.load()
	if err != nil {
		var he *HTTPError
		if errors.As(err, &he) && (he.Status == 401 || he.Status == 403) { // token / device rejected: log in again
			a.c = &cache{}
			a.save()
			v := a.view()
			v.Error = err.Error()
			return v
		}
		c.Offline = true
		a.lastError = err.Error()
		a.save()
		return a.offlineView(a.lastError)
	}
	c.Active, c.Expires, c.Username, c.Checked, c.Offline = boolean(d["active"]), num(d["expires"]), str(d["username"]), a.nowMs(), false
	a.lastError = ""
	a.save()
	return a.view()
}

func (a *Auth) offlineView(errMsg string) View {
	c := a.load()
	v := a.view()
	v.Offline = true
	v.Error = errMsg
	fresh := a.Now().UnixMilli()-c.Checked < a.Grace.Milliseconds()
	v.Active = fresh && c.Active && c.Expires > a.nowMs()
	return v
}

// Active is the gate for tweaks: cached answer (refreshing when due).
func (a *Auth) Active() bool { return a.Status().Active }

func (a *Auth) token() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.load().Token
}

// authed posts with the stored token; a 401/403 answer logs the app out (the UI shows the login screen).
func (a *Auth) authed(path string, body map[string]any) (map[string]any, error) {
	tok := a.token()
	if tok == "" {
		return nil, errors.New("not logged in")
	}
	if body == nil {
		body = map[string]any{}
	}
	body["token"] = tok
	d, err := a.Post(path, body)
	if err != nil {
		var he *HTTPError
		if errors.As(err, &he) && (he.Status == 401 || he.Status == 403) && path != "/api/app/password" {
			a.mu.Lock()
			a.c = &cache{}
			a.save()
			a.mu.Unlock()
		}
		return nil, err
	}
	return d, nil
}

// Payment is one row of the account's payment history.
type Payment struct {
	At     int64  `json:"at"`
	Months int    `json:"months"`
	Amount int64  `json:"amount"`
	Status string `json:"status"`
	Ref    string `json:"ref,omitempty"`
}

// Account is the server's view of the account (the in-app account page).
type Account struct {
	Username string           `json:"username"`
	Active   bool             `json:"active"`
	Expires  int64            `json:"expires"`
	Created  int64            `json:"created"`
	Machines int              `json:"machines"`
	Max      int              `json:"max"`
	Support  string           `json:"support,omitempty"` // owner's support contact: email, https:// link or @telegram
	Prices   map[string]int64 `json:"prices,omitempty"`  // months → Toman
	Payments []Payment        `json:"payments"`
}

// Account fetches the account page data and refreshes the cached subscription from it.
func (a *Auth) Account() (*Account, error) {
	d, err := a.authed("/api/app/account", nil)
	if err != nil {
		return nil, err
	}
	acc := &Account{Username: str(d["username"]), Active: boolean(d["active"]), Expires: num(d["expires"]), Created: num(d["created"]), Machines: int(num(d["machines"])), Max: int(num(d["max"])), Support: str(d["support"]), Prices: map[string]int64{}}
	if pr, ok := d["prices"].(map[string]any); ok {
		for k, v := range pr {
			acc.Prices[k] = num(v)
		}
	}
	if ps, ok := d["payments"].([]any); ok {
		for _, x := range ps {
			if m, ok := x.(map[string]any); ok {
				acc.Payments = append(acc.Payments, Payment{At: num(m["at"]), Months: int(num(m["months"])), Amount: num(m["amount"]), Status: str(m["status"]), Ref: str(m["ref"])})
			}
		}
	}
	if acc.Payments == nil {
		acc.Payments = []Payment{}
	}
	a.mu.Lock()
	c := a.load()
	c.Active, c.Expires, c.Username, c.Checked, c.Offline = acc.Active, acc.Expires, acc.Username, a.nowMs(), false
	a.save()
	a.mu.Unlock()
	return acc, nil
}

// ChangePassword verifies the current password server-side and sets the new one. Other devices' app tokens and
// website sessions stay valid (tokens are not derived from the password).
func (a *Auth) ChangePassword(current, next string) error {
	if len(next) < 8 {
		return errors.New("the new password needs at least 8 characters")
	}
	if len(next) > 200 {
		return errors.New("the new password is too long")
	}
	_, err := a.authed("/api/app/password", map[string]any{"current": current, "password": next})
	return err
}

// ResetDevices forgets every other PC on the account; this one stays logged in. Returns the device count afterwards.
func (a *Auth) ResetDevices() (int, error) {
	d, err := a.authed("/api/app/devices", nil)
	if err != nil {
		return 0, err
	}
	return int(num(d["machines"])), nil
}

// Net is what the server sees of this connection.
type Net struct {
	ASN     int    `json:"asn"`
	Org     string `json:"org"`
	Country string `json:"country"`
	IP      string `json:"ip"`
}

// Net asks the server for the connection's ASN / organisation (ISP detection). No account needed.
func (a *Auth) Net() (*Net, error) {
	d, err := a.Post("/api/app/net", map[string]any{})
	if err != nil {
		return nil, err
	}
	return &Net{ASN: int(num(d["asn"])), Org: str(d["org"]), Country: str(d["country"]), IP: str(d["ip"])}, nil
}
