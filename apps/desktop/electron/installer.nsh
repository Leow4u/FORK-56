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
  ; Cursor-model Setup: copy the prebuilt runtime out of extraResources
  ; during "Installing files" so first launch never runs install.ps1.
  ; present:false (dev packs without a CI runtime) exits 0 and is a no-op.
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\runtime\deploy-desktop-runtime.ps1" -BundleDir "$INSTDIR\resources\runtime" -Work4YouHome "$LOCALAPPDATA\work4you" -InstallStampPath "$INSTDIR\resources\install-stamp.json"'
  Pop $R9
  ${if} $R9 != 0
    MessageBox MB_OK|MB_ICONSTOP "Work4You runtime failed to install (exit $R9). Close other Work4You windows and run Setup again."
    Abort
  ${endIf}

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
