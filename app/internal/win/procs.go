//go:build windows

// Package win is the thin Win32 layer: the frameless main window, the tray icon + menu, the message loop, dialogs,
// process / memory helpers for the guard, hidden command execution and the start-with-Windows scheduled task.
package win

import (
	"golang.org/x/sys/windows"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	dwmapi   = windows.NewLazySystemDLL("dwmapi.dll")
	shell32  = windows.NewLazySystemDLL("shell32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	ntdll    = windows.NewLazySystemDLL("ntdll.dll")

	pRegisterClassExW         = user32.NewProc("RegisterClassExW")
	pCreateWindowExW          = user32.NewProc("CreateWindowExW")
	pDefWindowProcW           = user32.NewProc("DefWindowProcW")
	pDestroyWindow            = user32.NewProc("DestroyWindow")
	pShowWindow               = user32.NewProc("ShowWindow")
	pUpdateWindow             = user32.NewProc("UpdateWindow")
	pGetMessageW              = user32.NewProc("GetMessageW")
	pTranslateMessage         = user32.NewProc("TranslateMessage")
	pDispatchMessageW         = user32.NewProc("DispatchMessageW")
	pPostMessageW             = user32.NewProc("PostMessageW")
	pSendMessageW             = user32.NewProc("SendMessageW")
	pPostQuitMessage          = user32.NewProc("PostQuitMessage")
	pGetClientRect            = user32.NewProc("GetClientRect")
	pGetWindowRect            = user32.NewProc("GetWindowRect")
	pSetWindowPos             = user32.NewProc("SetWindowPos")
	pIsZoomed                 = user32.NewProc("IsZoomed")
	pIsIconic                 = user32.NewProc("IsIconic")
	pIsWindowVisible          = user32.NewProc("IsWindowVisible")
	pGetSystemMetrics         = user32.NewProc("GetSystemMetrics")
	pGetSystemMetricsForDpi   = user32.NewProc("GetSystemMetricsForDpi")
	pGetDpiForWindow          = user32.NewProc("GetDpiForWindow")
	pGetDpiForSystem          = user32.NewProc("GetDpiForSystem")
	pSetFocus                 = user32.NewProc("SetFocus")
	pReleaseCapture           = user32.NewProc("ReleaseCapture")
	pGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	pSetForegroundWindow      = user32.NewProc("SetForegroundWindow")
	pGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	pLoadImageW               = user32.NewProc("LoadImageW")
	pLoadCursorW              = user32.NewProc("LoadCursorW")
	pCreatePopupMenu          = user32.NewProc("CreatePopupMenu")
	pAppendMenuW              = user32.NewProc("AppendMenuW")
	pSetMenuDefaultItem       = user32.NewProc("SetMenuDefaultItem")
	pTrackPopupMenu           = user32.NewProc("TrackPopupMenu")
	pDestroyMenu              = user32.NewProc("DestroyMenu")
	pGetCursorPos             = user32.NewProc("GetCursorPos")
	pRegisterWindowMessageW   = user32.NewProc("RegisterWindowMessageW")
	pFindWindowW              = user32.NewProc("FindWindowW")
	pMessageBoxW              = user32.NewProc("MessageBoxW")
	pGetWindowPlacement       = user32.NewProc("GetWindowPlacement")
	pSetWindowPlacement       = user32.NewProc("SetWindowPlacement")
	pMonitorFromWindow        = user32.NewProc("MonitorFromWindow")
	pMonitorFromPoint         = user32.NewProc("MonitorFromPoint")
	pGetMonitorInfoW          = user32.NewProc("GetMonitorInfoW")
	pSystemParametersInfoW    = user32.NewProc("SystemParametersInfoW")
	pGetWindowLongPtrW        = user32.NewProc("GetWindowLongPtrW")
	pSetWindowLongPtrW        = user32.NewProc("SetWindowLongPtrW")
	pCreateSolidBrush         = gdi32.NewProc("CreateSolidBrush")
	pDwmSetWindowAttribute    = dwmapi.NewProc("DwmSetWindowAttribute")
	pDwmExtendFrame           = dwmapi.NewProc("DwmExtendFrameIntoClientArea")
	pShellNotifyIconW         = shell32.NewProc("Shell_NotifyIconW")
	pShellExecuteW            = shell32.NewProc("ShellExecuteW")
	pGlobalMemoryStatusEx     = kernel32.NewProc("GlobalMemoryStatusEx")
	pEmptyWorkingSet          = kernel32.NewProc("K32EmptyWorkingSet")
	pGetPriorityClass         = kernel32.NewProc("GetPriorityClass")
	pNtSetTimerResolution     = ntdll.NewProc("NtSetTimerResolution")
	pNtSetSystemInformation   = ntdll.NewProc("NtSetSystemInformation")
)

const (
	WM_NULL            = 0x0000
	WM_CREATE          = 0x0001
	WM_DESTROY         = 0x0002
	WM_SIZE            = 0x0005
	WM_ACTIVATE        = 0x0006
	WM_SETFOCUS        = 0x0007
	WM_CLOSE           = 0x0010
	WM_QUIT            = 0x0012
	WM_GETMINMAXINFO   = 0x0024
	WM_NCCALCSIZE      = 0x0083
	WM_NCHITTEST       = 0x0084
	WM_NCLBUTTONDOWN   = 0x00A1
	WM_NCLBUTTONDBLCLK = 0x00A3
	WM_COMMAND         = 0x0111
	WM_SYSCOMMAND      = 0x0112
	WM_LBUTTONUP       = 0x0202
	WM_LBUTTONDBLCLK   = 0x0203
	WM_RBUTTONUP       = 0x0205
	WM_CONTEXTMENU     = 0x007B
	WM_DPICHANGED      = 0x02E0
	WM_APP             = 0x8000
	WM_DISPATCH        = WM_APP + 1
	WM_TRAY            = WM_APP + 2

	NIN_SELECT           = 0x0400
	NIN_KEYSELECT        = 0x0401
	NIN_BALLOONUSERCLICK = 0x0405

	WS_OVERLAPPEDWINDOW = 0x00CF0000
	WS_CLIPCHILDREN     = 0x02000000
	WS_POPUP            = 0x80000000
	WS_EX_APPWINDOW     = 0x00040000
	WS_EX_TOOLWINDOW    = 0x00000080
	CW_USEDEFAULT       = 0x80000000

	SW_HIDE          = 0
	SW_SHOW          = 5
	SW_MINIMIZE      = 6
	SW_RESTORE       = 9
	SW_SHOWMAXIMIZED = 3
	SW_SHOWNORMAL    = 1

	SWP_NOZORDER     = 0x0004
	SWP_NOACTIVATE   = 0x0010
	SWP_FRAMECHANGED = 0x0020
	SWP_NOMOVE       = 0x0002
	SWP_NOSIZE       = 0x0001

	HTCLIENT      = 1
	HTCAPTION     = 2
	HTLEFT        = 10
	HTRIGHT       = 11
	HTTOP         = 12
	HTTOPLEFT     = 13
	HTTOPRIGHT    = 14
	HTBOTTOM      = 15
	HTBOTTOMLEFT  = 16
	HTBOTTOMRIGHT = 17

	SIZE_RESTORED  = 0
	SIZE_MINIMIZED = 1
	SIZE_MAXIMIZED = 2

	SM_CXSCREEN       = 0
	SM_CYSCREEN       = 1
	SM_CXSMICON       = 49
	SM_CYSMICON       = 50
	SM_CYFRAME        = 33
	SM_CXPADDEDBORDER = 92

	GWL_STYLE = -16

	IMAGE_ICON      = 1
	LR_DEFAULTCOLOR = 0
	LR_SHARED       = 0x8000
	LR_DEFAULTSIZE  = 0x0040
	IDC_ARROW       = 32512
	COLOR_WINDOW    = 5
	CS_HREDRAW      = 0x0002
	CS_VREDRAW      = 0x0001
	CS_DBLCLKS      = 0x0008

	MF_STRING       = 0x0000
	MF_SEPARATOR    = 0x0800
	MF_CHECKED      = 0x0008
	MF_GRAYED       = 0x0001
	TPM_RETURNCMD   = 0x0100
	TPM_RIGHTBUTTON = 0x0002
	TPM_BOTTOMALIGN = 0x0020
	TPM_LAYOUTRTL   = 0x8000

	NIM_ADD              = 0
	NIM_MODIFY           = 1
	NIM_DELETE           = 2
	NIM_SETVERSION       = 4
	NIF_MESSAGE          = 0x01
	NIF_ICON             = 0x02
	NIF_TIP              = 0x04
	NIF_INFO             = 0x10
	NIF_SHOWTIP          = 0x80
	NIIF_INFO            = 0x01
	NIIF_USER            = 0x04
	NIIF_LARGE_ICON      = 0x20
	NOTIFYICON_VERSION_4 = 4

	MB_OK            = 0x0
	MB_YESNO         = 0x4
	MB_ICONERROR     = 0x10
	MB_ICONWARNING   = 0x30
	MB_ICONINFO      = 0x40
	MB_SETFOREGROUND = 0x10000
	IDYES            = 6

	DWMWA_USE_IMMERSIVE_DARK_MODE     = 20
	DWMWA_USE_IMMERSIVE_DARK_MODE_OLD = 19
	DWMWA_WINDOW_CORNER_PREFERENCE    = 33
	DWMWA_BORDER_COLOR                = 34
	DWMWCP_ROUND                      = 2

	SPI_GETWORKAREA          = 0x0030
	MONITOR_DEFAULTTONEAREST = 2
	MONITOR_DEFAULTTOPRIMARY = 1

	HIGH_PRIORITY_CLASS         = 0x00000080
	ABOVE_NORMAL_PRIORITY_CLASS = 0x00008000
	NORMAL_PRIORITY_CLASS       = 0x00000020
	CREATE_NO_WINDOW            = 0x08000000
)

type Point struct{ X, Y int32 }
type Rect struct{ Left, Top, Right, Bottom int32 }

func (r Rect) W() int32 { return r.Right - r.Left }
func (r Rect) H() int32 { return r.Bottom - r.Top }

type Msg struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      Point
	_       uint32
}

