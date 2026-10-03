//go:build windows

package win

import (
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// App owns the UI thread: a hidden message window (dispatch queue, tray icon, single-instance wake-up) and the loop.
type App struct {
	msgWnd   uintptr
	mu       sync.Mutex
	queue    []func()
	showMsg  uint32 // registered "FPSBoost.Show" message from a second instance
	taskbar  uint32 // "TaskbarCreated": explorer restarted, re-add the tray icon
	tray     *Tray
	OnShow   func() // second instance / tray click
	OnTray   func(event uint32, x, y int32)
	threadID uint32
}

var theApp *App

var msgWndProc = windows.NewCallback(func(hwnd uintptr, msg uint32, wp, lp uintptr) uintptr {
	a := theApp
	if a == nil {
		r, _, _ := pDefWindowProcW.Call(hwnd, uintptr(msg), wp, lp)
		return r
	}
	switch {
	case msg == WM_DISPATCH:
		a.mu.Lock()
		q := a.queue
		a.queue = nil
		a.mu.Unlock()
		for _, f := range q {
			f()
		}
		return 0
	case msg == WM_TRAY:
		if a.OnTray != nil {
			a.OnTray(uint32(lp&0xffff), loword(wp), hiword(wp))
		}
		return 0
	case msg == a.showMsg && a.showMsg != 0:
		if a.OnShow != nil {
			a.OnShow()
		}
		return 0
	case msg == a.taskbar && a.taskbar != 0:
		if a.tray != nil {
			a.tray.readd()
		}
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(hwnd, uintptr(msg), wp, lp)
	return r
})

const msgClass = "FPSBoost.Msg"

// NewApp must run on the locked main OS thread.
func NewApp() *App {
	a := &App{}
	theApp = a
	a.threadID = windows.GetCurrentThreadId()
	a.showMsg = registerMessage("FPSBoost.Show")
	a.taskbar = registerMessage("TaskbarCreated")
	registerClass(msgClass, msgWndProc)
	a.msgWnd, _, _ = pCreateWindowExW.Call(0, uintptr(unsafe.Pointer(wstr(msgClass))), uintptr(unsafe.Pointer(wstr("FPS Boost"))), 0, 0, 0, 0, 0, 0, 0, uintptr(hInstance), 0)
	return a
}

func registerMessage(name string) uint32 {
	r, _, _ := pRegisterWindowMessageW.Call(uintptr(unsafe.Pointer(wstr(name))))
	return uint32(r)
}

// Dispatch runs f on the UI thread.
func (a *App) Dispatch(f func()) {
	a.mu.Lock()
	a.queue = append(a.queue, f)
	a.mu.Unlock()
	pPostMessageW.Call(a.msgWnd, WM_DISPATCH, 0, 0)
}

// Run pumps messages until Quit.
func (a *App) Run() {
	var m Msg
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			return
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		pDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

// Quit ends Run (from any thread).
func (a *App) Quit() {
	a.Dispatch(func() {
		if a.tray != nil {
			a.tray.Remove()
		}
		pPostQuitMessage.Call(0)
	})
}

// WakeOther asks an already running instance to show itself. Returns true when one was found.
func WakeOther() bool {
	h, _, _ := pFindWindowW.Call(uintptr(unsafe.Pointer(wstr(msgClass))), 0)
	if h == 0 {
		return false
	}
	pPostMessageW.Call(h, uintptr(registerMessage("FPSBoost.Show")), 0, 0)
	return true
}

// SingleInstance takes the global mutex; false when another copy owns it.
func SingleInstance(name string) bool {
	_, err := windows.CreateMutex(nil, false, wstr(name))
	if err == windows.ERROR_ALREADY_EXISTS {
		return false
	}
	return true
}

// OnQuitRequest creates the named event and calls fn (from a background goroutine) once another process signals it.
func OnQuitRequest(event string, fn func()) {
	h, err := windows.CreateEvent(nil, 1, 0, wstr(event))
	if err != nil {
		return
	}
	go func() {
		windows.WaitForSingleObject(h, windows.INFINITE)
		fn()
	}()
}

// QuitOther signals the running instance's quit event and waits until its single-instance mutex is free. False when
// no instance was running (nothing to do, reported as success) is not distinguished: the result is "the instance is
// gone within the timeout".
func QuitOther(mutex, event string, timeout time.Duration) bool {
	h, err := windows.OpenEvent(windows.EVENT_MODIFY_STATE, false, wstr(event))
	if err != nil {
		// no instance with the event (not running, or an older version): tell the caller to fall back
		return !otherRunning(mutex)
	}
	windows.SetEvent(h)
	windows.CloseHandle(h)
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if !otherRunning(mutex) {
			return true
		}
		time.Sleep(200 * time.Millisecond)
	}
	return false
}

func otherRunning(mutex string) bool {
	m, err := windows.CreateMutex(nil, false, wstr(mutex))
	exists := err == windows.ERROR_ALREADY_EXISTS
	if m != 0 {
		windows.CloseHandle(m)
	}
	return exists
}

// HasTray reports whether the tray icon exists.
func (a *App) HasTray() bool { return a.tray != nil && !a.tray.done }

/* ---- tray icon ---- */

// Tray is the notification-area icon.
type Tray struct {
	app  *App
	nid  NotifyIconData
	tip  string
	done bool
}

// Tray creates (once) the tray icon with a tooltip.
func (a *App) Tray(tip string) *Tray {
	if a.tray != nil {
		a.tray.SetTip(tip)
		return a.tray
	}
	t := &Tray{app: a, tip: tip}
	t.nid = NotifyIconData{HWnd: a.msgWnd, UID: 1, UFlags: NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP, UCallbackMessage: WM_TRAY, HIcon: iconSmall}
	t.nid.CbSize = uint32(unsafe.Sizeof(t.nid))
	copyTip(&t.nid, tip)
	t.add()
	a.tray = t
	return t
}

func copyTip(nid *NotifyIconData, tip string) {
	u, _ := windows.UTF16FromString(tip)
	n := copy(nid.SzTip[:127], u)
	nid.SzTip[n] = 0
}

func (t *Tray) add() {
	pShellNotifyIconW.Call(NIM_ADD, uintptr(unsafe.Pointer(&t.nid)))
	t.nid.UVersion = NOTIFYICON_VERSION_4
	pShellNotifyIconW.Call(NIM_SETVERSION, uintptr(unsafe.Pointer(&t.nid)))
}

func (t *Tray) readd() {
	if !t.done {
		t.add()
	}
}

// SetTip updates the tooltip.
func (t *Tray) SetTip(tip string) {
	t.tip = tip
	copyTip(&t.nid, tip)
	t.nid.UFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP
	pShellNotifyIconW.Call(NIM_MODIFY, uintptr(unsafe.Pointer(&t.nid)))
}

// Balloon shows a notification bubble.
func (t *Tray) Balloon(title, text string) {
	nid := t.nid
	nid.UFlags = NIF_INFO | NIF_ICON | NIF_MESSAGE | NIF_TIP | NIF_SHOWTIP
	nid.DwInfoFlags = NIIF_USER | NIIF_LARGE_ICON
	nid.HBalloonIcon = iconBig
	u, _ := windows.UTF16FromString(text)
	copy(nid.SzInfo[:255], u)
	u, _ = windows.UTF16FromString(title)
	copy(nid.SzInfoTitle[:63], u)
	pShellNotifyIconW.Call(NIM_MODIFY, uintptr(unsafe.Pointer(&nid)))
}

// Remove deletes the icon.
func (t *Tray) Remove() {
	t.done = true
	pShellNotifyIconW.Call(NIM_DELETE, uintptr(unsafe.Pointer(&t.nid)))
}

// MenuItem of the tray menu. ID 0 = separator.
type MenuItem struct {
	ID       int
	Text     string
	Checked  bool
	Disabled bool
	Default  bool
}

// Menu shows the tray context menu at the cursor and returns the chosen ID (0 = none). rtl flips the layout for Persian.
func (a *App) Menu(items []MenuItem, rtl bool) int {
	h, _, _ := pCreatePopupMenu.Call()
	defer pDestroyMenu.Call(h)
	for _, it := range items {
		if it.ID == 0 {
			pAppendMenuW.Call(h, MF_SEPARATOR, 0, 0)
			continue
		}
		flags := uintptr(MF_STRING)
		if it.Checked {
			flags |= MF_CHECKED
		}
		if it.Disabled {
			flags |= MF_GRAYED
		}
		pAppendMenuW.Call(h, flags, uintptr(it.ID), uintptr(unsafe.Pointer(wstr(it.Text))))
		if it.Default {
			pSetMenuDefaultItem.Call(h, uintptr(it.ID), 0)
		}
	}
	var pt Point
	pGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	pSetForegroundWindow.Call(a.msgWnd)
	flags := uintptr(TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_BOTTOMALIGN)
	if rtl {
		flags |= TPM_LAYOUTRTL
	}
	id, _, _ := pTrackPopupMenu.Call(h, flags, uintptr(pt.X), uintptr(pt.Y), 0, a.msgWnd, 0)
	pPostMessageW.Call(a.msgWnd, WM_NULL, 0, 0)
	return int(id)
}

/* ---- dialogs ---- */

// MessageBox shows a modal box; returns the button id.
func MessageBox(title, text string, flags uint32) int {
	r, _, _ := pMessageBoxW.Call(0, uintptr(unsafe.Pointer(wstr(text))), uintptr(unsafe.Pointer(wstr(title))), uintptr(flags|MB_SETFOREGROUND))
	return int(r)
}

// OpenURL opens a link in the default browser.
func OpenURL(url string) {
	pShellExecuteW.Call(0, uintptr(unsafe.Pointer(wstr("open"))), uintptr(unsafe.Pointer(wstr(url))), 0, 0, SW_SHOWNORMAL)
}
