// Desktop i18n type contract.
//
// `Translations` is the single source of truth for every translatable string
// surface. Fully translated locale files may satisfy this interface directly;
// partial locales should use `defineLocale()` so missing desktop-only strings
// fall back to English while new keys remain type-checked.

export type Locale = 'en' | 'zh' | 'zh-hant' | 'ja' | 'ar' | 'pt'

export type ToolTitleKey =
  | 'apply_layout'
  | 'browser_back'
  | 'browser_cdp'
  | 'browser_click'
  | 'browser_console'
  | 'browser_dialog'
  | 'browser_exec'
  | 'browser_fill'
  | 'browser_get_images'
  | 'browser_navigate'
  | 'browser_press'
  | 'browser_scroll'
  | 'browser_snapshot'
  | 'browser_take_screenshot'
  | 'browser_type'
  | 'browser_vision'
  | 'clarify'
  | 'close_preview'
  | 'close_terminal'
  | 'computer_use'
  | 'cronjob'
  | 'drive_preview'
  | 'edit_file'
  | 'execute_code'
  | 'focus_pane'
  | 'image_generate'
  | 'list_files'
  | 'memory'
  | 'open_preview'
  | 'patch'
  | 'process'
  | 'project_create'
  | 'project_list'
  | 'project_switch'
  | 'read_file'
  | 'read_preview'
  | 'read_terminal'
  | 'read_window_below'
  | 'search_files'
  | 'session_search'
  | 'session_search_recall'
  | 'skill_manage'
  | 'skill_view'
  | 'skills_list'
  | 'terminal'
  | 'text_to_speech'
  | 'todo'
  | 'tool_call'
  | 'tool_describe'
  | 'tool_search'
  | 'tour'
  | 'video_analyze'
  | 'video_generate'
  | 'vision_analyze'
  | 'web_extract'
  | 'web_search'
  | 'write_file'

interface ToolTitleCopy {
  done: string
  pending: string
  pendingAction: string
}

/** The kinds of call a tool-run summary groups into one clause each. */
type ToolRunCategory = 'create' | 'delegate' | 'edit' | 'explore' | 'other' | 'run'

type ToolCountNoun = 'document' | 'file' | 'item' | 'match' | 'result' | 'row' | 'search' | 'source' | 'step' | 'todo'

interface ToolRunCategoryCopy {
  /** What the clause counts once it holds more than one call — "3 files". */
  count: (count: number) => string
  past: string
  present: string
}

interface ModeOptionCopy {
  label: string
  description: string
}

interface AuxTaskCopy {
  label: string
  hint: string
}

/** One empty-chat greeting: the headline and the line under it. */
export interface IntroCopy {
  headline: string
  body: string
}

export type BlueprintCatalogFieldCopy = {
  default?: string
  help?: string
  label?: string
  options?: Record<string, string>
}

/** Client-side overlay for automation blueprint gallery + form labels. */
export type BlueprintCatalogTranslations = {
  dayOptions?: Record<string, string>
  items?: Record<
    string,
    {
      description?: string
      fields?: Record<string, BlueprintCatalogFieldCopy>
      title?: string
    }
  >
  sharedFields?: Record<string, BlueprintCatalogFieldCopy>
  weekdayOptions?: Record<string, string>
}

export interface Translations {
  common: {
    add: string
    apply: string
    back: string
    save: string
    saving: string
    cancel: string
    change: string
    choose: string
    clear: string
    close: string
    collapse: string
    confirm: string
    connect: string
    connecting: string
    continue: string
    copied: string
    copy: string
    copyFailed: string
    delete: string
    docs: string
    done: string
    error: string
    expand: string
    failed: string
    formatJson: string
    free: string
    loading: string
    notSet: string
    refresh: string
    remove: string
    replace: string
    retry: string
    run: string
    send: string
    set: string
    skip: string
    update: string
    tryHint: (term: string) => string
    on: string
    off: string
  }

  fileMenu: {
    revealFinder: string
    revealExplorer: string
    revealFileManager: string
    revealInSidebar: string
    copyPath: string
    copyRelativePath: string
    download: string
    downloadSaved: string
    downloadFailed: string
    rename: string
    delete: string
    renameTitle: string
    renameLabel: string
    deleteTitle: (name: string) => string
    deleteBody: string
    pathCopied: string
  }

  boot: {
    ready: string
    connectingWork4You: string
    desktopBootFailedWithMessage: (message: string) => string
    steps: {
      connectingGateway: string
      loadingSettings: string
      loadingSessions: string
      retryingRemoteBackend: string
      startingDesktopConnection: string
      startingWork4YouDesktop: string
    }
    errors: {
      backgroundExited: string
      backgroundExitedDuringStartup: string
      backendStopped: string
      desktopBootFailed: string
      gatewayConnectionLost: string
      gatewaySignInRequired: string
      ipcBridgeUnavailable: string
    }
    failure: {
      title: string
      description: string
      remoteTitle: string
      remoteDescription: string
      retry: string
      repairInstall: string
      useLocalGateway: string
      gatewaySettings: string
      back: string
      openLogs: string
      repairHint: string
      remoteSignInHint: (signInLabel: string) => string
      signOutAndSignIn: string
      remoteFailureHint: string
      hideRecentLogs: string
      showRecentLogs: string
      signedInTitle: string
      signedInMessage: string
      signInIncompleteTitle: string
      signInIncompleteMessage: string
      signInFailed: string
      signInToRemoteGateway: string
      signInWithProvider: (provider: string) => string
      identityProvider: string
    }
  }

  notifications: {
    region: string
    hide: string
    show: string
    more: (count: number) => string
    clearAll: string
    dismiss: string
    details: string
    copyDetail: string
    copyDetailFailed: string
    backendOutOfDateTitle: string
    backendOutOfDateMessage: string
    installMethodUnsupportedTitle: string
    updateWork4You: string
    updateReadyTitle: string
    updateReadyMessage: (count: number) => string
    updateReadyMessageUnknown: string
    seeWhatsNew: string
    mcp: {
      needsAuthTitle: string
      needsAuthMessage: (name: string) => string
      errorTitle: string
      errorMessage: (name: string) => string
      signIn: string
      view: string
    }
    errors: {
      elevenLabsNeedsKey: string
      elevenLabsRejectedKey: string
      diskFull: string
      gatewayAuthFailed: string
      methodNotAllowed: string
      microphonePermission: string
      openaiRejectedApiKey: string
      openaiRejectedApiKeyWithStatus: (status: string) => string
      openaiTtsNeedsKey: string
    }
    voice: {
      configureSpeechToText: string
      couldNotStartSession: string
      microphoneAccessDenied: string
      microphoneConstraintsUnsupported: string
      microphoneFailed: string
      microphoneInUse: string
      microphonePermissionDenied: string
      microphoneStartFailed: string
      microphoneUnsupported: string
      noMicrophone: string
      noSpeechDetected: string
      playbackFailed: string
      recordingFailed: string
      sayStopToEnd: (phrase: string) => string
      transcriptionFailed: string
      transcriptionUnavailable: string
      tryRecordingAgain: string
      unavailable: string
    }
    // Native OS notification copy (titles + generic fallback bodies). Dynamic
    // bodies (the agent's reply, a command, an error) are passed through raw.
    native: {
      approvalTitle: string
      approveAction: string
      rejectAction: string
      inputTitle: string
      inputBody: string
      turnDoneTitle: string
      turnDoneBody: string
      turnErrorTitle: string
      backgroundDoneTitle: string
      backgroundFailedTitle: string
      creditsTitle: string
    }
  }

  remoteDisplayBanner: {
    message: (reason: string) => string
  }

  billingBlock: {
    titleWork4You: string
    titleProvider: (provider: string) => string
    fallbackMessage: string
    openBilling: string
    addCredits: string
    dismiss: string
  }

  titlebar: {
    hideSidebar: string
    showSidebar: string
    search: string
    searchTitle: string
    swapSidebarSides: string
    hideRightSidebar: string
    showRightSidebar: string
    muteHaptics: string
    unmuteHaptics: string
    openSettings: string
    openStarmap: string
    enterHud: string
    exitHud: string
    layoutEditor: string
    layoutEditorTitle: (modifier: string) => string
  }

  accountMenu: {
    account: string
    settings: string
    hud: string
    docs: string
    shortcuts: string
    contactUs: string
    logOut: string
    signIn: string
    version: (version: string) => string
  }

  keybinds: {
    title: string
    subtitle: (open: string) => string
    search: string
    rebind: string
    reset: string
    resetAll: string
    pressKey: string
    set: string
    conflictWith: (label: string) => string
    categories: Record<string, string>
    actions: Record<string, string>
  }

  // Find-in-page bar (⌘F). `close` reuses common.close.
  findInPage: {
    next: string
    previous: string
  }

  language: {
    label: string
    description: string
    saving: string
    saveError: string
    switchTo: string
    searchPlaceholder: string
    noResults: string
  }

