; FPS Boost installer pages (electron-builder nsis.include). Artwork: build/installerSidebar.bmp, installerHeader.bmp
; (regenerate with build/art/gen.py).

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to FPS Boost ${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "Higher FPS and lower ping in a few clicks.$\r$\n$\r$\nThis will install FPS Boost on your computer. Every change the app makes to Windows is backed up and can be undone from inside the app.$\r$\n$\r$\nClose your games before you continue, then click Next."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; The stock finish page launches the app through Explorer (StdUtils ExecShellAsUser). FPS Boost asks for administrator
; rights in its manifest, and that launch path hangs the installer on "Finish". ExecShell starts it directly: Windows
; shows the normal UAC prompt and the installer closes.
!macro customFinishPage
  Function StartApp
    ExecShell "open" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  FunctionEnd
  !define MUI_FINISHPAGE_TITLE "FPS Boost is ready"
  !define MUI_FINISHPAGE_TEXT "FPS Boost ${VERSION} has been installed.$\r$\n$\r$\nSign in with your fpsboost.ir account to start optimizing."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Launch FPS Boost"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_LINK "fpsboost.ir"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://fpsboost.ir"
  !insertmacro MUI_PAGE_FINISH
!macroend

; Local Wine test builds only (FPSB_WINE_TEST=1 npm run dist): Wine's tasklist/findstr always report the app as running,
; which blocks the install on a "FPS Boost is running" box. Real Windows builds keep the stock check.
!if "$%FPSB_WINE_TEST%" == "1"
  !macro customCheckAppRunning
  !macroend
!endif
