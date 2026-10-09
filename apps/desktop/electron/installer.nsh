; The relocatable runtime runs directly from resources/runtime. Installation
; must not copy it into a second tree, change WORK4YOU_HOME, or touch user data.
; Electron-builder owns relaunch: interactive Finish or explicit --force-run.
; Plain /S installs silently and does not start the app.
!macro customInstall
!macroend