  settings: {
    closeSettings: string
    exportConfig: string
    importConfig: string
    resetToDefaults: string
    resetConfirm: string
    exportFailed: string
    resetFailed: string
    nav: {
      providers: string
      providerAccounts: string
      providerApiKeys: string
      providerCustomEndpoints: string
      gateway: string
      apiKeys: string
      keybinds: string
      keysTools: string
      keysSettings: string
      mcp: string
      archivedChats: string
      about: string
      account: string
      app: string
      billing: string
      notifications: string
      plugins: string
    }
    account: {
      title: string
      identity: string
      email: string
      firstName: string
      lastName: string
      saveName: string
      saving: string
      saved: string
      saveFailed: string
      nameRequired: string
      signInAgain: string
      signIn: string
      linkedAccounts: string
      manage: string
      session: string
      logOut: string
      logOutTitle: string
      logOutFailed: string
    }
    imageVideo: {
      showModels: (count: number) => string
      hideModels: string
    }
    plugins: {
      title: string
      blurb: string
      count: (n: number) => string
      openFolder: string
      rescan: string
      reveal: string
      enable: string
      disable: string
      failed: string
      empty: string
      kinds: { bundled: string; disk: string; runtime: string }
      discoverEmpty: string
      enabling: string
      categoryDesktop: string
      categoryGeneral: string
      reloadDesktop: string
      agent: {
        title: string
        blurb: string
        appliesTo: string
        empty: string
        loadFailed: string
        portable: string
        search: string
        noMatches: string
        toggleFailed: (name: string) => string
        updateBackendToManage: string
        sources: Record<string, string>
      }
      installModal: {
        title: string
        description: string
        repoLabel: string
        repoPlaceholder: string
        includesHeading: string
        agentLabel: string
        desktopLabel: string
        agentTargetLocal: (profile: string) => string
        agentTargetRemote: (profile: string) => string
        desktopTarget: string
        desktopOnlyNote: string
        insecureWarning: string
        securityHeading: string
        securityIntro: string
        sourceHeading: string
        viewRepository: string
        viewPluginFiles: string
        gitCloneLabel: string
        enableAgent: string
        forceReinstall: string
        install: string
        installing: string
        probing: string
        probeUnavailable: string
        desktopUnavailable: string
        selectComponent: string
        agentSuccess: (name: string) => string
        desktopSuccess: (name: string) => string
        agentFailed: string
        desktopFailed: string
        missingEnv: (vars: string) => string
      }
    }
    notifications: {
      title: string
      enableAll: string
      enableAllDesc: string
      kinds: Record<
        'approval' | 'backgroundDone' | 'credits' | 'input' | 'plugin' | 'turnDone' | 'turnError',
        { label: string }
      >
      test: string
      testTitle: string
      testBody: string
      testSent: string
      testUnsupported: string
      completionSoundTitle: string
      completionSoundPreview: string
    }
    sections: Record<string, string>
    searchPlaceholder: Record<'about' | 'config' | 'gateway' | 'keys' | 'mcp' | 'sessions', string>
    modeOptions: Record<'light' | 'dark' | 'system', ModeOptionCopy>
    // Settings → Voice rows that are not config.yaml fields (device
    // preferences and the app's own voice shortcut).
    voice: {
      dictationLanguageTitle: string
      dictationLanguageDesc: string
      dictationLanguageApp: (language: string) => string
      previewVoice: string
      stopPreview: string
      previewSample: string
      previewFailed: string
      shortcutTitle: string
      shortcutDesc: string
    }
    appearance: {
      title: string
      colorMode: string
      colorModeDesc: string
      activityDensityTitle: string
      activityDensityDesc: string
      activityDensityCompact: string
      activityDensityBalanced: string
      activityDensityDetailed: string
      reasoningCollapsedTitle: string
      uiScaleTitle: string
      sessionDensityTitle: string
      sessionDensityCompact: string
      sessionDensityComfortable: string
      sessionDensityDetailed: string
      terminalFontTitle: string
      terminalFontDesc: string
      terminalFontPlaceholder: string
      terminalFontPreview: string
      terminalFontReset: string
      translucencyTitle: string
      translucencyDesc: string
      translucencyModeClear: string
      translucencyModeGlass: string
      translucencyTintTitle: string
      translucencyFadeTitle: string
      translucencyFrostTitle: string
      translucencyFrost: {
        'under-window': string
        popover: string
        titlebar: string
        header: string
      }
      translucencyScopeTitle: string
      translucencyScope: {
        window: string
        sidebar: string
      }
      introSplashTitle: string
      introSplashDesc: string
      reactionsTitle: string
      reactionsDesc: string
      composerPopoutTitle: string
      composerPopoutDesc: string
      embedsTitle: string
      embedsDesc: string
      embedsAsk: string
      embedsAlways: string
      embedsOff: string
      embedsReset: (count: number) => string
      product: string
      productDesc: string
      technical: string
      technicalDesc: string
      themeTitle: string
      themeDesc: string
      installTitle: string
      installDesc: string
      installPlaceholder: string
      installButton: string
      installing: string
      installError: string
      installed: (name: string) => string
      removeTheme: string
      importedBadge: string
      pet: {
        title: string
        intro: string
        restartHint: string
        on: string
        off: string
        scaleTitle: string
        scaleDesc: string
        roamTitle: string
        roamDesc: string
        chooseTitle: string
        chooseDesc: string
        searchPlaceholder: string
        unreachable: string
        noMatch: (query: string) => string
        installedTag: string
        generatedTag: string
        countCapped: (cap: number, total: number) => string
        count: (n: number) => string
        uninstall: (name: string) => string
        delete: (name: string) => string
        deleteTitle: (name: string) => string
        deleteBody: string
        deleteConfirm: string
        rename: (name: string) => string
        renameTitle: string
        renamePlaceholder: string
        renameSave: string
        exportPet: (name: string) => string
        adoptFailed: (slug: string) => string
        uninstallFailed: (slug: string) => string
        renameFailed: (slug: string) => string
        exportFailed: (slug: string) => string
        noneAvailable: string
        turnOnFailed: string
        turnOffFailed: string
      }
    }
    fieldLabels: Record<string, string>
    fieldDescriptions: Record<string, string>
    about: {
      heading: string
      version: (value: string) => string
      versionUnavailable: string
      bundleOutOfSync: string
      bundleOutOfSyncDesc: string
      bundleOutOfSyncAction: string
      updates: string
      checkNow: string
      checking: string
      seeWhatsNew: string
      updateNow: string
      releaseNotes: string
      onLatest: string
      installing: string
      cantUpdate: string
      cantReach: string
      tapCheck: string
      updateReady: (count: number) => string
      updateReadyUnknown: string
      lastChecked: (age: string) => string
      justNowSuffix: string
      automaticUpdates: string
      automaticUpdatesDesc: string
      branchCommit: (branch: string, commit: string) => string
      removeApp: string
      removeAppDesc: string
      removeAppConfirmTitle: string
      removeAppConfirm: string
      removeAppWorking: string
      removeAppCancel: string
      removeAppFailed: string
      never: string
      justNow: string
      minAgo: (count: number) => string
      hoursAgo: (count: number) => string
      daysAgo: (count: number) => string
    }
    config: {
      none: string
      noneParen: string
      builtinOnly: string
      notSet: string
      commaSeparated: string
      searchPlaceholder: string
      noResults: string
      systemDefault: string
      loading: string
      emptyTitle: string
      emptyDesc: string
      failedLoad: string
      autosaveFailed: string
      imported: string
      invalidJson: string
      toolsetsWipeConfirm: string
      keepAwakeTitle: string
      keepAwakeDesc: string
      disableF12Title: string
      disableF12Desc: string
      attachmentSizeTitle: string
      attachmentSizeDesc: string
      attachmentSizeUnit: string
      attachmentSizeLabel: string
    }
    quickEntry: {
      enabledTitle: string
      enabledDesc: string
      shortcutTitle: string
      active: string
      takenBy: string
      invalidShortcut: string
    }
    credentials: {
      pasteKey: string
      pasteLabelKey: (label: string) => string
      optional: string
      enterValueFirst: string
      couldNotSave: string
      remove: string
      getKey: string
      saving: string
    }
    envActions: {
      actions: string
      manageInKeys: string
      docs: string
      hideValue: string
      revealValue: string
      replace: string
      set: string
      clear: string
    }
    // v2 multi-connection registry: Settings → Connections.
    connections: {
      title: string
      intro: string
      stagedNote: string
      launchModeTitle: string
      launchModeDesc: string
      searchPlaceholder: string
      noSearchResults: string
      loadFailed: string
      currentPill: string
      primaryPill: string
      managedPill: string
      addConnection: string
      editConnection: string
      removeConnection: string
      removeConfirmTitle: string
      removeConfirmDesc: (label: string) => string
      makePrimary: string
      testConnection: string
      testOk: string
      testFailed: string
      saveFailed: string
      removeFailed: string
      updateAll: string
      updateAllRunning: string
      updateAllDone: string
      updateAllFailed: string
      updateSkippedCloud: string
      kindLocal: string
      kindRemote: string
      kindCloud: string
      kindCloudChip: string
      kindSsh: string
      kindLocalDesc: string
      kindRemoteDesc: string
      kindCloudDesc: string
      kindCloudPlan: string
      kindCloudPreparing: string
      kindCloudSoon: string
      kindSshDesc: string
      labelTitle: string
      labelDesc: string
      labelPlaceholder: string
      urlTitle: string
      sshHostTitle: string
      headersTitle: string
      headersDesc: string
      headerValuePlaceholder: string
      headerValueSaved: string
      headerAdd: string
      headerRemove: string
      duplicateLocal: string
      duplicateUrl: (label: string) => string
      duplicateSsh: (label: string) => string
      sameBackendHint: (label: string) => string
      localAddHint: string
      cloudAddHint: string
      save: string
      saving: string
      cancel: string
      empty: string
    }
    gateway: {
      loading: string
      unavailableTitle: string
      unavailableDesc: string
      title: string
      envOverride: string
      intro: string
      envOverrideTitle: string
      envOverrideDesc: string
      modeTitle: string
      localTitle: string
      localDesc: string
      remoteTitle: string
      remoteDesc: string
      remoteAuthHint: string
      cloudTitle: string
      cloudDesc: string
      cloudSignInTitle: string
      cloudSignIn: string
      cloudSignedIn: string
      cloudNeedsSignIn: string
      cloudSignedInDesc: string
      cloudAgentsTitle: string
      cloudOrgPickerTitle: string
      cloudOrgSelect: string
      cloudOrgChange: string
      cloudOrgRole: (role: string) => string
      cloudLoadingAgents: string
      cloudNoAgents: { before: string; linkText: string; after: string }
      cloudRefresh: string
      cloudConnect: string
      cloudConnecting: string
      cloudDiscoverFailed: string
      cloudConnectFailed: string
      cloudSignInFailed: string
      cloudSignedOutTitle: string
      cloudSignedOutMessage: string
      cloudConnectedTitle: string
      cloudConnectedPill: string
      cloudConnectedTo: (name: string) => string
      cloudAgentProvisioning: string
      cloudStatusLabel: (status: string) => string
      remoteUrlTitle: string
      remoteUrlDesc: string
      probing: string
      probeError: string
      signedIn: string
      signIn: string
      signOut: string
      signInWith: (provider: string) => string
      authTitle: string
      authSignedInPassword: string
      authSignedInOauth: string
      authNeedsPassword: string
      authNeedsOauth: (provider: string) => string
      tokenTitle: string
      tokenDesc: string
      existingToken: (value: string) => string
      savedToken: string
      pasteSessionToken: string
      plainTextConfirmTitle: string
      plainTextConfirmDesc: string
      plainTextConfirmAction: string
      plainTextStoredTitle: string
      plainTextStoredDesc: string
      testRemote: string
      saveForRestart: string
      saveAndReconnect: string
      diagnostics: string
      diagnosticsDesc: string
      openLogs: string
      incompleteTitle: string
      incompleteSignIn: string
      incompleteToken: string
      incompleteSignInTest: string
      incompleteTokenTest: string
      enterUrlFirst: string
      restartingTitle: string
      savedTitle: string
      restartingMessage: string
      savedMessage: string
      connectedTo: (baseUrl: string, version?: string) => string
      reachableTitle: string
      signedOutTitle: string
      signedOutMessage: string
      failedLoad: string
      signInFailed: string
      signOutFailed: string
      testFailed: string
      applyFailed: string
      saveFailed: string
      sshTitle: string
      sshDesc: string
      sshTrustHint: string
      sshHostTitle: string
      sshHostDesc: string
      sshHostPick: string
      sshHostPickTitle: string
      sshHostPickDesc: string
      sshHostCustom: string
      sshUserTitle: string
      sshUserDesc: string
      sshUserPlaceholder: string
      sshPortTitle: string
      sshPortDesc: string
      sshKeyTitle: string
      sshKeyDesc: string
      sshWork4YouPathTitle: string
      sshWork4YouPathDesc: string
      sshWork4YouPathPlaceholder: string
      sshTestConnection: string
      sshConnect: string
      sshButtonsHint: string
      sshReachable: (host: string, platform: string) => string
      sshIncompleteHost: string
      sshErrUnreachable: string
      sshErrAuth: string
      sshErrHostKey: string
      sshErrNotInstalled: string
      sshErrPlatform: string
      sshErrTimeout: string
      sshErrUpdateRequired: string
      sshErrUnknown: string
    }
    keys: {
      loading: string
      failedLoad: string
      empty: string
    }
    search: {
      placeholder: string
      pill: string
    }
    profileScope: {
      appliesTo: string
      editsProfile: (profile: string) => string
    }
    mcp: {
      loading: string
      failedLoad: string
      nameRequiredTitle: string
      nameRequiredMessage: string
      objectRequired: string
      invalidJson: string
      saveFailed: string
      removeFailed: string
      gatewayUnavailableTitle: string
      gatewayUnavailableMessage: string
      reloadedTitle: string
      reloadedMessage: string
      reloadFailed: string
      savedTitle: string
      savedMessage: (name: string) => string
      newServer: string
      reload: string
      reloading: string
      emptyTitle: string
      emptyDesc: string
      disabled: string
      editServer: string
      name: string
      serverJson: string
      remove: string
      saveServer: string
      test: string
      testing: string
      testOk: (count: number) => string
      testFailed: string
      enableServer: (name: string) => string
      disableServer: (name: string) => string
      serverEnabled: (name: string) => string
      serverDisabled: (name: string) => string
      toggleFailed: (name: string, enabled: boolean) => string
      tabServers: string
      tabCatalog: string
      catalogLoading: string
      catalogLoadFailed: string
      catalogEmpty: string
      catalogInstalled: string
      catalogEnabled: string
      catalogNeedsInstall: string
      catalogInstall: string
      catalogInstalling: string
      catalogInstallStarted: (name: string) => string
      catalogInstallFailed: (name: string) => string
      catalogEnvPrompt: (name: string) => string
      catalogEnvRequired: string
      capabilitySummary: (tools: number, prompts: number, resources: number) => string
      costTokens: (tokens: string) => string
      usage30d: (uses: string) => string
      unusedPill: string
      statusConnecting: string
      statusNeedsAuth: string
      statusError: string
      statusOff: string
      statusConnected: string
      columnServer: string
      columnType: string
      columnStatus: string
      columnActions: string
      transportHttp: string
      transportStdio: string
      typeHostedApp: string
      authOauth: string
      disconnect: string
      allServers: string
      authenticatedTitle: string
      authenticatedMessage: (server: string, count: number) => string
      waitingForBrowser: string
      authenticate: string
      unsavedConnect: string
      enableTool: (tool: string) => string
      disableTool: (tool: string) => string
      noOutput: string
      deepLinkTitle: string
      deepLinkDescription: string
      deepLinkStdioWarning: string
      deepLinkConfirm: string
      deepLinkNameInvalid: string
      deepLinkNameConflict: (name: string) => string
      deepLinkErrorTitle: string
      deepLinkErrorName: string
      deepLinkErrorConfig: string
      deepLinkErrorShape: string
      deepLinkErrorUrl: string
      deepLinkErrorTooLarge: string
      importButton: string
      importPlaceholder: string
      importNoMatch: string
      importConfirm: string
      importConfirmMany: (count: number) => string
    }
    model: {
      loading: string
      searchModels: string
      viewAll: string
      appliesDesc: string
      provider: string
      model: string
      applying: string
      defaultsLabel: string
      reasoning: string
      reasoningOff: string
      defaultsFailed: string
      auxiliaryTitle: string
      resetAllToMain: string
      auxiliaryDesc: string
      setToMain: string
      change: string
      autoUseMain: string
      providerDefault: string
      fallbackAdd: string
      fallbackEmpty: string
      notInCatalog: string
      tasks: Record<string, AuxTaskCopy>
    }
    providers: {
      connectAccount: string
      haveApiKey: string
      intro: string
      connected: string
      collapse: string
      connectAnother: string
      otherProviders: string
      disconnect: string
      disconnectInTerminal: string
      removeConfirm: (provider: string) => string
      removeExternalGeneric: (provider: string) => string
      removeKeyManaged: (provider: string) => string
      removeTerminalConfirm: (provider: string, command: string) => string
      removeTerminalRunning: (provider: string) => string
      removedTitle: string
      removedMessage: (provider: string) => string
      failedRemove: (provider: string) => string
      noProviderKeys: string
      searchKeys: string
      noKeysMatch: string
      localEndpoint: {
        title: string
        description: string
      }
      loading: string
    }
    sessions: {
      loading: string
      archivedTitle: string
      archivedIntro: string
      emptyArchivedTitle: string
      emptyArchivedDesc: string
      unarchive: string
      deletePermanently: string
      messages: (count: number) => string
      restored: string
      deleteConfirm: (title: string) => string
      autoArchiveTitle: string
      autoArchiveDesc: string
      autoArchiveDaysLabel: string
      autoArchiveDaysUnit: string
      autoArchiveFailed: string
      defaultDirTitle: string
      defaultDirDesc: string
      defaultDirUpdated: string
      defaultsTo: (label: string) => string
      change: string
      choose: string
      clear: string
      notSet: string
      failedLoad: string
      unarchiveFailed: string
      deleteFailed: string
      updateDirFailed: string
      clearDirFailed: string
    }
    toolsets: {
      loadingConfig: string
      savedTitle: string
      savedMessage: (key: string) => string
      removedTitle: string
      removedMessage: (key: string) => string
      failedSave: (key: string) => string
      failedRemove: (key: string) => string
      failedReveal: (key: string) => string
      removeConfirm: (key: string) => string
      set: string
      notSet: string
      selectedTitle: string
      selectedMessage: (provider: string) => string
      failedSelect: (provider: string) => string
      failedLoad: string
      noProviderOptions: string
      noProviders: string
      ready: string
      needsSignIn: string
      needsSetup: string
      activeBackend: string
      activeBackendHint: string
      useBackend: string
      work4youIncluded: string
      work4youAuthNeededTitle: string
      work4youAuthNeededMessage: (provider: string) => string
      work4youAuthSignIn: string
      work4youAuthDoneTitle: string
      work4youAuthDoneMessage: string
      work4youAuthFailed: string
      noApiKeyRequired: string
      postSetupHint: (step: string) => string
      postSetupInstalledHint: string
      postSetupRun: string
      postSetupRerun: string
      postSetupInstalled: string
      postSetupRunning: string
      postSetupStarting: string
      postSetupCompleteTitle: string
      postSetupCompleteMessage: (step: string) => string
      postSetupErrorTitle: string
      postSetupErrorMessage: (step: string) => string
      postSetupFailed: (step: string) => string
      webSearchActive: (backend: string) => string
      webExtractActive: (backend: string) => string
      webCapabilityUnset: string
      webUseForSearch: string
      webUseForExtract: string
      webUsedForSearch: string
      webUsedForExtract: string
      webCapabilitySelectedMessage: (provider: string, capability: string) => string
      failedSelectCapability: (provider: string) => string
      loadingModels: string
      modelSectionTitle: string
      modelCount: (count: number) => string
      modelInUse: string
      modelDefault: string
      modelInactiveHint: string
      modelSelectedTitle: string
      modelSelectedMessage: (model: string) => string
      failedSelectModel: (model: string) => string
      terminalBackend: {
        sectionTitle: string
        loading: string
        failedLoad: string
        ready: string
        needsSetup: string
        unavailable: string
        inUse: string
        selectedTitle: string
        selectedMessage: (backend: string) => string
        failedSelect: (backend: string) => string
        needsSetupHint: string
      }
    }
  }

