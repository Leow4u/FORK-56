import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

// Which translucency the OS can back. Asked synchronously because the renderer
// needs it before its first paint, and answered by main because deciding it
// needs `os.release()` — a sandboxed preload may only require electron, events,
// timers and url, so importing node:os here throws before contextBridge runs
// and takes the ENTIRE bridge down with it (window.work4youDesktop undefined =>
// "Desktop IPC bridge is unavailable"). No reply means no glass, which degrades
// to an ordinary opaque window rather than a page thinned over nothing.
const translucencySupport = ipcRenderer.sendSync('work4you:translucency:support')

contextBridge.exposeInMainWorld('work4youDesktop', {
  glassSupported: translucencySupport?.glass === true,
  translucencySupported: translucencySupport?.translucency === true,
  getConnection: profile => ipcRenderer.invoke('work4you:connection', profile),
  // Registry-scoped backend resolution: { connectionId, profile } → descriptor.
  getConnectionFor: payload => ipcRenderer.invoke('work4you:connection:for', payload),
  getProfileRoutes: profiles => ipcRenderer.invoke('work4you:plugin-profile-routes', profiles),
  revalidateConnection: () => ipcRenderer.invoke('work4you:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('work4you:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('work4you:gateway:ws-url', profile),
  // Registry-scoped fresh WS URL: { connectionId, profile } → result shape of
  // getGatewayWsUrl, minted against that connection's backend.
  getGatewayWsUrlFor: payload => ipcRenderer.invoke('work4you:gateway:ws-url-for', payload),
  // Union agent roster across every registered connection.
  getAgentRoster: () => ipcRenderer.invoke('work4you:agents:roster'),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('work4you:window:openSession', sessionId, opts),
  openSessionInTerminal: (sessionId, opts) => ipcRenderer.invoke('work4you:window:openInTerminal', sessionId, opts),
  openWindow: () => ipcRenderer.invoke('work4you:window:openInstance'),
  claimAmbientCue: key => ipcRenderer.invoke('work4you:ambient:claim', key),
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('work4you:wake-indicator:get'),
    setState: state => ipcRenderer.send('work4you:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('work4you:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('work4you:wake-indicator:state', listener)
    }
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('work4you:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('work4you:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('work4you:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('work4you:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('work4you:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('work4you:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('work4you:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('work4you:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('work4you:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    open: request => ipcRenderer.invoke('work4you:hud:open', request),
    close: () => ipcRenderer.invoke('work4you:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('work4you:hud:ignore-mouse', ignore),
    moveBy: delta => ipcRenderer.send('work4you:hud:move-by', delta),
    setBounds: bounds => ipcRenderer.send('work4you:hud:set-bounds', bounds),
    // Whether the band covers the window below the bar. Main pairs it with the
    // user's translucency setting to decide the native frost (macOS vibrancy /
    // Windows 11 DWM backdrop) — see hudFrostFor.
    setFrost: showing => ipcRenderer.invoke('work4you:hud:frost', showing),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('work4you:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('work4you:hud:goto', listener)

      return () => ipcRenderer.removeListener('work4you:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('work4you:hud:changed', listener)

      return () => ipcRenderer.removeListener('work4you:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('work4you:hud:cursor', listener)

      return () => ipcRenderer.removeListener('work4you:hud:cursor', listener)
    }
  },
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('work4you:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('work4you:quick-entry:settings:set', patch),
    submit: payload => ipcRenderer.send('work4you:quick-entry:submit', payload),
    dismiss: () => ipcRenderer.send('work4you:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('work4you:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('work4you:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('work4you:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('work4you:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('work4you:quick-entry:shown', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('work4you:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('work4you:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('work4you:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('work4you:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('work4you:connection-config:test', payload),
  // v2 multi-connection registry: named agent sources (local / remote / cloud / ssh).
  connections: {
    list: () => ipcRenderer.invoke('work4you:connections:list'),
    save: payload => ipcRenderer.invoke('work4you:connections:save', payload),
    remove: id => ipcRenderer.invoke('work4you:connections:remove', id),
    setPrimary: id => ipcRenderer.invoke('work4you:connections:set-primary', id),
    setLaunchMode: mode => ipcRenderer.invoke('work4you:connections:set-launch-mode', mode),
    setLastUsed: id => ipcRenderer.invoke('work4you:connections:set-last-used', id),
    test: id => ipcRenderer.invoke('work4you:connections:test', id),
    // Fan out `work4you update` to every eligible registered connection.
    updateAll: () => ipcRenderer.invoke('work4you:connections:update-all'),
    // Registry lifecycle push (main → renderer): a connection was removed or
    // materially edited, so secondaries scoped to it must be disposed (and,
    // for edits, re-dialed at the new target).
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:connections:changed', listener)

      return () => ipcRenderer.removeListener('work4you:connections:changed', listener)
    }
  },
  sshConfigHosts: () => ipcRenderer.invoke('work4you:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('work4you:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('work4you:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('work4you:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('work4you:connection-config:oauth-logout', remoteUrl),
  // Work4You Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('work4you:cloud:status'),
    login: () => ipcRenderer.invoke('work4you:cloud:login'),
    logout: () => ipcRenderer.invoke('work4you:cloud:logout'),
    discover: org => ipcRenderer.invoke('work4you:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('work4you:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    get: () => ipcRenderer.invoke('work4you:profile:get'),
    set: name => ipcRenderer.invoke('work4you:profile:set', name)
  },
  api: request => ipcRenderer.invoke('work4you:api', request),
  notify: payload => ipcRenderer.invoke('work4you:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('work4you:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('work4you:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('work4you:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('work4you:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('work4you:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('work4you:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('work4you:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('work4you:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('work4you:selectSavePath', options),
  writeClipboard: text => ipcRenderer.invoke('work4you:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('work4you:readClipboard'),
  saveGatewayFile: payload => ipcRenderer.invoke('work4you:saveGatewayFile', payload),
  saveImageFromUrl: url => ipcRenderer.invoke('work4you:saveImageFromUrl', url),
  contextMenuEdit: command => ipcRenderer.invoke('work4you:context-menu:edit', command),
  contextMenuCopyImage: () => ipcRenderer.invoke('work4you:context-menu:copy-image'),
  contextMenuSpellcheck: action => ipcRenderer.invoke('work4you:context-menu:spellcheck', action),
  contextMenuGuestAddWord: payload => ipcRenderer.invoke('work4you:context-menu:guest-add-word', payload),
  onContextMenuSpellcheck: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:context-menu-spellcheck', listener)

    return () => ipcRenderer.removeListener('work4you:context-menu-spellcheck', listener)
  },
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('work4you:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('work4you:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('work4you:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('work4you:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('work4you:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('work4you:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('work4you:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('work4you:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('work4you:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('work4you:translucency', payload),
  setKeepAwake: on => ipcRenderer.send('work4you:keep-awake', on),
  setDisableF12: blocked => ipcRenderer.send('work4you:devtools:disable-f12', blocked),
  setPreviewShortcutActive: active => ipcRenderer.send('work4you:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('work4you:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('work4you:openPreviewInBrowser', url),
  reachPreviewUrl: url => ipcRenderer.invoke('work4you:preview:reach', url),
  fetchLinkTitle: url => ipcRenderer.invoke('work4you:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('work4you:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('work4you:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('work4you:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('work4you:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('work4you:zoom:get'),
    // Synchronous zoom factor (1 = 100%). Coordinate math needs it in the
    // same tick as the event it converts, so no IPC round-trip here.
    factor: () => webFrame.getZoomFactor(),
    setPercent: percent => ipcRenderer.send('work4you:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:zoom:changed', listener)

      return () => ipcRenderer.removeListener('work4you:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('work4you:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('work4you:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('work4you:logs:renderer-error', report),
  readDir: dirPath => ipcRenderer.invoke('work4you:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('work4you:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('work4you:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('work4you:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('work4you:fs:desktopPluginsRoot'),
  agentPluginsRoot: () => ipcRenderer.invoke('work4you:fs:agentPluginsRoot'),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('work4you:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('work4you:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('work4you:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('work4you:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('work4you:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('work4you:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('work4you:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('work4you:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('work4you:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('work4you:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('work4you:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('work4you:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('work4you:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('work4you:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('work4you:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('work4you:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('work4you:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('work4you:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('work4you:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('work4you:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('work4you:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('work4you:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('work4you:git:review:prList', repoPath, branches, numbers),
      fetchPrComment: (repoPath, url) => ipcRenderer.invoke('work4you:git:review:fetchPrComment', repoPath, url),
      createPr: repoPath => ipcRenderer.invoke('work4you:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('work4you:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('work4you:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('work4you:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('work4you:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('work4you:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `work4you:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `work4you:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('work4you:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('work4you:close-preview-requested', listener)
  },
  onPreviewNav: callback => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('work4you:preview-nav', listener)

    return () => ipcRenderer.removeListener('work4you:preview-nav', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('work4you:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('work4you:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('work4you:open-updates', listener)

    return () => ipcRenderer.removeListener('work4you:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:deep-link', listener)

    return () => ipcRenderer.removeListener('work4you:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('work4you:deep-link-ready'),
  probePluginRepo: payload => ipcRenderer.invoke('work4you:plugin:probe', payload),
  installDesktopPlugin: payload => ipcRenderer.invoke('work4you:plugin:installDesktop', payload),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:window-state-changed', listener)

    return () => ipcRenderer.removeListener('work4you:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('work4you:focus-session', listener)

    return () => ipcRenderer.removeListener('work4you:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:notification-action', listener)

    return () => ipcRenderer.removeListener('work4you:notification-action', listener)
  },
  onNotificationActivate: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:notification-activate', listener)

    return () => ipcRenderer.removeListener('work4you:notification-activate', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('work4you:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:backend-exit', listener)

    return () => ipcRenderer.removeListener('work4you:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('work4you:connection:applied', listener)

    return () => ipcRenderer.removeListener('work4you:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('work4you:power-resume', listener)

    return () => ipcRenderer.removeListener('work4you:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('work4you:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('work4you:power-battery', listener)

    return () => ipcRenderer.removeListener('work4you:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:boot-progress', listener)

    return () => ipcRenderer.removeListener('work4you:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('work4you:bootstrap:get'),
  continueBootstrapLocal: () => ipcRenderer.invoke('work4you:bootstrap:continue-local'),
  resetBootstrap: () => ipcRenderer.invoke('work4you:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('work4you:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('work4you:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('work4you:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('work4you:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('work4you:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('work4you:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('work4you:uninstall:summary'),
    run: mode => ipcRenderer.invoke('work4you:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('work4you:updates:check'),
    apply: opts => ipcRenderer.invoke('work4you:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('work4you:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('work4you:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('work4you:updates:progress', listener)

      return () => ipcRenderer.removeListener('work4you:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('work4you:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('work4you:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('work4you:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('work4you:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('work4you:found-in-page', listener)

    return () => ipcRenderer.removeListener('work4you:found-in-page', listener)
  },
  // Main-process `before-input-event` forwards Ctrl/Cmd+F here so renderer
  // can open the FindBar even when the GTK compositor has already grabbed
  // the chord at the windowing layer (#81727).
  onOpenFindBarRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('work4you:open-find-bar', listener)

    return () => ipcRenderer.removeListener('work4you:open-find-bar', listener)
  }
})