type WndClassExW struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     windows.Handle
	HIcon         windows.Handle
	HCursor       windows.Handle
	HbrBackground windows.Handle
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       windows.Handle
}

type MinMaxInfo struct {
	PtReserved, PtMaxSize, PtMaxPosition, PtMinTrackSize, PtMaxTrackSize Point
}

type NCCalcSizeParams struct {
	Rgrc  [3]Rect
	Lppos uintptr
}

type MonitorInfo struct {
	CbSize    uint32
	RcMonitor Rect
	RcWork    Rect
	DwFlags   uint32
}

type WindowPlacement struct {
	Length           uint32
	Flags            uint32
	ShowCmd          uint32
	PtMinPosition    Point
	PtMaxPosition    Point
	RcNormalPosition Rect
	RcDevice         Rect
}

type Margins struct{ Left, Right, Top, Bottom int32 }

type NotifyIconData struct {
	CbSize           uint32
	HWnd             uintptr
	UID              uint32
	UFlags           uint32
	UCallbackMessage uint32
	HIcon            uintptr
	SzTip            [128]uint16
	DwState          uint32
	DwStateMask      uint32
	SzInfo           [256]uint16
	UVersion         uint32
	SzInfoTitle      [64]uint16
	DwInfoFlags      uint32
	GuidItem         windows.GUID
	HBalloonIcon     uintptr
}

type MemoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

func wstr(s string) *uint16 {
	p, _ := windows.UTF16PtrFromString(s)
	return p
}

func loword(v uintptr) int32 { return int32(int16(v & 0xffff)) }
func hiword(v uintptr) int32 { return int32(int16((v >> 16) & 0xffff)) }