  skills: {
    tabSkills: string
    tabToolsets: string
    configuringProfile: string
    viewInstalled: string
    viewConnected: string
    viewDiscover: string
    categoryFilter: string
    allCategories: string
    tabMcp: string
    tabPlugins: string
    all: string
    searchSkills: string
    searchToolsets: string
    searchPlugins: string
    refresh: string
    refreshing: string
    loading: string
    noSkillsTitle: string
    noSkillsDesc: string
    noToolsetsTitle: string
    noToolsetsDesc: string
    noDescription: string
    configured: string
    needsKeys: string
    visionModelHint: string
    visionModelLink: string
    toolsetsEnabled: (enabled: number, total: number) => string
    configureToolset: (label: string) => string
    toggleToolset: (label: string, enabled: boolean) => string
    skillsLoadFailed: string
    toolsetsRefreshFailed: string
    skillEnabled: string
    skillDisabled: string
    toolsetEnabled: string
    toolsetDisabled: string
    appliesToNewSessions: (name: string) => string
    failedToUpdate: (name: string) => string
    sortMostUsed: string
    sortAlpha: string
    sortMostUsedDesc: string
    sortLeastUsedAsc: string
    enableAll: string
    disableAll: string
    disableUnused: string
    bulkUpdated: (count: number) => string
    bulkNoChange: string
    usageCount: (count: number | string) => string
    provenance: Record<'agent' | 'bundled' | 'hub', string>
    emptyNoneFound: (noun: string) => string
    emptyNothingMatches: (query: string) => string
    emptyNoneAvailable: (noun: string) => string
    changesApplyNewSessions: string
    skillUpdated: string
    skillCreated: string
    newSkill: string
    createSkill: string
    nameRequired: string
    newSkillNamePlaceholder: string
    newSkillCategoryPlaceholder: string
    edit: string
    archive: string
    skillArchivedTitle: string
    skillArchivedMessage: string
    archiveConfirmTitle: (name: string) => string
    archiveConfirmBody: string
    scopeAgent: (profile: string, connection: string, current: boolean) => string
    appConnect: {
      signInRequiredTitle: string
      signInRequiredBody: string
      connectedTitle: (name: string) => string
      connectedBody: string
    }
    mcpDoc: {
      expectedObject: string
      wrapServer: string
    }
    hub: {
      searchPlaceholder: string
      search: string
      searching: string
      connectingHubs: string
      connectedHubs: string
      featured: string
      noResults: string
      resultCount: (count: number, ms: number | null) => string
      timedOut: (sources: string) => string
      installed: string
      install: string
      installing: string
      uninstall: string
      uninstalling: string
      updateAll: string
      updating: string
      preview: string
      scan: string
      scanning: string
      close: string
      files: string
      noReadme: string
      trust: Record<string, string>
      verdictSafe: string
      verdictCaution: string
      verdictDangerous: string
      policyAllow: string
      policyAsk: string
      policyBlock: string
      findings: (count: number) => string
      noFindings: string
      installStarted: (name: string) => string
      uninstallStarted: (name: string) => string
      updateStarted: string
      actionFailed: string
      actionLog: string
      alreadyInstalled: (name: string) => string
      pickerTitle: string
      pickerBrowse: string
      pickerHide: string
      pickerHint: string
      loadFailed: string
      previewFailed: string
      scanFailed: string
      searchFailed: string
    }
  }

  starmap: {
    title: string
    subtitle: (nodes: number, clusters: number) => string
    close: string
    refresh: string
    memory: string
    filterAll: string
    filterUsed: string
    filterLearned: string
    viewGraph: string
    loadFailed: string
    loading: string
    emptyTitle: string
    emptyDesc: string
    share: string
    shareHint: string
    shareTitle: string
    sharePlaceholder: string
    copy: string
    copied: string
    importMap: string
    importBtn: string
    importEmpty: string
    importSuccess: (nodes: number) => string
    importedBadge: string
    resetToMine: string
    importFailed: string
    nodeMenu: {
      editMemory: string
      editSkill: string
      archiveSkill: string
      deleteMemory: string
      editTitle: (label: string) => string
      deleteTitle: (label: string) => string
      deleteMemoryBody: string
    }
    legend: {
      skill: string
      memory: string
      rings: string
    }
    timeline: {
      play: string
      pause: string
      scrubber: string
    }
    badges: {
      unknownDate: string
      profileMemory: string
      memory: string
      learned: string
      pinned: string
    }
  }
  agents: {
    close: string
    title: string
    subtitle: string
    emptyTitle: string
    emptyDesc: string
    running: string
    failed: string
    done: string
    streaming: string
    files: string
    moreFiles: (count: number) => string
    delegation: (index: number) => string
    workers: (count: number) => string
    workersActive: (count: number) => string
    agentsCount: (count: number) => string
    activeCount: (count: number) => string
    failedCount: (count: number) => string
    toolsCount: (count: number) => string
    filesCount: (count: number) => string
    updatedAgo: (age: string) => string
    ageNow: string
    ageSeconds: (seconds: number) => string
    ageMinutes: (minutes: number) => string
    ageHours: (hours: number) => string
    ageDays: (days: number) => string
    durationSeconds: (seconds: string) => string
    durationMinutes: (minutes: number, seconds: number) => string
    tokens: (value: number | string) => string
  }

  commandCenter: {
    close: string
    paletteTitle: string
    back: string
    searchPlaceholder: string
    goTo: string
    goToSession: string
    branches: string
    projects: string
    openFolder: string
    openFolderAt: (path: string) => string
    newSessionInProject: (project: string) => string
    selectWorkspace: string
    selectWorkspacePlaceholder: string
    searchProjects: string
    clearActiveWorkspace: string
    workspaceSearchEmpty: string
    commands: string
    startInBranch: (branch: string) => string
    commandCenter: string
    appearance: string
    settings: string
    changeTheme: string
    changeColorMode: string
    pets: {
      title: string
      placeholder: string
      loading: string
      error: string
      staleBackend: string
      empty: string
      turnOff: string
      turnOn: string
      installed: string
      generatedTag: string
      adoptFailed: string
      toggleFailed: (enabled: boolean) => string
      noneAvailable: string
    }
    generatePet: {
      title: string
      placeholder: string
      promptHint: string
      readyHint: string
      generate: string
      generating: string
      retry: string
      hatch: string
      spawning: string
      hatching: string
      hatchingSub: string
      hatched: string
      hatchRow: (state: string, done: number, total: number) => string
      hatchComposing: string
      hatchSaving: string
      namePlaceholder: string
      staleBackend: string
      backgroundHint: string
      slowProviderHint: string
      remix: string
      remixConfirmTitle: string
      remixConfirmBody: string
      genericError: string
      referenceImageTooLarge: string
      referenceImageInvalid: string
      adopt: string
      startOver: string
    }
    installTheme: {
      title: string
      pageTitle: string
      placeholder: string
      loading: string
      error: string
      empty: string
      install: string
      installing: string
      installed: string
      installs: (count: string) => string
    }
    settingsFields: string
    mcpServers: string
    archivedChats: string
    sections: Record<'maintenance' | 'sessions' | 'system' | 'usage', string>
    sectionDescriptions: Record<'maintenance' | 'sessions' | 'system' | 'usage', string>
    nav: Record<'newChat' | 'settings' | 'skills' | 'messaging' | 'artifacts', { title: string; detail: string }>
    sectionEntries: Record<'sessions' | 'system' | 'usage', { title: string; detail: string }>
    providerNavigate: string
    providerSessions: string
    refresh: string
    refreshing: string
    noResults: string
    pinSession: string
    unpinSession: string
    exportSession: string
    deleteSession: string
    noSessions: string
    gatewayRunning: string
    gatewayStopped: string
    work4youActiveSessions: (version: string, count: number) => string
    restartGateway: string
    openBrowser: string
    gatewayRestartFailed: string
    updateWork4You: string
    reloadWindow: string
    actionRunning: string
    actionDone: string
    actionFailed: string
    actionStartedWaiting: string
    loadingStatus: string
    recentLogs: string
    noLogs: string
    days: (count: number) => string
    statSessions: string
    statApiCalls: string
    statTokens: string
    statCost: string
    actualCost: (cost: string) => string
    loadingUsage: string
    noUsage: (period: number) => string
    retry: string
    dailyTokens: string
    dailyTokensTip: (day: string, input: string, output: string) => string
    input: string
    output: string
    noDailyActivity: string
    topModels: string
    noModelUsage: string
    topSkills: string
    noSkillActivity: string
    actions: (count: string) => string
    logFile: string
    logLevel: string
    logSearchPlaceholder: string
    maintenance: {
      runOps: string
      doctor: string
      doctorDesc: string
      securityAudit: string
      securityAuditDesc: string
      backup: string
      backupDesc: string
      debugShare: string
      debugShareDesc: string
      debugShareRunning: string
      debugShareLinks: string
      debugShareFailed: string
      copyLink: string
      linkCopied: string
      curator: string
      curatorDesc: string
      curatorPaused: string
      curatorActive: string
      curatorDisabled: string
      curatorLastRun: (when: string) => string
      curatorNeverRan: string
      pause: string
      resume: string
      runNow: string
      memoryData: string
      memoryDataDesc: string
      memoryProvider: (name: string) => string
      builtinMemory: string
      memoryFile: string
      userFile: string
      bytes: (size: string) => string
      empty: string
      resetMemory: string
      resetUser: string
      resetAll: string
      resetConfirm: (target: string) => string
      resetDone: (files: string) => string
      resetFailed: string
      actionStarted: (name: string) => string
      actionFailed: (name: string) => string
      running: string
      viewLog: string
    }
  }

