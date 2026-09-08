; Packaged Windows self-update: silent `/S` skips the assisted finish page,
; and electron-builder only StartApp in that case when `--force-run` is set.
; Older desktops spawned Setup.exe without that flag, so the app installed
; and stayed closed. Launch here when silent AND the caller forgot --force-run
; (the new client also passes --force-run; skip to avoid a double start).
;
; Do NOT `!insertmacro StartApp` here. That macro does `Var /GLOBAL startAppArgs`
; on every insert. installSection.nsh later inserts StartApp via doStartApp, and
; NSIS then fails at compile time:
;   Error: variable "startAppArgs" already declared
; Launch the same way StartApp does: ExecShellAsUser on $launchLink (set just
; before customInstall).

!macro customInstall
  ${if} ${Silent}
    ${ifNot} ${isForceRun}
      HideWindow
      ${if} ${isUpdated}
        ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
      ${else}
        ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
      ${endIf}
    ${endIf}
  ${endIf}
!macroend
