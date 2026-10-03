//go:build windows

// Package webui hosts the HTML UI in a WebView2 inside the frameless window, serves the embedded assets from memory
// (https://app.fpsboost.internal/…) and carries the JSON-RPC between the page and Go. The window + browser are created
// on demand and destroyed when the user closes to the tray, so the background footprint is the Go process alone.
package webui

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"mime"
	"net/url"
	"path"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"

	"fpsboost.ir/app/internal/win"
)

const origin = "https://app.fpsboost.internal"

// Handler answers one RPC method. args are the JSON arguments from the page.
type Handler func(args []json.RawMessage) (any, error)

// Host is the window + WebView2 pair.
type Host struct {
	App     *win.App
	Assets  fs.FS
	DataDir string
	Debug   bool
	Title   string
	Class   string
	InitJS  func() string // script run before every document (host info for the page)
	OnClose func() bool   // true = destroy (close to tray handled by the caller)
	OnGone  func()        // after the window is destroyed
	OnReady func()        // page loaded

	mu       sync.Mutex
	handlers map[string]Handler
	win      *win.Window
	chrome   *edge.Chromium
	ready    bool
	pending  []string
	bg       uint32
}

// New prepares a host; nothing is created until Open.
func New(app *win.App, assets fs.FS, dataDir string) *Host {
	return &Host{App: app, Assets: assets, DataDir: dataDir, handlers: map[string]Handler{}, Class: "FPSBoost.Main", Title: "FPS Boost", bg: 0x0b0c12}
}

// Handle registers an RPC method.
func (h *Host) Handle(name string, fn Handler) {
	h.mu.Lock()
	h.handlers[name] = fn
	h.mu.Unlock()
}

// Window returns the live window (nil when closed).
func (h *Host) Window() *win.Window {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.win
}

// IsOpen reports whether the window exists.
func (h *Host) IsOpen() bool { return h.Window() != nil }

// Open creates the window and the browser. Must run on the UI thread.
func (h *Host) Open(p win.Placement) error {
	if h.IsOpen() {
		h.win.Show()
		return nil
	}
	win.SetBackground(h.bg)
	w := &win.Window{TopInset: 6, MinW: 900, MinH: 600}
	w.OnClose = func() bool {
		if h.OnClose != nil && !h.OnClose() {
			return false
		}
		h.teardownBrowser()
		return true
	}
	w.OnDestroy = func() {
		h.mu.Lock()
		h.win = nil
		h.ready = false
		h.pending = nil
		h.mu.Unlock()
		if h.OnGone != nil {
			h.OnGone()
		}
	}
	w.OnSize = func(_, _ int, max bool) {
		h.layout()
		h.Emit("win", map[string]bool{"max": max})
	}
	w.OnDPI = func(int) { h.layout() }
	w.OnActivate = func() {
		if c := h.chromium(); c != nil {
			c.Focus()
		}
	}
	w.OnMove = func() {
		if c := h.chromium(); c != nil {
			_ = c.NotifyParentWindowPositionChanged()
		}
	}
	if win.Create(h.Title, h.Class, 1060, 700, p, w) == nil {
		return fmt.Errorf("cannot create the window")
	}
	h.mu.Lock()
	h.win = w
	h.mu.Unlock()

	c := edge.NewChromium()
	c.DataPath = h.DataDir + `\webview`
	c.MessageCallback = h.onMessage
	c.WebResourceRequestedCallback = h.onResource
	c.NavigationCompletedCallback = func(*edge.ICoreWebView2, *edge.ICoreWebView2NavigationCompletedEventArgs) { h.onReady() }
	c.SetPermission(edge.CoreWebView2PermissionKindClipboardRead, edge.CoreWebView2PermissionStateAllow)
	if !c.Embed(w.HWND) {
		w.Destroy()
		return fmt.Errorf("WebView2 could not start")
	}
	h.mu.Lock()
	h.chrome = c
	h.mu.Unlock()
	h.configure(c)
	h.layout()
	if h.InitJS != nil {
		c.Init(h.InitJS())
	}
	c.AddWebResourceRequestedFilter(origin+"/*", edge.COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)
	c.Navigate(origin + "/index.html")
	return nil
}