  messaging: {
    search: string
    loading: string
    loadFailed: string
    columnChannel: string
    columnUsers: string
    columnStatus: string
    columnActions: string
    columnType: string
    kindConversation: string
    kindIntegration: string
    discoverConversation: string
    discoverConversationHint: string
    discoverIntegrations: string
    discoverIntegrationsHint: string
    pendingBadge: (count: number) => string
    emptyConnectedTitle: string
    emptyConnectedDesc: string
    emptyDiscoverTitle: string
    emptyDiscoverDesc: string
    noMatchesTitle: string
    noMatchesDesc: string
    states: Record<string, string>
    unknown: string
    hintPendingRestart: string
    hintGatewayStopped: string
    hintSetupFirst: string
    hintEnableToConnect: string
    restartGateway: string
    restartingGateway: string
    credentialsSet: string
    needsSetup: string
    gatewayStopped: string
    notConnected: string
    channelActive: string
    channelActiveHint: string
    connectionTitle: string
    connectedListening: string
    stateListening: string
    whoCanTalkTitle: string
    whatsappActiveHint: string
    connectedSince: (when: string) => string
    channelOff: string
    testConnection: string
    reconnect: string
    runSetupSteps: string
    runStepsAgain: string
    edit: string
    show: string
    hide: string
    approvedCount: (count: number) => string
    whoTeam: (count: number) => string
    whoSelf: string
    whoApprove: string
    whoNobody: string
    whoAnyone: string
    botDoesTitle: string
    botReplies: string
    botNoDms: string
    botRoutines: (count: number) => string
    botAlerts: string
    manageRoutines: string
    advancedTitle: string
    advancedHint: string
    title: string
    getCredentials: string
    openSetupGuide: string
    required: string
    recommended: string
    advanced: (count: number) => string
    noTokenNeeded: string
    enabled: string
    disabled: string
    unsavedChanges: string
    saving: string
    saveChanges: string
    saveAndEnable: string
    saved: string
    test: string
    testing: string
    testPassed: (name: string) => string
    testFailed: (name: string) => string
    fixHighlighted: string
    envErrors: {
      a2aPeerTokens: (value: string) => string
      a2aPublicUrl: (value: string) => string
      apiServerCorsOrigin: (value: string) => string
      apiServerHost: (value: string) => string
      apiServerKey: string
      discordToken: string
      discordUserId: (value: string) => string
      emailAddress: (value: string) => string
      emailHost: (value: string) => string
      emailPort: (value: string) => string
      googleChatEventsUrl: (value: string) => string
      googleChatProjectId: (value: string) => string
      googleChatSubscription: (value: string) => string
      slackMemberId: (value: string) => string
      slackTokenPrefix: (prefix: string) => string
      smsNumber: (value: string) => string
      smsWebhookUrl: (value: string) => string
      telegramToken: string
      telegramUserId: (value: string) => string
      twilioAccountSid: string
      msgraphCidr: (value: string) => string
      msgraphClientState: string
      msgraphPublicUrl: (value: string) => string
      teamsGuid: (value: string) => string
      teamsPublicUrl: (value: string) => string
      webhookSecret: string
      whatsappCloudAccessToken: string
      whatsappCloudAppSecret: string
      whatsappCloudNumericId: (value: string) => string
      whatsappCloudPhoneNumberId: (value: string) => string
      whatsappCloudPhoneNumberPasted: string
      whatsappCloudPublicUrl: (value: string) => string
      whatsappCloudVerifyToken: string
      whatsappCloudWebhookPath: (value: string) => string
      whatsappNumber: (value: string) => string
    }
    /** Localized labels for env keys rendered as a segmented picker
     *  (FIELD_OPTIONS), keyed by env key then by option value. */
    envOptions: Record<string, Record<string, string>>
    channelSettings: {
      whoOnlyPeople: (count: number) => string
      whoApprove: string
      whoEveryone: string
      listTitle: string
      approveTitle: string
      approveDesc: string
      ignoredHint: string
    }
    telegramPage: {
      stepWho: string
      stepCreate: string
      stepTalk: string
      stepDeliver: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      createTitle: string
      createNote: string
      createStep1: string
      createStep1Link: string
      createStep2: string
      starting: string
      created: (username: string) => string
      haveToken: string
      useToken: string
      useQr: string
      tokenTitle: string
      tokenNote: string
      tokenLabel: string
      talkTitle: string
      talkNote: (choice: string) => string
      talkNoteList: (choice: string) => string
      meIdTitle: string
      meIdNote: string
      meIdLabel: string
      idsLabel: string
      listDesc: string
      listHint: string
      listOwnerHint: (id: string) => string
      idsRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkCreated: (username: string) => string
      checkTokenSaved: string
      whoMe: string
      whoList: (count: number) => string
      whoApprove: string
      tryIt: string
      openInTelegram: string
      advancedHint: string
    }
    discordPage: {
      stepWho: string
      stepCreate: string
      stepInvite: string
      stepTalk: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      createTitle: string
      createNote: string
      createStep1: string
      createStep2: string
      tokenLabel: string
      tokenHelp: string
      openPortal: string
      tokenRead: (id: string) => string
      inviteTitle: string
      inviteNote: string
      inviteStep1: string
      inviteStep2: string
      copyLink: string
      openInvite: string
      talkTitle: string
      talkNote: (choice: string) => string
      meIdTitle: string
      meIdNote: string
      meIdLabel: string
      listDesc: string
      listHint: string
      everyoneTitle: string
      everyoneDesc: string
      idsRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkTokenSaved: string
      whoMe: string
      whoList: (count: number) => string
      whoEveryone: string
      tryIt: string
      whoNone: string
      inviteLabel: string
      inviteHint: string
      advancedHint: string
    }
    slackPage: {
      stepWho: string
      stepCreate: string
      stepTokens: string
      stepTalk: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      createTitle: string
      createNote: string
      createStep1: string
      createStep2: string
      copyManifest: string
      manifestCopied: string
      manifestCopyFailed: string
      createApp: string
      tokensTitle: string
      tokensNote: string
      botTokenLabel: string
      botTokenHelp: string
      appTokenLabel: string
      appTokenHelp: string
      talkTitle: string
      talkNote: (choice: string) => string
      meIdTitle: string
      meIdNote: string
      meIdLabel: string
      listDesc: string
      listHint: string
      everyoneTitle: string
      everyoneDesc: string
      idsRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkTokensSaved: string
      whoMe: string
      whoList: (count: number) => string
      whoEveryone: string
      tryIt: string
      whoNone: string
      advancedHint: string
    }
    teamsPage: {
      stepWho: string
      stepAzure: string
      stepEndpoint: string
      stepTalk: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      azureTitle: string
      azureNote: string
      clientIdLabel: string
      tenantIdLabel: string
      secretLabel: string
      secretHelp: string
      secretKept: string
      openPortal: string
      endpointTitle: string
      endpointNote: string
      bindLabel: string
      bindLocal: string
      bindNetwork: string
      publicUrlLabel: string
      publicUrlHelp: string
      tunnelWarning: string
      endpointLabel: string
      copyEndpoint: string
      endpointHelp: string
      talkTitle: string
      talkNote: (choice: string) => string
      meIdTitle: string
      meIdNote: string
      meIdLabel: string
      meIdHelp: string
      listDesc: string
      listHint: string
      everyoneTitle: string
      everyoneDesc: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkListener: (port: string) => string
      checkListenerPending: string
      checkEndpoint: (url: string) => string
      tryIt: string
      endpointLine: (url: string) => string
      graphNote: string
      advancedHint: string
    }
    whatsappCloudPage: {
      stepWho: string
      stepMeta: string
      stepWebhook: string
      stepTalk: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      metaTitle: string
      metaNote: string
      phoneIdLabel: string
      phoneIdHelp: string
      tokenLabel: string
      tokenHelp: string
      secretLabel: string
      secretHelp: string
      savedKeep: string
      openDashboard: string
      webhookTitle: string
      webhookNote: string
      verifyLabel: string
      verifyHelp: string
      generate: string
      bindLabel: string
      bindLocal: string
      bindNetwork: string
      publicUrlLabel: string
      publicUrlHelp: string
      tunnelWarning: string
      callbackLabel: string
      copyCallback: string
      callbackHelp: string
      talkTitle: string
      talkNote: (choice: string) => string
      meNumberTitle: string
      meNumberNote: string
      meNumberLabel: string
      listTitle: string
      listDesc: string
      listHint: string
      numbersRequired: string
      readySaving: string
      readySetUp: string
      checkMeta: (number: string, name: string) => string
      checkMetaGeneric: string
      checkMetaPending: string
      whoMe: string
      whoList: (count: number) => string
      tryIt: string
      whoOnlyNumbers: (count: number) => string
      whoNone: string
      callbackLine: (url: string) => string
      advancedHint: string
    }
    emailPage: {
      stepWho: string
      stepMailbox: string
      stepWrite: string
      stepDeliver: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      mailboxTitle: string
      mailboxNote: string
      addressLabel: string
      providerLabel: string
      custom: string
      serversFilled: (imap: string, smtp: string) => string
      imapHostLabel: string
      imapPortLabel: string
      smtpHostLabel: string
      smtpPortLabel: string
      hostsRequired: string
      passwordLabel: string
      passwordHelp: string
      passwordKept: string
      customPasswordLabel: string
      customPasswordHelp: string
      appPasswordQuestion: string
      appPasswordYes: string
      appPasswordNo: string
      appPasswordSetupTitle: string
      appPasswordSetupBody: string
      appPasswordSetupLink: string
      writeTitle: string
      writeNote: (choice: string) => string
      allowedLabel: string
      allowedHelp: string
      allowedPlaceholder: string
      chipRemove: (address: string) => string
      meAddressTitle: string
      meAddressNote: string
      meAddressLabel: string
      addressesRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkLogin: (address: string) => string
      checkLoginPending: string
      whoMe: string
      whoList: (count: number) => string
      tryIt: (address: string) => string
      whoCanWriteTitle: string
      connectedLabel: string
      whoOnlyAddresses: (count: number) => string
      whoNone: string
      listTitle: string
      repliesToEmail: string
      advancedHint: string
    }
    smsPage: {
      stepWho: string
      stepTwilio: string
      stepWebhook: string
      stepText: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      twilioTitle: string
      twilioNote: string
      sidLabel: string
      openConsole: string
      tokenLabel: string
      tokenKept: string
      numberLabel: string
      numberHelp: string
      webhookTitle: string
      webhookNote: string
      webhookLabel: string
      webhookHelp: string
      webhookStep1: string
      webhookStep2: string
      webhookCaution: string
      textTitle: string
      textNote: (choice: string) => string
      meNumberTitle: string
      meNumberNote: string
      meNumberLabel: string
      listTitle: string
      listDesc: string
      listHint: string
      approveTitle: string
      approveDesc: string
      numbersRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkTwilio: (number: string) => string
      checkTwilioPending: string
      whoMe: string
      whoList: (count: number) => string
      whoApprove: string
      tryIt: (number: string) => string
      whoCanTextTitle: string
      whoOnlyNumbers: (count: number) => string
      repliesToTexts: string
      advancedHint: string
    }
    googleChatPage: {
      stepWho: string
      stepMode: string
      stepCloud: string
      stepTalk: string
      stepReady: string
      whoTitle: string
      whoNote: string
      meTitle: string
      meDesc: string
      othersTitle: string
      othersDesc: string
      modeTitle: string
      modeNote: string
      pubsubTitle: string
      pubsubDesc: string
      httpTitle: string
      httpDesc: string
      cloudTitle: string
      cloudNote: string
      cloudNoteHttp: string
      pubsubStep1: string
      pubsubStep2: string
      pubsubStep3: string
      pubsubStep4: string
      httpStep1: string
      httpStep2: string
      openChatApi: string
      openConsole: string
      keyLabel: string
      keyHelp: string
      keyKept: string
      projectLabel: string
      subscriptionLabel: string
      projectMismatch: string
      eventsUrlLabel: string
      eventsUrlHelp: string
      saEmailLabel: string
      saEmailHelp: string
      audienceLabel: string
      audienceHelp: string
      talkTitle: string
      talkNote: (choice: string) => string
      meEmailTitle: string
      meEmailNote: string
      meEmailLabel: string
      listDesc: string
      listHint: string
      approveDesc: string
      emailsRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkPubsub: string
      checkHttp: string
      checkPending: string
      whoMe: string
      whoList: (count: number) => string
      whoApprove: string
      tryIt: string
      modePubsub: string
      modeHttp: string
      advancedHint: string
    }
    apiServerPage: {
      stepKey: string
      stepConnect: string
      stepReady: string
      keyTitle: string
      keyNote: string
      keyLabel: string
      keyPlaceholder: string
      keyKept: string
      generateKey: string
      keyHelp: string
      keyCaution: string
      keyRequired: string
      connectTitle: string
      connectNote: string
      baseUrlLabel: string
      copyBaseUrl: string
      modelLabel: string
      keyFromStep: string
      openGuide: string
      networkExposed: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      checkLive: (url: string) => string
      checkPending: string
      checkModel: (model: string) => string
      tryIt: (model: string) => string
      endpointTitle: string
      accessTitle: string
      replaceKey: string
      browserApps: string
      browserAppsNone: string
      originsLabel: string
      originsHelp: string
      openAiCompatible: string
      advancedHint: string
      activeHint: string
    }
    webhookPage: {
      stepListener: string
      stepRoute: string
      stepReady: string
      listenerTitle: string
      listenerNote: string
      patternLabel: string
      copyBaseUrl: string
      reachNote: string
      turnOn: string
      routeTitle: string
      routeTitleMore: string
      routeNote: string
      nameLabel: string
      nameHelp: (url: string) => string
      nameRequired: string
      eventsLabel: string
      eventsHelp: string
      promptLabel: string
      promptPlaceholder: string
      deliverLabel: string
      deliverHelp: string
      createRoute: string
      readyTitle: string
      checkRoute: (name: string) => string
      checkSecret: string
      checkDeliver: (target: string) => string
      deliverLog: string
      pasteBoth: (hostPort: string) => string
      urlLabel: string
      copyUrl: string
      secretLabel: string
      copySecret: string
      manageRoutes: string
      listenerBlock: string
      listeningRoutes: (count: number) => string
      routesTitle: string
      routesNote: string
      noRoutes: string
      newRoute: string
      routeLine: (events: string, target: string) => string
      everyEvent: string
      localLogOnly: string
      toggleRoute: (name: string) => string
      advancedHint: string
      activeHint: string
    }
    a2aPage: {
      stepWhat: string
      stepCallable: string
      stepPeers: string
      stepReady: string
      whatTitle: string
      whatNote: string
      inboundTitle: string
      inboundDesc: string
      outboundTitle: string
      outboundDesc: string
      bothTitle: string
      bothDesc: string
      callableTitle: string
      callableNote: string
      reachLabel: string
      reachLocal: string
      reachNetwork: string
      tokenLabel: string
      tokenPlaceholder: string
      tokenKept: string
      generateToken: string
      tokenHelp: string
      networkNeedsToken: string
      publicUrlLabel: string
      publicUrlHelp: string
      cardLabel: string
      copyCardUrl: string
      cardHelp: string
      peersTitle: string
      peersNote: string
      peerNameLabel: string
      peerUrlLabel: string
      peerTokenLabel: string
      peerTokenPlaceholder: string
      peerCapsLabel: string
      addPeer: string
      peerRequired: string
      peerAddFailed: string
      removePeer: string
      peerRemoveFailed: string
      peerLine: (url: string, hasToken: boolean) => string
      outboundToggle: string
      outboundOn: string
      outboundOff: string
      outboundNote: string
      outboundFailed: string
      readySaving: string
      readyTitle: string
      checkListener: (port: string, remote: boolean) => string
      checkListenerPending: string
      checkCard: (url: string) => string
      checkPeers: (count: number, toolsOn: boolean) => string
      tryItPeer: (name: string) => string
      tryItCard: string
      callableBlock: string
      reachNetworkFact: string
      reachLocalFact: string
      tokenRequiredFact: string
      peersBlock: string
      noPeers: string
      accessTitle: string
      sharedToken: string
      peerTokens: string
      peerTokensHelp: string
      tokenSet: string
      tokenNone: string
      advancedHint: string
      activeHint: string
    }
    msgraphPage: {
      stepSecret: string
      stepReach: string
      stepResources: string
      stepReady: string
      secretTitle: string
      secretNote: string
      secretLabel: string
      secretPlaceholder: string
      secretKept: string
      generateSecret: string
      secretCaution: string
      secretRequired: string
      listenerOnly: string
      reachTitle: string
      reachNote: string
      reachLabel: string
      reachLocal: string
      reachNetwork: string
      cidrsLabel: string
      cidrsHelp: string
      networkNeedsCidrs: string
      publicUrlLabel: string
      publicUrlHelp: string
      notifyLabel: string
      copyNotifyUrl: string
      notifyHelp: string
      resourcesTitle: string
      resourcesNote: string
      resourcesLabel: string
      readySaving: string
      readyTitle: string
      checkListener: (port: string, network: boolean) => string
      checkListenerPending: string
      checkRegister: (url: string) => string
      nextSubscribe: string
      openGuide: string
      listenerBlock: string
      copyUrl: string
      securityTitle: string
      secretSet: string
      secretNone: string
      cidrsNone: string
      acceptedTitle: string
      everyResource: string
      advancedHint: string
      activeHint: string
    }
    telegramQuickSetup: {
      waiting: string
      qrAlt: string
      openTelegram: string
      expiresIn: (value: string) => string
      expired: string
      sessionExpired: string
      startFailed: string
    }
    whatsappQuickSetup: {
      allowedUsersPlaceholder: string
      preparing: string
      startingBridge: string
      waitingForQr: string
      qrAlt: string
      expiresIn: (value: string) => string
      expired: string
      sessionExpired: string
      startFailed: string
      linkedAs: (label: string) => string
      deviceLinked: string
      openChatLink: string
    }
    homeDelivery: {
      stepLabel: string
      title: string
      note: string
      label: string
      help: string
      required: string
      notInAllowlist: string
    }
    channelSteps: {
      next: string
      tryAgain: string
      checkRestarting: string
      checkRestarted: string
      checkRestartFailed: (code: number) => string
      checkRestartNotStarted: (detail: string) => string
    }
    whatsappSteps: {
      stepWho: string
      stepConnect: string
      stepTalk: string
      stepDeliver: string
      stepReady: string
      whoTitle: string
      whoNote: string
      selfTitle: string
      selfDesc: string
      soloTitle: string
      soloDesc: string
      teamTitle: string
      teamDesc: string
      connectTitle: string
      connectNote: string
      connectStepLead: string
      connectStepPath: string
      connectStep2: string
      waitingScan: string
      alreadyLinked: string
      advancedSetup: string
      talkTitle: string
      talkNote: (choice: string) => string
      listTitle: string
      listDesc: string
      listHint: string
      approveTitle: string
      approveDesc: string
      numbersRequired: string
      readySaving: string
      readyTitle: string
      readySetUp: string
      sendTest: string
      checkLinked: string
      checkLinkedAs: (phone: string) => string
      whoSelf: string
      whoSolo: string
      whoList: (count: number) => string
      whoApprove: string
      tryItSelf: string
      tryItBot: (phone: string) => string
      tryItBotUnknown: string
    }
    replaceValue: string
    openDocs: string
    clearField: (key: string) => string
    enableAria: (name: string) => string
    disableAria: (name: string) => string
    platformEnabled: (name: string) => string
    platformDisabled: (name: string) => string
    restartToApply: string
    setupSaved: (name: string) => string
    restartToReconnect: string
    keyCleared: (key: string) => string
    setupUpdated: (name: string) => string
    failedUpdate: (name: string) => string
    failedSave: (name: string) => string
    failedClear: (key: string) => string
    pendingRequests: (count: number) => string
    pendingAria: (count: number) => string
    approvedUsers: (count: number) => string
    approve: string
    approving: string
    revoke: string
    revoking: string
    revokeAria: (name: string) => string
    revokeTitle: string
    revokeDesc: (name: string) => string
    approvedUser: (name: string) => string
    approvedHint: string
    revokedUser: (name: string) => string
    failedApprove: (name: string) => string
    failedRevoke: (name: string) => string
    pairingLockedOut: string
    waitingSince: (minutes: number) => string
    fieldCopy: Record<string, { label?: string; help?: string; placeholder?: string }>
    platformIntro: Record<string, string>
    channelDescriptions: Record<string, string>
  }

