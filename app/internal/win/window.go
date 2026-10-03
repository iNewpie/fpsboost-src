//go:build windows

package win

import (
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Window is the frameless main window. The caption is removed (WM_NCCALCSIZE) while the resizable side / bottom borders
// stay Windows-owned, so snapping, resize cursors and maximize animations are the system's. The top TopInset logical
// pixels of the client area stay OURS (the WebView child starts below them): that strip is the top resize handle and is
// painted in the page background colour, so it reads as part of the title bar.
type Window struct {
	HWND     uintptr
	TopInset int // logical px kept above the child for the top resize edge (0 when maximized)
	MinW     int // logical px
	MinH     int

	OnClose    func() bool // true = really destroy
	OnSize     func(w, h int, maximized bool)
	OnActivate func()
	OnDestroy  func()
	OnDPI      func(dpi int)
	OnMove     func()

	class string
}

var (
	windowsMu sync.Mutex
	windowsBy = map[uintptr]*Window{}
	creating  *Window
	hInstance windows.Handle
	iconBig   uintptr
	iconSmall uintptr
	bgBrush   windows.Handle
	classes   = map[string]bool{}
)

func init() {
	_ = windows.GetModuleHandleEx(0, nil, &hInstance)
}

// LoadIcons loads the exe's icon resource (name) once — used by windows, the tray and dialogs.
func LoadIcons(resource string) {
	if iconBig != 0 {
		return
	}
	name := wstr(resource)
	iconBig, _, _ = pLoadImageW.Call(uintptr(hInstance), uintptr(unsafe.Pointer(name)), IMAGE_ICON, 0, 0, LR_DEFAULTSIZE|LR_SHARED)
	cx, _, _ := pGetSystemMetrics.Call(SM_CXSMICON)
	cy, _, _ := pGetSystemMetrics.Call(SM_CYSMICON)
	iconSmall, _, _ = pLoadImageW.Call(uintptr(hInstance), uintptr(unsafe.Pointer(name)), IMAGE_ICON, cx, cy, LR_SHARED)
	if iconSmall == 0 {
		iconSmall = iconBig
	}
}

// Background colour of the window class (behind the WebView) as 0x00BBGGRR.
func SetBackground(rgb uint32) {
	r, g, b := (rgb>>16)&0xff, (rgb>>8)&0xff, rgb&0xff
	h, _, _ := pCreateSolidBrush.Call(uintptr(b<<16 | g<<8 | r))
	bgBrush = windows.Handle(h)
}

func registerClass(name string, proc uintptr) {
	if classes[name] {
		return
	}
	cursor, _, _ := pLoadCursorW.Call(0, IDC_ARROW)
	wc := WndClassExW{
		CbSize: uint32(unsafe.Sizeof(WndClassExW{})), Style: CS_HREDRAW | CS_VREDRAW | CS_DBLCLKS, LpfnWndProc: proc,
		HInstance: hInstance, HIcon: windows.Handle(iconBig), HIconSm: windows.Handle(iconSmall), HCursor: windows.Handle(cursor),
		HbrBackground: bgBrush, LpszClassName: wstr(name),
	}
	pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	classes[name] = true
}

var mainWndProc = windows.NewCallback(func(hwnd uintptr, msg uint32, wp, lp uintptr) uintptr {
	windowsMu.Lock()
	w := windowsBy[hwnd]
	if w == nil && creating != nil {
		w = creating
		w.HWND = hwnd
		windowsBy[hwnd] = w
	}
	windowsMu.Unlock()
	if w == nil {
		r, _, _ := pDefWindowProcW.Call(hwnd, uintptr(msg), wp, lp)
		return r
	}
	return w.proc(msg, wp, lp)
})

// Placement is a remembered window position.
type Placement struct {
	X, Y, W, H int
	Max        bool
	Valid      bool
}

// Create makes and shows the window. w/h are logical pixels (scaled by the system DPI) unless a Placement is given.
func Create(title, class string, w, h int, p Placement, win *Window) *Window {
	registerClass(class, mainWndProc)
	win.class = class
	dpi := SystemDPI()
	scale := func(v int) int32 { return int32(v * dpi / 96) }
	const cwDefault = int32(-1 << 31) // CW_USEDEFAULT
	x, y := cwDefault, cwDefault
	cw, ch := scale(w), scale(h)
	if p.Valid && p.W > 200 && p.H > 150 {
		cw, ch = int32(p.W), int32(p.H)
		x, y = int32(p.X), int32(p.Y)
		// still on a monitor?
		pt := Point{X: x + cw/2, Y: y + ch/2}
		m, _, _ := pMonitorFromPoint.Call(uintptr(*(*uint64)(unsafe.Pointer(&pt))), 0)
		if m == 0 {
			x, y = cwDefault, cwDefault
		}
	}
	if x == cwDefault { // centre on the work area
		var wa Rect
		pSystemParametersInfoW.Call(SPI_GETWORKAREA, 0, uintptr(unsafe.Pointer(&wa)), 0)
		if wa.W() > 0 {
			if cw > wa.W() {
				cw = wa.W()
			}
			if ch > wa.H() {
				ch = wa.H()
			}
			x = wa.Left + (wa.W()-cw)/2
			y = wa.Top + (wa.H()-ch)/2
		}
	}
	windowsMu.Lock()
	creating = win
	windowsMu.Unlock()
	hwnd, _, _ := pCreateWindowExW.Call(WS_EX_APPWINDOW, uintptr(unsafe.Pointer(wstr(class))), uintptr(unsafe.Pointer(wstr(title))),
		WS_OVERLAPPEDWINDOW|WS_CLIPCHILDREN, uintptr(uint32(x)), uintptr(uint32(y)), uintptr(cw), uintptr(ch), 0, 0, uintptr(hInstance), 0)
	windowsMu.Lock()
	creating = nil
	if hwnd != 0 {
		win.HWND = hwnd
		windowsBy[hwnd] = win
	}
	windowsMu.Unlock()
	if hwnd == 0 {
		return nil
	}
	win.dwm()
	// make Windows re-run WM_NCCALCSIZE with our handler in place
	pSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0, SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_NOACTIVATE|SWP_FRAMECHANGED)
	cmd := uintptr(SW_SHOW)
	if p.Valid && p.Max {
		cmd = SW_SHOWMAXIMIZED
	}
	pShowWindow.Call(hwnd, cmd)
	pUpdateWindow.Call(hwnd)
	pSetFocus.Call(hwnd)
	return win
}