func (h *Host) chromium() *edge.Chromium {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.chrome
}

func (h *Host) configure(c *edge.Chromium) {
	s, err := c.GetSettings()
	if err != nil {
		log.Printf("webview settings: %v", err)
		return
	}
	_ = s.PutAreDefaultContextMenusEnabled(h.Debug)
	_ = s.PutAreDevToolsEnabled(h.Debug)
	_ = s.PutIsStatusBarEnabled(false)
	_ = s.PutIsZoomControlEnabled(false)
	_ = s.PutIsBuiltInErrorPageEnabled(false)
	_ = s.PutAreBrowserAcceleratorKeysEnabled(h.Debug)
	_ = s.PutIsPinchZoomEnabled(false)
	_ = s.PutIsSwipeNavigationEnabled(false)
	putNonClientRegion(unsafe.Pointer(s))
	if c2 := c.GetController().GetICoreWebView2Controller2(); c2 != nil {
		_ = c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: uint8(h.bg >> 16), G: uint8(h.bg >> 8), B: uint8(h.bg)})
	}
}

// putNonClientRegion enables `app-region: drag` (ICoreWebView2Settings9, WebView2 runtime 123+). Silently ignored on
// older runtimes — the page then falls back to asking Go to start a drag.
func putNonClientRegion(settings unsafe.Pointer) {
	iid := windows.GUID{Data1: 0x0528a73b, Data2: 0xe92d, Data3: 0x49f4, Data4: [8]byte{0x92, 0x7a, 0xe5, 0x47, 0xdd, 0xda, 0xa3, 0x7d}}
	obj := uintptr(settings)
	vtbl := *(*[64]uintptr)(*(*unsafe.Pointer)(settings))
	var s9 uintptr
	hr, _, _ := syscall.SyscallN(vtbl[0], obj, uintptr(unsafe.Pointer(&iid)), uintptr(unsafe.Pointer(&s9)))
	if int32(hr) < 0 || s9 == 0 {
		return
	}
	vt9 := *(*[64]uintptr)(*(*unsafe.Pointer)(unsafe.Pointer(s9)))
	syscall.SyscallN(vt9[38], s9, 1) // put_IsNonClientRegionSupportEnabled(TRUE)
	syscall.SyscallN(vt9[2], s9)     // Release
}

// layout fits the browser under the top strip.
func (h *Host) layout() {
	h.mu.Lock()
	w, c := h.win, h.chrome
	h.mu.Unlock()
	if w == nil || c == nil {
		return
	}
	r := w.ChildRect()
	ctrl := c.GetController()
	if ctrl == nil {
		return
	}
	obj := uintptr(unsafe.Pointer(ctrl))
	vtbl := *(*[64]uintptr)(*(*unsafe.Pointer)(unsafe.Pointer(ctrl)))
	syscall.SyscallN(vtbl[6], obj, uintptr(unsafe.Pointer(&r))) // put_Bounds(RECT) — x64 passes the struct by pointer
}

// teardownBrowser closes the WebView2 controller so the browser processes exit.
func (h *Host) teardownBrowser() {
	h.mu.Lock()
	c := h.chrome
	h.chrome = nil
	h.ready = false
	h.mu.Unlock()
	if c == nil {
		return
	}
	if ctrl := c.GetController(); ctrl != nil {
		obj := uintptr(unsafe.Pointer(ctrl))
		vtbl := *(*[64]uintptr)(*(*unsafe.Pointer)(unsafe.Pointer(ctrl)))
		syscall.SyscallN(vtbl[24], obj) // Close()
	}
}