  webhooks: {
    search: string
    loading: string
    loadFailed: string
    subscriptions: (count: number) => string
    hint: string
    empty: string
    disabledTitle: string
    disabledBody: string
    enable: string
    enabling: string
    enabled: (name: string) => string
    disabled: (name: string) => string
    enableRow: string
    disableRow: string
    delete: string
    deleting: string
    deleted: string
    deleteTitle: string
    deleteDescPrefix: string
    deleteDescSuffix: string
    deleteFailed: (name: string) => string
    toggleFailed: (name: string, enabled: boolean) => string
    newSubscription: string
    restarting: string
    restartNeeded: string
    restartGateway: string
    restartingGateway: string
    restartFailed: (detail: string) => string
    enabledRestarting: string
    all: string
    deliverOnly: string
    createdTitle: string
    createdSecretHint: string
    webhookUrl: string
    secretOnce: string
    done: string
    fieldName: string
    fieldNamePlaceholder: string
    fieldDescription: string
    fieldDescriptionPlaceholder: string
    fieldEvents: string
    fieldEventsPlaceholder: string
    fieldSkills: string
    fieldSkillsPlaceholder: string
    fieldDeliver: string
    fieldDeliverOnly: string
    fieldDeliverTarget: string
    fieldDeliverTargetPlaceholder: string
    fieldDeliverTargetHelp: string
    fieldPrompt: string
    fieldPromptPlaceholder: string
    nameRequired: string
    create: string
    creating: string
    created: string
    createFailed: (detail: string) => string
    copy: string
    deliverOptions: Record<string, string>
  }

  profiles: {
    close: string
    nameHint: string
    title: string
    count: (count: number) => string
    search: string
    loading: string
    newProfile: string
    importProfile: string
    exportProfile: string
    imported: string
    exported: string
    failedImport: string
    failedExport: string
    allProfiles: string
    showAllProfiles: string
    switchToProfile: (name: string) => string
    switchToConnection: (name: string) => string
    switchConnectionFailed: (name: string) => string
    manageProfiles: string
    connectGateway: string
    actions: string
    color: string
    colorFor: string
    setColor: (color: string) => string
    autoColor: string
    noProfiles: string
    selectPrompt: string
    refresh: string
    refreshing: string
    default: string
    skills: (count: number) => string
    env: string
    defaultBadge: string
    rename: string
    renameMenu: string
    editSoul: string
    copySetup: string
    copying: string
    modelLabel: string
    skillsLabel: string
    notSet: string
    soulDesc: string
    personaTitle: string
    personaFile: string
    inUse: string
    currentlyInUse: string
    useProfile: string
    fileLabel: string
    personaPlaceholder: string
    createAppearanceHint: string
    personaPrompt: string
    soulOptional: string
    soulPlaceholder: (mode: string) => string
    soulPlaceholderCloned: string
    soulPlaceholderEmpty: string
    unsavedChanges: string
    loadingSoul: string
    emptySoul: string
    saving: string
    saveSoul: string
    deleteTitle: string
    deleteDescPrefix: string
    deleteDescMid: string
    deleteDescSuffix: string
    deleting: string
    createDesc: string
    nameLabel: string
    cloneFrom: string
    cloneFromNone: string
    cloneFromDesc: string
    cloneFromDefault: string
    cloneFromDefaultDesc: string
    invalidName: (hint: string) => string
    nameRequired: string
    creating: string
    createAction: string
    renameTitle: string
    displayNameTitle: string
    displayNameDesc: string
    displayNameLabel: string
    renameDescPrefix: string
    renameDescSuffix: string
    newNameLabel: string
    renaming: string
    created: string
    renamed: string
    deleted: string
    setupCopied: string
    soulSaved: string
    failedLoad: string
    failedDelete: string
    failedCopy: string
    failedLoadSoul: string
    failedSaveSoul: string
    failedCreate: string
    failedRename: string

    // Rail: backend state + hover panel
    state: { running: string; waking: string; asleep: string }
    stateHint: { running: string; waking: string; asleep: string }
    thisProfile: string
    showingAllProfiles: string
    switcher: string
    agentPanel: string
    editProfile: string
    allConversations: string
    railState: { running: string; waking: string; asleep: string }
    switchTo: string
    current: string
    manageShort: string
    sessionCount: (count: number) => string
    runningSummary: (running: number, total: number) => string
    newSessionHere: string

    // Guided create
    personaLabel: string
    personaTemplates: { blank: string; research: string; writer: string; developer: string; support: string }
    personaTemplateHint: string
    avatar: {
      characters: string
      characterNames: Record<'headphones' | 'sunglasses' | 'glasses' | 'beret' | 'bowtie' | 'cap', string>
      label: string
      hint: string
      tabs: { bot: string; generate: string; upload: string; pet: string }
      shape: (shape: string) => string
      blobFace: string
      blobAuto: string
      blobAutoHint: string
      randomize: string
      lockFace: string
      unlockFace: string
      lockHint: string
      unlockHint: string
      faceLocked: string
      faceFollowsName: string
      classicShapes: string
      removeImage: string
      chooseImage: string
      imageTooLarge: string
      describe: string
      generate: string
      generating: string
      generateHint: string
      generateFailed: string
      noImageModel: string
      checkingImageModel: string
      petPick: string
      petSearch: (count: number) => string
      noPets: string
      noPetsMatch: string
      petFailed: string
    }
    startFrom: string
    startBlank: string
    startCopy: string
    copyScope: { config: string; all: string }
    copyHint: string
    bundledSkills: string
    bundledSkillsHint: string
    switchAfterCreate: string

    // Manage overlay
    legend: string
    tabs: { persona: string; model: string; description: string; export: string }
    cards: { model: string; skills: string; credentials: string; envSet: string; envMissing: string }
    skillsInstalled: (count: number) => string
    changeModel: string
    modelSaved: string
    failedSaveModel: string
    modelHint: string
    descriptionHint: string
    descriptionAuto: string
    generateDescription: string
    generating: string
    descriptionSaved: string
    failedSaveDescription: string
    failedGenerate: string
    exportTitle: string
    exportHint: string
    personaAppliesNote: string
  }

  cron: {
    create: {
      description: string
      useTemplate: string
      instructions: string
      project: string
      noProject: string
      localProjectHint: string
      defaultModel: string
      defaultModelHint: string
      ai: string
      repeat: string
      time: string
      weekday: string
      monthDay: string
      minute: string
      receive: string
      receiveHint: string
      more: string
      submit: string
      customHint: string
      timezoneHint: string
      retryDestinations: string
      retryModels: string
      retryTemplates: string
      templateUnavailable: string
      destinations: (count: number) => string
    }
    close: string
    title: string
    count: (count: number) => string
    modelImpact: {
      title: string
      message: (count: number) => string
      detailMore: (names: string, remaining: number) => string
      review: string
      saveFailed: string
    }
    search: string
    loading: string
    states: Record<string, string>
    deliveryLabels: Record<string, string>
    scheduleLabels: Record<string, string>
    scheduleHints: Record<string, string>
    days: Record<string, string>
    dayFallback: (value: string) => string
    everyDayAt: (time: string) => string
    weekdaysAt: (time: string) => string
    everyDayOfWeekAt: (day: string, time: string) => string
    monthlyOnDayAt: (dayOfMonth: string, time: string) => string
    topOfHour: string
    everyHourAt: (minute: string) => string
    newCron: string
    untitled: string
    emptyDescNew: string
    emptyDescSearch: string
    emptyTitleNew: string
    emptyTitleSearch: string
    last: string
    next: string
    noRuns: string
    manage: string
    showRuns: string
    hideRuns: string
    runHistory: string
    actionsTitle: string
    resume: string
    pause: string
    resumeTitle: string
    pauseTitle: string
    triggerNow: string
    edit: string
    deleteTitle: string
    deleteDescPrefix: string
    deleteDescSuffix: string
    deleting: string
    resumed: string
    paused: string
    triggered: string
    deleted: string
    created: string
    updated: string
    failedLoad: string
    failedUpdate: string
    failedTrigger: string
    failedDelete: string
    failedSave: string
    editTitle: string
    createTitle: string
    editDesc: string
    createDesc: string
    nameLabel: string
    namePlaceholder: string
    promptLabel: string
    promptPlaceholder: string
    frequencyLabel: string
    deliverLabel: string
    deliverNeedsHomeChannel: string
    modelLabel: string
    modelDefault: string
    customScheduleLabel: string
    customPlaceholder: string
    customHint: string
    optional: string
    promptRequired: string
    promptScheduleRequired: string
    scheduleRequired: string
    scriptOnlyEditHint: string
    saveChanges: string
    createAction: string
    tabs: {
      jobs: string
      blueprints: string
    }
    blueprints: {
      tab: string
      startFrom: string
      custom: string
      subtitle: string
      dialogDesc: string
      scheduleIt: string
      scheduling: string
      scheduled: string
      loading: string
      failedLoad: string
      emptyTitle: string
      emptyDesc: string
      /** Locale overlay for GET /api/cron/blueprints copy (backend ships English). */
      catalog?: BlueprintCatalogTranslations
    }
  }