func (w *Window) dwm() {
	one := int32(1)
	pDwmSetWindowAttribute.Call(w.HWND, DWMWA_USE_IMMERSIVE_DARK_MODE, uintptr(unsafe.Pointer(&one)), 4)
	pDwmSetWindowAttribute.Call(w.HWND, DWMWA_USE_IMMERSIVE_DARK_MODE_OLD, uintptr(unsafe.Pointer(&one)), 4)
	round := int32(DWMWCP_ROUND)
	pDwmSetWindowAttribute.Call(w.HWND, DWMWA_WINDOW_CORNER_PREFERENCE, uintptr(unsafe.Pointer(&round)), 4)
	border := uint32(0x00302424) // 0x00BBGGRR: a dark violet edge on Windows 11
	pDwmSetWindowAttribute.Call(w.HWND, DWMWA_BORDER_COLOR, uintptr(unsafe.Pointer(&border)), 4)
	m := Margins{0, 0, 1, 0}
	pDwmExtendFrame.Call(w.HWND, uintptr(unsafe.Pointer(&m)))
}

// DPI of the window (96 = 100 %).
func (w *Window) DPI() int {
	if pGetDpiForWindow.Find() == nil {
		d, _, _ := pGetDpiForWindow.Call(w.HWND)
		if d > 0 {
			return int(d)
		}
	}
	return SystemDPI()
}

// SystemDPI is the primary monitor's DPI.
func SystemDPI() int {
	if pGetDpiForSystem.Find() == nil {
		d, _, _ := pGetDpiForSystem.Call()
		if d > 0 {
			return int(d)
		}
	}
	return 96
}

func (w *Window) frameY(dpi int) int32 {
	var f, p uintptr
	if pGetSystemMetricsForDpi.Find() == nil {
		f, _, _ = pGetSystemMetricsForDpi.Call(SM_CYFRAME, uintptr(dpi))
		p, _, _ = pGetSystemMetricsForDpi.Call(SM_CXPADDEDBORDER, uintptr(dpi))
	} else {
		f, _, _ = pGetSystemMetrics.Call(SM_CYFRAME)
		p, _, _ = pGetSystemMetrics.Call(SM_CXPADDEDBORDER)
	}
	return int32(f + p)
}

// Maximized reports the zoomed state.
func (w *Window) Maximized() bool {
	r, _, _ := pIsZoomed.Call(w.HWND)
	return r != 0
}

// Minimized reports the iconic state.
func (w *Window) Minimized() bool {
	r, _, _ := pIsIconic.Call(w.HWND)
	return r != 0
}

// ChildRect is where the WebView goes: the client area minus the top inset.
func (w *Window) ChildRect() Rect {
	var r Rect
	pGetClientRect.Call(w.HWND, uintptr(unsafe.Pointer(&r)))
	if !w.Maximized() {
		r.Top += int32(w.TopInset * w.DPI() / 96)
	}
	return r
}

