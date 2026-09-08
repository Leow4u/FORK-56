; Packaged Windows self-update: silent `/S` skips the assisted finish page,
; and electron-builder only StartApp in that case when `--force-run` is set.
; Older desktops spawned Setup.exe without that flag, so the app installed
; and stayed closed. Launch here when silent AND the caller forgot --force-run
; (the new client also passes --force-run; skip to avoid a double start).

!macro customInstall
  ${if} ${Silent}
    ${ifNot} ${isForceRun}
      HideWindow
      !insertmacro StartApp
    ${endIf}
  ${endIf}
!macroend