  artifacts: {
    subtitle: string
    colDate: string
    search: string
    refresh: string
    refreshing: string
    indexing: string
    tabAll: string
    tabImages: string
    tabFiles: string
    tabLinks: string
    noArtifactsTitle: string
    noArtifactsDesc: string
    failedLoad: string
    openFailed: string
    itemsImage: string
    itemsLink: string
    itemsFile: string
    itemsGeneric: string
    zero: string
    rangeOf: (start: number, end: number, total: number) => string
    goToPage: (itemLabel: string, page: number) => string
    colTitleLink: string
    colTitleFile: string
    colTitleDefault: string
    colLocationLink: string
    colLocationFile: string
    colLocationDefault: string
    colSession: string
    kindImage: string
    kindFile: string
    kindLink: string
    chat: string
    copyUrl: string
    copyPath: string
    skippedSessions: (skipped: number, total: number) => string
    skippedSafeLimit: (count: number) => string
    skippedUnreadable: (count: number) => string
  }

  artifactCard: {
    kind: Record<'code' | 'html' | 'svg', string>
    generating: (lines: number) => string
    versionBadge: (count: number) => string
    open: string
  }

  artifactPreview: {
    versionOf: (current: number, total: number) => string
    olderVersion: string
    newerVersion: string
    latest: string
    copyContent: string
    download: string
    openInBrowser: string
    openInBrowserFailed: string
    missingTitle: string
    missingBody: string
  }

  sidebar: {
    nav: Record<string, string>
    searchAria: string
    searchPlaceholder: string
    clearSearch: string
    noMatch: (query: string) => string
    results: string
    pinned: string
    sessions: string
    cronJobs: string
    groupAriaGrouped: string
    groupAriaUngrouped: string
    showSessions: string
    groupTitleGrouped: string
    groupTitleUngrouped: string
    allPinned: string
    shiftClickHint: string
    noWorkspace: string
    noSessions: string
    noFilterMatches: string
    projects: {
      sectionLabel: string
      home: string
      newButton: string
      createTitle: string
      createDesc: string
      renameTitle: string
      addFolderTitle: string
      namePlaceholder: string
      nameLabel: string
      foldersLabel: string
      ideaLabel: string
      ideaPlaceholder: string
      ideaGenerate: string
      ideaGenerating: string
      makePrimary: string
      noFolders: string
      addFolder: string
      primaryBadge: string
      removeFolder: string
      create: string
      menu: string
      menuRename: string
      menuAppearance: string
      noColor: string
      menuAddFolder: string
      menuSetActive: string
      menuDelete: string
      moveToProject: string
      movedTo: (name: string) => string
      moveFailed: string
      moveNoFolder: string
      moveNoProjects: string
      reveal: string
      copyPath: string
      removeFromSidebar: string
      createFailed: string
      staleBackend: string
      deleteConfirm: string
      startWork: string
      newWorktreeTitle: string
      newWorktreeDesc: string
      branchPlaceholder: string
      branchOff: () => { after: string; before: string }
      baseBranchPlaceholder: string
      baseBranchNone: string
      startWorkFailed: string
      worktreeStaleBackend: string
      worktreeProjectLabel: string
      worktreeProjectPlaceholder: string
      worktreeProjectNone: string
      convertBranch: string
      convertBranchTitle: string
      convertBranchDesc: string
      convertBranchPlaceholder: string
      convertBranchInstead: string
      branchOpenExisting: string
      branchSwitchHome: string
      branchCreateWorktree: string
      branchTrackRemote: string
      branchesLoading: string
      noBranches: string
      reorder: (label: string) => string
      toggle: (label: string, open: boolean) => string
    }
    newSessionIn: (label: string) => string
    showMoreIn: (count: number, label: string) => string
    showMore: string
    loading: string
    loadMore: string
    loadCount: (step: number) => string
    messageCount: (count: number) => string
    toolCallCount: (count: number) => string
    row: {
      pin: string
      unpin: string
      markUnread: string
      markRead: string
      unreadFailed: string
      copyId: string
      export: string
      branchFrom: string
      rename: string
      archive: string
      newWindow: string
      openInTerminal: string
      hideTabBar: string
      openInNewTab: string
      openInSplit: string
      copyIdFailed: string
      sessionActions: string
      sessionRunning: string
      needsInput: string
      waitingForAnswer: string
      finishedUnread: string
      backgroundRunning: string
      draftSession: string
      handoffOrigin: (platform: string) => string
      ownedByProfile: (profile: string) => string
      renamed: string
      renameFailed: string
      renameTitle: string
      renameDesc: string
      untitledPlaceholder: string
      deleteTitle: string
      deleteDesc: (title: string) => string
      deleting: string
      deleted: string
      untitledChat: (id: string) => string
      messageCount: (count: number) => string
      todoProgress: string
      openPullRequest: (number: number) => string
      ageNow: string
      ageDay: string
      ageHour: string
      ageMin: string
    }
    dateDivider: {
      today: string
      yesterday: string
      thisWeek: string
      lastWeek: string
      thisMonth: string
    }
    statusDivider: {
      working: string
      done: string
    }
    markAllRead: string
    splitDirections: Record<'bottom' | 'left' | 'right' | 'top', string>
    filters: {
      title: string
      grouping: string
      ordering: string
      show: string
      inboxStyle: string
      status: string
      pullRequest: string
      profile: string
      project: string
      archived: string
      expandAll: string
      collapseAll: string
      groupings: Record<'date' | 'profile' | 'project' | 'status', string>
      orderings: Record<'cost' | 'created' | 'manual' | 'status' | 'tokens' | 'updated', string>
      rowMeta: Record<'cost' | 'pr' | 'preview' | 'profile' | 'tokens' | 'updated', string>
      prStates: Record<'closed' | 'draft' | 'merged' | 'none' | 'open', string>
      statuses: Record<'draft' | 'idle' | 'needs-input' | 'unread' | 'working', string>
    }
  }

  composer: {
    message: string
    wakingProfile: (profile: string) => string
    placeholderStarting: string
    placeholderReconnecting: string
    placeholderFollowUp: string
    newSessionPlaceholders: readonly string[]
    followUpPlaceholders: readonly string[]
    startVoice: string
    openDirective: string
    queueMessage: string
    steer: string
    stop: string
    send: string
    speaking: string
    transcribing: string
    thinking: string
    muted: string
    listening: string
    muteMic: string
    unmuteMic: string
    stopListening: string
    stopShort: string
    endConversation: string
    endShort: string
    stopDictation: string
    transcribingDictation: string
    voiceControls: string
    voiceDictation: string
    speakReplies: string
    stopSpeakingReplies: string
    wakeWordListening: (phrase: string) => string
    wakeWordOff: (phrase: string) => string
    wakeWordPausedVoice: (phrase: string) => string
    lookupLoading: string
    lookupNoMatches: string
    lookupTry: string
    lookupOr: string
    commonCommands: string
    hotkeys: string
    helpFooter: string
    commandDescs: Record<string, string>
    hotkeyDescs: Record<string, string>
    slashCommands: {
      descriptions: {
        newChat: string
        branch: string
        yolo: string
        wake: string
        handoff: string
        profile: string
        skin: string
        title: string
        help: string
        browser: string
        journey: string
        model: string
        resume: string
        approvals: string
        agents: string
        background: string
        compress: string
        debug: string
        goal: string
        loop: string
        personality: string
        pet: string
        hatch: string
        queue: string
        retry: string
        rollback: string
        save: string
        status: string
        steer: string
        stop: string
        tools: string
        undo: string
        usage: string
        version: string
      }
      unavailable: {
        advanced: (command: string) => string
        messaging: (command: string) => string
        settings: (command: string) => string
        terminal: (command: string) => string
        modelPicker: (command: string) => string
        sessionPicker: (command: string) => string
      }
      skin: {
        list: string
        next: string
        current: string
      }
      groups: {
        commands: string
        options: string
        sessions: string
        themes: string
      }
      browseAllSessions: string
    }
    atStarters: {
      file: string
      folder: string
      url: string
      image: string
      tool: string
      git: string
    }
    attachUrlTitle: string
    attachUrlDesc: string
    urlPlaceholder: string
    urlHintPre: string
    attach: string
    queued: (count: number) => string
    queuedPaused: (count: number) => string
    attachmentOnly: string
    emptyTurn: string
    attachments: (count: number) => string
    editingInComposer: string
    editingQueuedInComposer: string
    queueEdit: string
    queueSendNext: string
    queueSend: string
    queueSteer: string
    queueDelete: string
    queueResume: string
    queueResumeTip: string
    queueStuckTitle: string
    queueStuckBody: string
    previewUnavailable: string
    previewLabel: (label: string) => string
    couldNotPreview: (label: string) => string
    removeAttachment: (label: string) => string
    dictating: string
    preparingAudio: string
    speakingResponse: string
    readingAloud: string
    themeSuggestions: string
    noMatchingThemes: string
    themeTryPre: string
    themeTryPost: string
    attachLabel: string
    files: string
    folder: string
    images: string
    pasteImage: string
    url: string
    promptSnippets: string
    tipPre: string
    tipPost: string
    snippetsTitle: string
    snippetsDesc: string
    snippets: Record<string, { label: string; description: string; text: string }>
    dropFiles: string
    dropSession: string
    contextMenu: {
      addContext: string
      addFiles: string
      addFolders: string
    }
    mcpSuggestions: {
      label: (server: string) => string
      connectLabel: (server: string) => string
      tip: (keyword: string) => string
      connecting: (server: string) => string
      cancelTip: string
      added: (server: string) => string
      addedTip: string
      connectFailed: (server: string) => string
    }
    skillSuggestions: {
      label: (skill: string) => string
      tip: (skill: string) => string
      done: (skill: string) => string
      doneTip: string
    }
    githubSuggestions: {
      label: string
      tip: string
      done: string
      doneTip: string
    }
    repairSuggestions: {
      label: (server: string) => string
      tip: (server: string) => string
      working: (server: string) => string
      workingTip: string
      done: (server: string) => string
      doneTip: string
      failed: (server: string) => string
    }
    cronSuggestions: {
      label: string
      tip: (phrase: string) => string
      prefix: string
      done: string
      doneTip: string
    }
  }

  statusStack: {
    agents: string
    background: (count: number) => string
    goalActive: string
    goalDone: string
    goalPaused: string
    goalWaiting: string
    subagents: (count: number) => string
    todos: (done: number, total: number) => string
    running: string
    stop: string
    dismiss: string
    exit: (code: number) => string
    coding: {
      title: string
      noBranch: string
      detached: string
      clean: string
      changed: (count: number) => string
      ahead: (count: number) => string
      behind: (count: number) => string
      review: string
      close: string
      openChanges: string
      openFile: string
      stage: string
      unstage: string
      stageAll: string
      viewAsTree: string
      viewAsList: string
      revert: string
      revertAll: string
      revertConfirm: string
      revertAllConfirm: string
      staged: string
      noChanges: string
      notRepo: string
      noDiff: string
      scopeUncommitted: string
      scopeBranch: string
      scopeLastTurn: string
      commit: string
      commitAndPush: string
      commitPlaceholder: (shortcut: string) => string
      generateCommitMessage: string
      stopGenerating: string
      createPr: string
      openPr: string
      ghMissing: string
      agentShip: string
      agentShipUnavailable: string
      agentShipPrompt: string
      newBranch: string
      branchOffFrom: (base: string) => string
      switchTo: (branch: string) => string
      switchFailed: (branch: string) => string
      worktrees: string
      branchChip: string
    }
  }

  updates: {
    stages: Record<string, string>
    checking: string
    checkFailedTitle: string
    tryAgain: string
    notAvailableTitle: string
    unsupportedMessage: string
    connectionRetry: string
    latestBody: string
    latestBodyBackend: string
    allSetTitle: string
    availableTitle: string
    availableBody: string
    availableTitleBackend: string
    availableBodyBackend: string
    availableBodyNoChangelog: string
    availableBodyInstaller: string
    availableBodyChrome: string
    updateNow: string
    restartToFinish: string
    maybeLater: string
    moreChanges: (count: number) => string
    manualTitle: string
    manualBody: string
    manualPickedUp: string
    /** GUI/backend skew (#45205): backend updated but the running desktop app
     *  package (AppImage/.deb/.rpm) was not changed and must be reinstalled. */
    guiSkewTitle: string
    guiSkewBody: string
    copy: string
    copied: string
    done: string
    applyingBody: string
    applyingBodyInstaller: string
    applyingBodyChrome: string
    applyingBodyBackend: string
    applyingClose: string
    errorTitle: string
    errorBody: string
    blockerTitle: string
    blockerBody: string
    foreignBlockerTitle: string
    foreignBlockerBody: string
    mixedBlockerBody: string
    closePreviewsAndUpdate: string
    closePreviewsAndCheckAgain: string
    localPreview: string
    portLabel: (port: number) => string
    pidLabel: (pid: number) => string
    technicalDetails: string
    notNow: string
    applyStatus: {
      preparing: string
      pulling: string
      restarting: string
      notAvailable: string
      failed: string
      noReturn: string
    }
  }