func (w *Window) proc(msg uint32, wp, lp uintptr) uintptr {
	switch msg {
	case WM_NCCALCSIZE:
		if wp != 0 {
			p := (*NCCalcSizeParams)(unsafe.Pointer(lp))
			top := p.Rgrc[0].Top
			pDefWindowProcW.Call(w.HWND, uintptr(msg), wp, lp)
			p.Rgrc[0].Top = top // keep the whole height: no caption
			if w.Maximized() {
				p.Rgrc[0].Top += w.frameY(w.DPI())
			}
			return 0
		}
	case WM_NCHITTEST:
		r, _, _ := pDefWindowProcW.Call(w.HWND, uintptr(msg), wp, lp)
		if r == HTCLIENT && !w.Maximized() {
			x, y := loword(lp), hiword(lp)
			var wr Rect
			pGetWindowRect.Call(w.HWND, uintptr(unsafe.Pointer(&wr)))
			fy := w.frameY(w.DPI())
			if y < wr.Top+fy {
				switch {
				case x < wr.Left+fy*2:
					return HTTOPLEFT
				case x >= wr.Right-fy*2:
					return HTTOPRIGHT
				}
				return HTTOP
			}
			if y < wr.Top+int32(w.TopInset*w.DPI()/96) {
				return HTCAPTION // the rest of our strip drags the window
			}
		}
		return r
	case WM_GETMINMAXINFO:
		mmi := (*MinMaxInfo)(unsafe.Pointer(lp))
		dpi := w.DPI()
		if w.MinW > 0 {
			mmi.PtMinTrackSize.X = int32(w.MinW * dpi / 96)
		}
		if w.MinH > 0 {
			mmi.PtMinTrackSize.Y = int32(w.MinH * dpi / 96)
		}
		return 0
	case WM_SIZE:
		if wp != SIZE_MINIMIZED && w.OnSize != nil {
			w.OnSize(int(loword(lp)), int(hiword(lp)), wp == SIZE_MAXIMIZED)
		}
		return 0
	case WM_DPICHANGED:
		r := (*Rect)(unsafe.Pointer(lp))
		pSetWindowPos.Call(w.HWND, 0, uintptr(r.Left), uintptr(r.Top), uintptr(r.W()), uintptr(r.H()), SWP_NOZORDER|SWP_NOACTIVATE)
		if w.OnDPI != nil {
			w.OnDPI(int(hiword(wp)))
		}
		return 0
	case 0x0003, 0x0216: // WM_MOVE, WM_MOVING: WebView2 positions its popups (select dropdowns) from this
		if w.OnMove != nil {
			w.OnMove()
		}
	case WM_ACTIVATE:
		if wp&0xffff != 0 && w.OnActivate != nil {
			w.OnActivate()
		}
	case WM_SETFOCUS:
		if w.OnActivate != nil {
			w.OnActivate()
		}
		return 0
	case WM_CLOSE:
		if w.OnClose == nil || w.OnClose() {
			pDestroyWindow.Call(w.HWND)
		}
		return 0
	case WM_DESTROY:
		windowsMu.Lock()
		delete(windowsBy, w.HWND)
		windowsMu.Unlock()
		if w.OnDestroy != nil {
			w.OnDestroy()
		}
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(w.HWND, uintptr(msg), wp, lp)
	return r
}

// Drag starts a system move loop (used when the page's title bar is pressed and app-region is unsupported).
func (w *Window) Drag() {
	pReleaseCapture.Call()
	pSendMessageW.Call(w.HWND, WM_NCLBUTTONDOWN, HTCAPTION, 0)
}

// Minimize / ToggleMaximize / Close / Show / Hide.
func (w *Window) Minimize()     { pShowWindow.Call(w.HWND, SW_MINIMIZE) }
func (w *Window) Close()        { pPostMessageW.Call(w.HWND, WM_CLOSE, 0, 0) }
func (w *Window) Destroy()      { pDestroyWindow.Call(w.HWND) }
func (w *Window) Hide()         { pShowWindow.Call(w.HWND, SW_HIDE) }
func (w *Window) Visible() bool { r, _, _ := pIsWindowVisible.Call(w.HWND); return r != 0 }
func (w *Window) ToggleMaximize() {
	if w.Maximized() {
		pShowWindow.Call(w.HWND, SW_RESTORE)
	} else {
		pShowWindow.Call(w.HWND, SW_SHOWMAXIMIZED)
	}
}

// Show brings the window to the front (restoring it when minimized).
func (w *Window) Show() {
	if w.Minimized() {
		pShowWindow.Call(w.HWND, SW_RESTORE)
	} else {
		pShowWindow.Call(w.HWND, SW_SHOW)
	}
	pSetForegroundWindow.Call(w.HWND)
	pSetFocus.Call(w.HWND)
}

// Placement reads the normal (restored) rectangle + maximized flag for saving.
func (w *Window) Placement() Placement {
	var wp WindowPlacement
	wp.Length = uint32(unsafe.Sizeof(wp))
	if r, _, _ := pGetWindowPlacement.Call(w.HWND, uintptr(unsafe.Pointer(&wp))); r == 0 {
		return Placement{}
	}
	n := wp.RcNormalPosition
	return Placement{X: int(n.Left), Y: int(n.Top), W: int(n.W()), H: int(n.H()), Max: wp.ShowCmd == SW_SHOWMAXIMIZED, Valid: true}
}

// SetTitle changes the caption (task bar text).
func (w *Window) SetTitle(t string) {
	pSendMessageW.Call(w.HWND, 0x000C /* WM_SETTEXT */, 0, uintptr(unsafe.Pointer(wstr(t))))
}