// Close destroys the window (and browser). UI thread.
func (h *Host) Close() {
	if w := h.Window(); w != nil {
		h.teardownBrowser()
		w.Destroy()
	}
}

/* ---- assets ---- */

func (h *Host) onResource(req *edge.ICoreWebView2WebResourceRequest, args *edge.ICoreWebView2WebResourceRequestedEventArgs) {
	c := h.chromium()
	if c == nil {
		return
	}
	uri, err := req.GetUri()
	if err != nil {
		return
	}
	u, err := url.Parse(uri)
	status, reason, body, ctype := 404, "Not Found", []byte("not found"), "text/plain"
	if err == nil {
		p := strings.TrimPrefix(path.Clean("/"+u.Path), "/")
		if p == "" {
			p = "index.html"
		}
		if data, err := fs.ReadFile(h.Assets, p); err == nil {
			status, reason, body = 200, "OK", data
			ctype = mime.TypeByExtension(path.Ext(p))
			if ctype == "" {
				ctype = "application/octet-stream"
			}
		}
	}
	resp, err := c.Environment().CreateWebResourceResponse(body, status, reason, "Content-Type: "+ctype+"\r\nCache-Control: no-store")
	if err != nil || resp == nil {
		return
	}
	_ = args.PutResponse(resp)
	vtbl := *(*[8]uintptr)(*(*unsafe.Pointer)(unsafe.Pointer(resp)))
	syscall.SyscallN(vtbl[2], uintptr(unsafe.Pointer(resp))) // Release
}

/* ---- RPC ---- */

type rpcMsg struct {
	ID int               `json:"id"`
	M  string            `json:"m"`
	A  []json.RawMessage `json:"a"`
}

func (h *Host) onMessage(msg string) {
	var m rpcMsg
	if err := json.Unmarshal([]byte(msg), &m); err != nil || m.M == "" {
		return
	}
	h.mu.Lock()
	fn := h.handlers[m.M]
	h.mu.Unlock()
	go func() { // never block the UI thread
		var (
			res any
			err error
		)
		if fn == nil {
			err = fmt.Errorf("unknown method %s", m.M)
		} else {
			func() {
				defer func() {
					if r := recover(); r != nil {
						err = fmt.Errorf("%s crashed: %v", m.M, r)
						log.Printf("rpc %s panic: %v", m.M, r)
					}
				}()
				res, err = fn(m.A)
			}()
		}
		if err != nil {
			h.Eval(fmt.Sprintf("window.__rpc&&__rpc(%d,false,%s)", m.ID, jsonStr(err.Error())))
			return
		}
		b, jerr := json.Marshal(res)
		if jerr != nil {
			h.Eval(fmt.Sprintf("window.__rpc&&__rpc(%d,false,%s)", m.ID, jsonStr(jerr.Error())))
			return
		}
		h.Eval(fmt.Sprintf("window.__rpc&&__rpc(%d,true,%s)", m.ID, string(b)))
	}()
}

func jsonStr(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// Eval runs JavaScript on the UI thread (queued until the page is ready).
func (h *Host) Eval(js string) {
	h.App.Dispatch(func() {
		h.mu.Lock()
		c, ready := h.chrome, h.ready
		if c != nil && !ready {
			h.pending = append(h.pending, js)
		}
		h.mu.Unlock()
		if c != nil && ready {
			c.Eval(js)
		}
	})
}

// Emit sends an event to the page: window.__ev(name, payload).
func (h *Host) Emit(name string, payload any) {
	b, _ := json.Marshal(payload)
	h.Eval(fmt.Sprintf("window.__ev&&__ev(%s,%s)", jsonStr(name), string(b)))
}

func (h *Host) onReady() {
	h.mu.Lock()
	h.ready = true
	q := h.pending
	h.pending = nil
	c := h.chrome
	h.mu.Unlock()
	if c != nil {
		for _, js := range q {
			c.Eval(js)
		}
	}
	if h.OnReady != nil {
		h.OnReady()
	}
}