  install: {
    stageStates: Record<string, string>
    oneTimeTitle: string
    unsupportedDesc: (platform: string) => string
    installCommand: string
    copyCommand: string
    viewDocs: string
    installTo: string
    retryAfterRun: string
    setupChoiceTitle: string
    setupChoiceDesc: string
    connectExistingTitle: string
    connectExistingShort: string
    connectExistingDesc: string
    installLocalTitle: string
    installLocalDesc: string
    localStartUnavailable: string
    remoteSetupTitle: string
    remoteSetupDesc: string
    remoteUrlTitle: string
    remoteUrlDesc: string
    remoteUrlPlaceholder: string
    probing: string
    probeError: string
    identityProvider: string
    authTitle: string
    authNeedsOauth: (provider: string) => string
    authSignedIn: string
    connected: string
    signIn: string
    signInWith: (provider: string) => string
    enterUrlFirst: string
    signInIncomplete: string
    tokenTitle: string
    tokenDesc: string
    pasteSessionToken: string
    incompleteSignInTest: string
    incompleteTokenTest: string
    testConnection: string
    testSucceeded: (baseUrl: string, version?: string) => string
    applyRemote: string
    backToSetup: string
    failedTitle: string
    settingUpTitle: string
    finishingTitle: string
    failedDesc: string
    activeDesc: string
    progress: (completed: number, total: number) => string
    currentStage: (stage: string) => string
    fetchingManifest: string
    error: string
    hideOutput: string
    showOutput: string
    lines: (count: number) => string
    noOutput: string
    cancelling: string
    cancelInstall: string
    transcriptSaved: string
    copiedOutput: string
    copyOutput: string
    reloadRetry: string
  }

  onboarding: {
    headerTitle: string
    headerDesc: string
    welcomeTitle: string
    welcomeSubtitle: string
    finishInBrowser: string
    reopen: string
    getStarted: string
    preparingInstall: string
    starting: string
    lookingUpProviders: string
    collapse: string
    otherProviders: string
    haveApiKey: string
    chooseLater: string
    recommended: string
    connected: string
    featuredPitch: string
    fireworksPitch: string
    openRouterPitch: string
    apiKeyOptions: Record<string, { short: string; description: string; name?: string }>
    backToSignIn: string
    getKey: string
    replaceCurrent: string
    pasteApiKey: string
    localApiKeyPlaceholder: string
    couldNotSave: string
    connecting: string
    update: string
    flowSubtitles: Record<string, string>
    startingSignIn: (provider: string) => string
    verifyingCode: (provider: string) => string
    connectedProvider: (provider: string) => string
    connectedPicking: (provider: string) => string
    signInFailed: string
    pickDifferentProvider: string
    signInWith: (provider: string) => string
    openedBrowser: (provider: string) => string
    authorizeThere: string
    copyAuthCode: string
    pasteAuthCode: string
    reopenAuthPage: string
    autoBrowser: (provider: string) => string
    reopenSignInPage: string
    waitingAuthorize: string
    externalPending: (provider: string) => string
    signedIn: string
    deviceCodeOpened: (provider: string) => string
    reopenVerification: string
    copy: string
    defaultModel: string
    freeTier: string
    pro: string
    free: string
    price: (input: string, output: string) => string
    change: string
    startChatting: string
    docs: (provider: string) => string
    providerTitles: {
      openaiCodex: string
      anthropicApiKey: string
      claudeCode: string
    }
    directApiAccess: (provider: string) => string
    profileSetup: {
      title: (profile: string) => string
      subtitle: string
      pendingPrompt: string
      portalSignedIn: string
      portalPitch: string
      useForProfile: string
      settingUp: string
      savedToProfile: string
      readyTitle: (profile: string) => string
      readyMessage: (model: string) => string
      adoptFailed: string
      noModel: string
      reauthTitle: string
      reauthBody: (profile: string) => string
      signInAgain: string
      useApiKeyInstead: string
      reauthFootnote: string
      bannerMessage: string
      bannerUsePortal: string
      bannerChoose: string
      bannerDismiss: string
    }
  }

  modelPicker: {
    title: string
    current: string
    unknown: string
    search: string
    noModels: string
    addProvider: string
    loadFailed: string
    noAuthenticatedProviders: string
    pro: string
    proNeedsSubscription: string
    free: string
    freeTier: string
    priceTitle: string
    wasPrice: string
  }

  modelVisibility: {
    title: string
    search: string
    noAuthenticatedProviders: string
    addProvider: string
  }

  shell: {
    windowControls: string
    paneControls: string
    appControls: string
    panes: {
      sessions: string
      terminal: string
      files: string
      review: string
      logs: string
      browser: string
      agentTerminal: string
      noPageAt: (path: string) => string
    }
    layouts: {
      default: string
      focus: string
      terminalDeck: string
      quad: string
    }
    palette: {
      resetLayout: string
      toggleStatusbar: string
      toggleTerminal: string
      toggleLogs: string
      toggleYolo: string
    }
    modelMenu: {
      search: string
      noModels: string
      models: string
      editModels: string
      refreshModels: string
      fast: string
      moaPresets: string
    }
    modelOptions: {
      noOptions: string
      options: string
      thinking: string
      fast: string
      effort: string
      minimal: string
      low: string
      medium: string
      high: string
      xhigh: string
      max: string
      ultra: string
      updateFailed: string
      fastFailed: string
    }
    gatewayMenu: {
      gateway: string
      connected: string
      connecting: string
      offline: string
      inferenceReady: string
      inferenceNotReady: string
      checkingInference: string
      disconnected: string
      reconnectGateway: string
      openSystem: string
      connection: (label: string) => string
      recentActivity: string
      viewAllLogs: string
      messagingPlatforms: string
    }
    approvalMode: {
      title: string
      ariaLabel: (mode: string) => string
      manual: string
      manualDescription: string
      smart: string
      smartDescription: string
      off: string
      offDescription: string
      saveFailed: string
    }
    statusbar: {
      unknown: string
      restart: string
      restartToFinish: string
      update: string
      updateInProgress: string
      commitsBehind: (count: number, branch: string) => string
      desktopVersion: (version: string) => string
      backendVersion: (version: string) => string
      clientLabel: (version: string) => string
      connectionSsh: (host: string) => string
      connectionRemote: (host: string) => string
      connectionCloud: (host: string) => string
      connectionCloudTooltip: (host: string) => string
      connectionSshTooltip: (host: string) => string
      connectionRemoteTooltip: (host: string) => string
      backendLabel: (version: string) => string
      commit: (sha: string) => string
      branch: (branch: string) => string
      closeCommandCenter: string
      openCommandCenter: string
      showTerminal: string
      hideTerminal: string
      gateway: string
      gatewayReady: string
      gatewayNeedsSetup: string
      gatewayChecking: string
      gatewayConnecting: string
      gatewayOffline: string
      gatewayRestarting: string
      gatewayTitle: string
      customizeTitle: string
      hideStatusbar: string
      resetStatusbar: string
      toggleApprovalMode: string
      toggleBackendVersion: string
      toggleCommandCenter: string
      toggleContextUsage: string
      toggleRunningTimer: string
      toggleSessionTimer: string
      toggleTerminal: string
      toggleVersion: string
      toggleWorkspace: string
      agents: string
      closeAgents: string
      openAgents: string
      subagents: (count: number) => string
      failed: (count: number) => string
      running: (count: number) => string
      cron: string
      openCron: string
      webhooks: string
      openWebhooks: string
      starmap: string
      openStarmap: string
      turnRunning: string
      contextUsage: string
      contextUsagePanel: {
        categories: {
          conversation: string
          mcp: string
          memory: string
          rules: string
          skills: string
          subagent_definitions: string
          system_prompt: string
          tool_definitions: string
        }
        empty: string
        loading: string
        percentFull: (percent: number) => string
        title: string
        tokenSummary: (used: string, max: string) => string
      }
      session: string
      yoloOn: string
      yoloOff: string
      modelNone: string
      noModel: string
      switchModel: string
      openModelPicker: string
      modelPinned: string
      modelTitle: (provider: string, model: string) => string
      providerModelTitle: (provider: string, model: string) => string
    }
  }

  rightSidebar: {
    openFile: string
    selectFileFromTree: string
    fileLocation: string
    hideFileTree: string
    showFileTree: string
    filterFiles: string
    noMatchingFiles: string
    partialFilter: string

    aria: string
    panelsAria: string
    files: string
    terminal: string
    noFolderSelected: string
    changeCwdTitle: string
    remotePickerTitle: string
    remotePickerDescription: string
    remotePickerSelect: string
    folderTip: (cwd: string) => string
    openFolder: string
    refreshTree: string
    collapseAll: string
    previewUnavailable: string
    couldNotPreview: (path: string) => string
    noProjectTitle: string
    noProjectBody: string
    noProjectOpen: string
    noDiffs: string
    unreadableTitle: string
    unreadableBody: (error: string) => string
    emptyTitle: string
    emptyBody: string
    treeErrorTitle: string
    treeErrorBody: string
    tryAgain: string
    loadingTree: string
    loadingFiles: string
    terminalHide: string
    terminalsAria: string
    terminalNew: string
    terminalCloseOthers: string
    terminalCloseAll: string
    addToChat: string
  }

  preview: {
    /** What an empty Browser shows: the conversation's tools. */
    newTab: {
      tools: string
      review: string
      needsProject: string
    }
    tab: string
    closePane: string
    loading: string
    unavailable: string
    opening: string
    hide: string
    open: string
    openPreview: string
    documentKind: {
      archive: string
      document: string
      file: string
      markdown: string
      presentation: string
      spreadsheet: string
    }
    openInBrowser: string
    linkHint: string
    sourceLineTitle: string
    source: string
    renderedPreview: string
    diff: string
    unknownSize: string
    binaryTitle: string
    binaryBody: (label: string) => string
    largeTitle: string
    largeBody: (label: string, size: string) => string
    previewAnyway: string
    truncated: string
    noInlineTitle: string
    noInlineBody: (mimeType: string) => string
    edit: string
    editing: string
    unsavedChanges: string
    saveFailed: (message: string) => string
    diskChangedTitle: string
    diskChangedBody: string
    overwrite: string
    discardReload: string
    console: {
      deselect: string
      select: string
      copyFailed: string
      copyEntry: string
      sendEntry: string
      messages: (count: number) => string
      resize: string
      title: string
      selected: (count: number) => string
      sendToChat: string
      copySelected: string
      copyAll: string
      copy: string
      clear: string
      empty: string
      promptHeader: string
      sentTitle: string
      sentMessage: (count: number) => string
    }
    web: {
      appFailedToBoot: string
      serverNotFound: string
      remoteLoopback: string
      failedToLoad: string
      tryAgain: string
      restarting: string
      askRestart: string
      lookingRestart: (taskId: string) => string
      restartingTitle: string
      restartingMessage: string
      startRestartFailed: (message: string) => string
      restartFailed: string
      hideConsole: string
      showConsole: string
      hideDevTools: string
      openDevTools: string
      goBack: string
      goForward: string
      reload: string
      address: string
      addressPlaceholder: string
      finishedRestarting: (message?: string) => string
      failedRestarting: (message: string) => string
      unknownError: string
      restartedTitle: string
      reloadingNow: string
      restartFailedTitle: string
      restartFailedMessage: string
      stillWorking: string
      workspaceReloading: string
      fileChanged: (url: string) => string
      filesChanged: (count: number, url: string) => string
      watchFailed: (message: string) => string
      moduleMimeDescription: string
      loadFailedConsole: (code: number | undefined, message: string) => string
      unreachableDescription: string
      openTarget: (url: string) => string
      fallbackTitle: string
    }
  }

  zones: {
    showHeader: string
    hideHeader: string
    showStripTab: (title: string) => string
    hideStripTab: (title: string) => string
    lastTabKeptTitle: string
    lastTabKeptBody: string
    toggleStripTab: (title: string) => string
    minimize: string
    restore: string
    closeRunningTitle: string
    closeRunningBody: string
    closeRunningConfirm: string
    reload: string
    closeOthers: string
    closeToRight: string
    closeAll: string
    newSessionTab: string
    newTab: string
    pluginDisabled: (pluginId: string) => string
    pluginDisabledBody: string
    missingPane: (paneId: string) => string
    editTitle: string
    editHint: string
    reset: string
    templates: string
    custom: string
    newGridLayout: string
    saveCurrentAs: string
    nameLayoutPlaceholder: string
    deletePreset: (name: string) => string
    zoneEditorTitle: string
    editorHintPre: string
    editorHintPost: string
    templateColumns: string
    templateRows: string
    templateGrid: string
    templatePriority: string
    zoneTag: (index: number) => string
    mergeZones: (count: number) => string
    customZoneName: (count: number) => string
    layoutNamePlaceholder: (fallback: string) => string
    saveApply: string
    notExpressible: string
    zoneCount: (count: number) => string
    tabCount: (count: number) => string
  }

  contextMenu: {
    link: {
      openInApp: string
      openExternal: string
      copyUrl: string
      copyResolvedUrl: string
    }
    image: {
      copyImage: string
      copyImageAddress: string
      saveImageAs: string
    }
    edit: {
      cut: string
      paste: string
      selectAll: string
      addToDictionary: string
    }
    page: {
      copyPageUrl: string
      inspectElement: string
    }
  }

  assistant: {
    thread: {
      loadingSession: string
      showEarlier: string
      loadingResponse: string
      /** Accessible name of the live status line when it carries no hint. */
      working: string
      /** Status line while auto-compaction runs. */
      summarizingThread: string
      resumeWhenBackgroundDone: (count: number) => string
      thinking: string
      thought: string
      thoughtBriefly: string
      thoughtFor: (duration: string) => string
      worked: string
      workedFor: (duration: string) => string
      turnDuration: (duration: string) => string
      writing: string
      stepOf: (step: number, total: number) => string
      thoughtAbout: (title: string) => string
      today: (time: string) => string
      yesterday: (time: string) => string
      copy: string
      refresh: string
      moreActions: string
      branchNewChat: string
      react: string
      dismissError: string
      filesChanged: (count: number) => string
      reviewChanges: string
      readAloudFailed: string
      preparingAudio: string
      stopReading: string
      readAloud: string
      editMessage: string
      expandMessage: string
      scrollToBottom: string
      stop: string
      restorePrevious: string
      restoreCheckpoint: string
      restoreFromHere: string
      restoreTitle: string
      restoreBody: string
      restoreConfirm: string
      restoreNext: string
      goForward: string
      sendEdited: string
      attachingFile: string
      restoreFailed: string
      timelineLabel: string
    }
    notices: {
      /** A user steering note: "steered · <what they said>". */
      steered: string
      repliedTo: (name: string) => string
      showReply: string
      messaging: (name: string) => string
      messaged: (name: string) => string
      messageFrom: (name: string) => string
      showMessage: string
      output: string
    }
    approval: {
      gatewayDisconnected: string
      sendFailed: string
      title: string
      allow: string
      notNow: string
      more: string
      moreOptions: string
      allowSession: string
      alwaysAllowMenu: string
      jumpToApproval: string
      alwaysTitle: string
      alwaysDescription: (pattern: string) => string
      alwaysAllow: string
    }
    clarify: {
      notReady: string
      gatewayDisconnected: string
      sendFailed: string
      loadingQuestion: string
      other: string
      placeholder: string
      skip: string
      skipped: string
      continueLabel: string
      confirmAndContinueLabel: string
      answeredBadge: string
      questionProgress: (answered: number, total: number) => string
      lateAnswer: (question: string, choice: string) => string
      lateAnswerTip: string
      lateAnswerHint: string
    }
    mcpSetup: {
      installTitle: (server: string) => string
      enableTitle: (server: string) => string
      authorizeTitle: (server: string) => string
      connectTitle: (server: string) => string
      installAction: string
      enableAction: string
      authorizeAction: string
      connectAction: string
      helpersHeader: string
      decline: string
      declined: string
      installed: (server: string) => string
      enabled: (server: string) => string
      authorized: (server: string) => string
      failed: (server: string) => string
      unanswered: string
      toolCount: (count: number) => string
      notInCatalog: (server: string) => string
      catalogSource: string
      work4youAppsSource: string
      loginRequired: string
      envRequired: string
      sendFailed: string
      reloadFailed: string
      gatewayDisconnected: string
    }
    tool: {
      copyCode: string
      renderingImage: string
      copyOutput: string
      copyCommand: string
      copyContent: string
      copyUrl: string
      copyResults: string
      copyQuery: string
      copyFile: string
      copyPath: string
      outputAlt: string
      rawResponse: string
      copyActivity: string
      recoveredOne: string
      recoveredMany: (count: number) => string
      failedOne: string
      failedMany: (count: number) => string
      statusRunning: string
      statusError: string
      statusRecovered: string
      statusDone: string
      /** Over-budget / rejected memory write title — not "Saved to memory". */
      memoryWriteNoted: string
      actions: {
        read: string
        reading: string
        opened: string
        opening: string
        failedToOpen: string
        searched: string
        searching: string
        ran: string
        running: string
        ranCode: string
        runningCode: string
      }
      prefixes: {
        browser: string
        web: string
      }
      titleTemplates: {
        actionCommand: (action: string, command: string) => string
        actionQuoted: (action: string, value: string) => string
        actionTarget: (action: string, target: string) => string
        prefixedDone: (prefix: string, action: string) => string
        runningPrefixedTool: (prefix: string, action: string) => string
        runningTool: (action: string) => string
      }
      /** The one line that stands in for a run of tool calls — "Explored 3 files, ran 5 commands". */
      searchResults: string
      detailLabels: { details: string; errorDetails: string; snapshotSummary: string }
      /** "3 matches", "1 result" — the counts tool rows report. */
      countNouns: Record<ToolCountNoun, (count: number) => string>
      runSummary: {
        categories: Record<ToolRunCategory, ToolRunCategoryCopy>
        /** One clause: a verb and what it acted on, a target ("status.ts") or a count ("3 files"). */
        clause: (verb: string, object: string) => string
        /** A step named on its own that ran more than once: "Used the preview 3 times". */
        repeated: (action: string, count: number) => string
        /** Between clauses. */
        separator: string
      }
      titles: Record<ToolTitleKey, ToolTitleCopy>
      payload: string
      traceArguments: string
      traceResult: string
      searchLabel: string
      generatedImageAlt: string
      truncated: (count: string) => string
      details: string
      snapshotSummary: string
      errorDetails: string
      toolError: string
      toolFailure: string
      toolStatus: (status: string) => string
      commandFailed: (code: number) => string
      navigated: string
      snapshotCaptured: string
      snapshotStats: (buttons: number, links: number, inputs: number) => string
      topControls: (labels: string) => string
      clickedPage: string
      clickedRef: (ref: string) => string
      clickedTarget: (target: string) => string
      fieldLabel: (field: string) => string
      valueLabel: (value: string) => string
      filledInput: string
      queryLabel: (query: string) => string
      queriedWeb: string
      executedCommand: string
      changedFile: string
      fetchedWebpage: string
      cron: {
        jobCount: (count: number) => string
        noJobs: string
        noJobsScheduled: string
        jobFallback: string
        schedule: string
        repeat: string
        delivery: string
        nextRun: string
      }
      /** Nouns for result-count badges ("13 entries"). Nouns a tool reports that
       *  aren't listed here keep the English plural. */
      delegateTaskFallback: (index: number) => string
      delegatedTask: string
    }
    alerts: {
      caution: string
      important: string
      note: string
      tip: string
      warning: string
    }
    embeds: {
      load: (label: string) => string
      alwaysAllow: (label: string) => string
      failed: (label: string) => string
      frameTitle: (label: string) => string
      holdToZoom: string
      openDiagram: string
    }
    references: {
      file: string
      folder: string
      url: string
      image: string
      tool: string
      line: string
      terminal: string
      session: string
      git: string
      diff: string
      staged: string
      command: string
      skill: string
      theme: string
      emoji: string
      other: string
    }
    markdown: {
      fetchFailed: (name: string) => string
      openAudioFile: string
      openVideoFile: string
      openFile: (name: string) => string
      loadingFile: (name: string) => string
      loadFailed: (name: string) => string
    }
    reactions: {
      search: string
      loading: string
      empty: string
      more: string
      remove: (emoji: string) => string
      reactedByAgent: string
    }
  }

  prompts: {
    gatewayDisconnected: string
    sudoSendFailed: string
    secretSendFailed: string
    sudoTitle: string
    sudoDesc: string
    sudoPlaceholder: string
    secretTitle: string
    secretDesc: string
    secretPlaceholder: string
  }

  desktop: {
    audioReadFailed: string
    sessionUnavailable: string
    createSessionFailed: string
    promptFailed: string
    providerCredentialRequired: string
    emptySlashCommand: string
    desktopCommands: string
    skillCommandsAvailable: (count: number) => string
    warningLine: (message: string) => string
    yoloArmed: string
    yoloOff: string
    yoloSystem: (active: boolean) => string
    yoloTitle: string
    yoloToggleFailed: string
    profileStatus: (current: string) => string
    unknownProfile: string
    noProfileNamed: (target: string, available: string) => string
    newChatsProfile: (name: string) => string
    setProfileFailed: string
    sttDisabled: string
    stopFailed: string
    regenerateFailed: string
    editFailed: string
    editTurnUnavailable: string
    resumeFailed: string
    resumeStrandedTitle: string
    resumeStrandedBody: string
    resumeRetry: string
    nothingToBranch: string
    branchNeedsChat: string
    sessionBusy: string
    branchStopCurrent: string
    branchNoText: string
    branchTitle: (n: number) => string
    branchFailed: string
    deleteFailed: string
    archived: string
    archiveFailed: string
    cwdChangeFailed: string
    cwdStagedTitle: string
    cwdStagedMessage: string
    modelSwitchFailed: string
    sessionExported: string
    sessionExportFailed: string
    imageSaved: string
    downloadStarted: string
    restartToUseSaveImage: string
    restartToSaveImages: string
    imageDownloadFailed: string
    openImage: string
    downloadImage: string
    savingImage: string
    imagePreviewFailed: string
    imageAttach: string
    imageWriteFailed: string
    imageAttachFailed: string
    attachImages: string
    clipboard: string
    noClipboardImage: string
    clipboardPasteFailed: string
    dropFiles: string
    handoff: {
      pickPlatform: string
      success: (platform: string) => string
      systemNote: (platform: string) => string
      failed: (error: string) => string
      timedOut: string
    }
    openSessionFailed: string
    previewTargetFailed: (target: string) => string
    gatewayErrorTitle: string
    gatewayErrorFallback: string
    dangerousCommand: string
    remoteAttachTooLarge: (label: string, maxMb: number | null) => string
    attachFailed: {
      folder: (path: string) => string
      named: (name: string) => string
      read: (name: string) => string
      file: string
      image: string
    }
    restore: {
      noSession: string
      notFound: string
      emptyMessage: string
    }
    previewRestart: {
      noSession: string
      noTask: string
    }
    artifactOpen: {
      bridgeUnavailable: string
      writeFailed: string
    }
    pdfPreview: {
      requiresObjectUrl: string
      invalidDataUrl: string
      invalidType: string
      invalidPayload: string
      invalidHeader: string
    }
    quickEntry: {
      placeholder: string
      disconnected: string
      sendTo: string
      targetSession: string
      currentChat: string
    }
    moa: {
      reference: string
      referenceOf: (index: number, count: number) => string
      refs: (done: number, total: number) => string
      aggregating: string
      defaultLabel: string
    }
    slash: {
      unavailable: (name: string) => string
      noOutput: (name: string) => string
      noOutputPlain: string
      skillPayloadMissing: (name: string) => string
      emptyMessage: (name: string) => string
      busyQueued: string
      busyInterrupt: string
      error: (message: string) => string
      invalidDispatch: string
      commandFailed: (name: string, error: string) => string
      compressing: string
      compressingFor: (topic: string) => string
      compressed: (count: number) => string
      nothingToCompress: string
      titleSet: (title: string, queued: boolean) => string
      titleCleared: string
      petScaleUsage: string
      noCommands: string
      steeredQueued: (text: string) => string
      steeredNext: string
      steerRejected: string
      stoppedProcesses: (count: number) => string
      noProcesses: string
      savedTranscript: (file: string) => string
      usage: (calls: string, input: string, output: string, total: string) => string
      noTasks: string
      wake: {
        title: string
        state: (listening: boolean) => string
        phrase: (phrase: string) => string
        provider: (provider: string) => string
        surface: (surface: string) => string
        input: (device: string) => string
        audioSilent: string
        inputError: (error: string) => string
        hint: (hint: string) => string
        systemDefault: string
        usage: string
        startFailed: (reason: string) => string
      }
      browser: {
        remoteOnly: string
        usage: string
        checking: (url: string) => string
        connected: (url: string) => string
        urlUnavailable: string
        notConnected: string
        disconnected: string
        connectedLive: string
        endpoint: (url: string) => string
        nextCall: string
      }
    }
  }

  errors: {
    genericFailure: string
    boundaryTitle: string
    boundaryDesc: string
    reloadWindow: string
    openLogs: string
  }

  ui: {
    search: {
      clear: string
    }
    pagination: {
      label: string
      previous: string
      previousAria: string
      next: string
      nextAria: string
    }
    sidebar: {
      title: string
      description: string
      toggle: (open: boolean) => string
    }
    splitButton: {
      moreActions: string
    }
    zoom: {
      openFullView: string
      zoomOut: string
      reset: string
      zoomIn: string
    }
    pets: {
      spriteLabel: (name: string) => string
      spriteFallbackLabel: string
      hatchingProgress: string
      unavailableTitle: string
      unavailableBody: string
      setUpImageGen: string
      grabKeyFrom: string
      examples: readonly string[]
      examplePrompt: (example: string) => string
      referenceFallbackName: string
      removeReference: string
      addReference: string
      overlayPlaceholder: string
      openInApp: string
      notifyView: string
      draftsReadyTitle: string
      draftsReadyBody: string
      generateFailedTitle: string
      reopenToRetry: string
      hatchedTitle: string
      hatchedBody: string
      hatchFailedTitle: string
      generateFailed: string
      hatchFailed: string
      adoptFailed: string
      bubble: {
        run: readonly string[]
        review: readonly string[]
        failed: readonly string[]
        waiting: readonly string[]
      }
    }
  }

  // Empty-chat greeting, per personality. English lives in
  // components/chat/intro-copy.jsonl; a locale overrides it here.
  intro: {
    /** Each stock personality's greetings, in the JSONL's rotation order.
     *  Empty in English, which reads the JSONL. */
    stock: Readonly<Record<string, readonly IntroCopy[]>>
    /** Greetings for a personality the stock list does not know. */
    custom: (label: string) => readonly IntroCopy[]
    /** Last-resort neutral greetings. */
    neutral: readonly IntroCopy[]
  }
}
