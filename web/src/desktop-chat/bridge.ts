/**
 * Browser shim for `window.work4youDesktop` so the desktop chat renderer can
 * boot against the dashboard's already-running backend (no Electron spawn).
 */

import type { GatewayWsUrlResult } from "@work4you/shared";

import {
  WORK4YOU_BASE_PATH,
  authedFetch,
  buildWsUrl,
  fetchJSON,
  getManagementProfile,
} from "../lib/api";
import { copyTextToClipboard } from "../lib/clipboard";

type Work4YouApiRequest = {
  path: string;
  method?: string;
  body?: unknown;
  upload?: { filename: string; contentType?: string; bytes: ArrayBuffer };
  timeoutMs?: number;
  profile?: string | null;
  connectionId?: string | null;
};

type Work4YouConnection = {
  baseUrl: string;
  wsUrl: string;
  mode: "local";
  authMode: "oauth" | "token";
  token: string;
  isFullscreen: boolean;
  nativeOverlayWidth: number;
  windowButtonPosition: null;
  logs: string[];
  profile?: string;
};

function noopUnsub(): void {}

function appendRequestProfile(url: string, profile?: string | null): string {
  const scoped = (profile ?? "").trim() || getManagementProfile().trim();
  if (!scoped) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}profile=${encodeURIComponent(scoped)}`;
}

async function apiRequest<T>(request: Work4YouApiRequest): Promise<T> {
  const method = (request.method ?? "GET").toUpperCase();
  const path = appendRequestProfile(request.path, request.profile);

  if (request.upload) {
    const form = new FormData();
    const blob = new Blob([request.upload.bytes], {
      type: request.upload.contentType ?? "application/octet-stream",
    });
    form.append("file", blob, request.upload.filename);
    const res = await authedFetch(path, { method, body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  const init: RequestInit = { method };
  if (request.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(request.body);
  }

  return fetchJSON<T>(path, init);
}

function dashboardBaseUrl(): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1";
  return `${origin}${WORK4YOU_BASE_PATH}`;
}

async function buildConnection(profile?: string | null): Promise<Work4YouConnection> {
  const wsUrl = await buildWsUrl("/api/ws");
  const authMode = window.__WORK4YOU_AUTH_REQUIRED__ ? "oauth" : "token";
  const token = window.__WORK4YOU_SESSION_TOKEN__ ?? "";

  return {
    baseUrl: dashboardBaseUrl(),
    wsUrl,
    mode: "local",
    authMode,
    token,
    isFullscreen: false,
    nativeOverlayWidth: 0,
    windowButtonPosition: null,
    logs: [],
    ...(profile ? { profile } : {}),
  };
}

let installed = false;

export function installWebDesktopBridge(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const desktop = {
    api: apiRequest,
    getConnection: async (profile?: string | null) => buildConnection(profile),
    getConnectionFor: async (payload?: {
      connectionId?: string | null;
      profile?: string | null;
    }) => buildConnection(payload?.profile),
    getGatewayWsUrl: async (profile?: string | null): Promise<GatewayWsUrlResult> => {
      void profile;
      return { ok: true, wsUrl: await buildWsUrl("/api/ws") };
    },
    getGatewayWsUrlFor: async (payload?: {
      connectionId?: string | null;
      profile?: string | null;
    }): Promise<GatewayWsUrlResult> => {
      void payload;
      return { ok: true, wsUrl: await buildWsUrl("/api/ws") };
    },
    revalidateConnection: async () => ({ ok: true, rebuilt: false }),
    touchBackend: async () => ({ ok: true }),
    getBootProgress: async () => ({
      error: null,
      fakeMode: false,
      message: "",
      phase: "ready",
      progress: 100,
      running: false,
      timestamp: Date.now(),
    }),
    onBootProgress: () => noopUnsub,
    onPowerResume: () => noopUnsub,
    onConnectionApplied: () => noopUnsub,
    onBackendExit: () => noopUnsub,
    getVersion: async () => ({
      appVersion: "web-dashboard",
      electronVersion: "",
      nodeVersion: "",
      platform: navigator.platform,
      work4youRoot: "",
    }),
    openExternal: async (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    writeClipboard: async (text: string) => copyTextToClipboard(text),
    readClipboard: async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return "";
      }
    },
    notify: async (payload: { title?: string; body?: string }) => {
      if (typeof Notification === "undefined") return false;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return false;
      new Notification(payload.title ?? "Work4You", { body: payload.body });
      return true;
    },
    getPathForFile: (file: File) => file.name,
    readFileDataUrl: async () => {
      throw new Error("Local file reads are not available in the web dashboard chat.");
    },
    readFileText: async () => {
      throw new Error("Local file reads are not available in the web dashboard chat.");
    },
    selectPaths: async () => [] as string[],
    openSessionWindow: async () => ({ ok: false, error: "unsupported" }),
    openWindow: async () => ({ ok: false, error: "unsupported" }),
    openSessionInTerminal: async () => ({ ok: false, error: "unsupported" }),
    claimAmbientCue: async () => true,
    getProfileRoutes: async (profiles: string[]) =>
      profiles.map((profile) => ({
        connectionId: "local",
        mode: "local" as const,
        profile,
        targetProfile: profile,
      })),
    profile: {
      get: async () => ({ profile: getManagementProfile() || null }),
      set: async (name: string | null) => ({ profile: name }),
    },
    connections: {
      list: async () => ({
        version: 2,
        primary: "local",
        secureTokenStorage: false,
        connections: [
          {
            id: "local",
            kind: "local" as const,
            label: "Dashboard",
            tokenSet: Boolean(window.__WORK4YOU_SESSION_TOKEN__),
            tokenPreview: null,
          },
        ],
      }),
      save: async () => {
        throw new Error("Connection registry is not editable in the web dashboard.");
      },
      remove: async () => {
        throw new Error("Connection registry is not editable in the web dashboard.");
      },
      setPrimary: async () => {
        throw new Error("Connection registry is not editable in the web dashboard.");
      },
      test: async () => ({ ok: true, reachable: true }),
    },
    settings: {
      getDefaultProjectDir: async () => ({
        defaultLabel: "Project",
        dir: null,
        resolvedCwd: "",
      }),
      pickDefaultProjectDir: async () => ({ canceled: true, dir: null }),
      setDefaultProjectDir: async (dir: string | null) => ({ dir }),
    },
    sanitizeWorkspaceCwd: async (cwd?: string | null) => ({
      cwd: cwd ?? "",
      sanitized: false,
    }),
    translucencySupported: false,
    glassSupported: false,
    terminal: {
      cwd: async () => null,
      dispose: async () => true,
      onData: () => noopUnsub,
      onExit: () => noopUnsub,
      resize: async () => true,
      start: async () => {
        throw new Error("Embedded terminal is not available in the web dashboard chat.");
      },
      write: async () => true,
    },
    updates: {
      check: async () => ({ supported: false }),
      apply: async () => ({ ok: false, error: "unsupported" }),
      getBranch: async () => ({ branch: "main" }),
      setBranch: async (branch: string) => ({ branch }),
      onProgress: () => noopUnsub,
    },
    findInPage: async () => ({ count: 0 }),
    stopFindInPage: async () => {},
    onFoundInPage: () => noopUnsub,
    onOpenFindBarRequested: () => noopUnsub,
    onPreviewFileChanged: () => noopUnsub,
    onWindowStateChanged: () => noopUnsub,
    onFocusSession: () => noopUnsub,
    onNotificationAction: () => noopUnsub,
    onNotificationActivate: () => noopUnsub,
    getBootstrapState: async () => ({
      active: false,
      manifest: null,
      stages: {},
      error: null,
      log: [],
      startedAt: null,
      completedAt: Date.now(),
      setupChoice: null,
      unsupportedPlatform: null,
    }),
    continueBootstrapLocal: async () => ({ ok: true }),
    resetBootstrap: async () => ({ ok: true }),
    repairBootstrap: async () => ({ ok: true }),
    cancelBootstrap: async () => ({ ok: true, cancelled: true }),
    onBootstrapEvent: () => noopUnsub,
    signalDeepLinkReady: async () => ({ ok: true }),
    saveImageFromUrl: async () => false,
    saveImageBuffer: async () => {
      throw new Error("Saving images to disk is not available in the web dashboard.");
    },
    saveClipboardImage: async () => {
      throw new Error("Saving images to disk is not available in the web dashboard.");
    },
    fetchLinkTitle: async (url: string) => url,
    readDir: async () => ({ entries: [] }),
    revealPath: async () => false,
    openDir: async () => ({ ok: false, error: "unsupported" }),
    setKeepAwake: () => {},
    setDisableF12: () => {},
    setPreviewShortcutActive: () => {},
    setTitleBarTheme: () => {},
    setNativeTheme: () => {},
    setTranslucency: () => {},
    setActiveWork: () => {},
    contextMenuEdit: async () => {},
    contextMenuCopyImage: async () => {},
    contextMenuSpellcheck: async () => {},
    onContextMenuSpellcheck: () => noopUnsub,
    reportRendererError: () => {},
    getOnBattery: async () => false,
    onBatteryChanged: () => noopUnsub,
    getRecentLogs: async () => ({ path: "", lines: [] }),
    revealLogs: async () => ({ ok: false, path: "", error: "unsupported" }),
    requestMicrophoneAccess: async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
      } catch {
        return false;
      }
    },
    petOverlay: {
      open: async () => ({ ok: false }),
      close: async () => ({ ok: true }),
      setBounds: () => {},
      setIgnoreMouse: () => {},
      setFocusable: () => {},
      pushState: () => {},
      control: () => {},
      onState: () => noopUnsub,
      onControl: () => noopUnsub,
    },
    quickEntry: {
      getSettings: async () => ({
        enabled: false,
        registered: false,
        shortcut: "",
      }),
      setSettings: async () => ({
        enabled: false,
        registered: false,
        shortcut: "",
      }),
      submit: () => {},
      dismiss: () => {},
      pushState: () => {},
      onState: () => noopUnsub,
      onSubmit: () => noopUnsub,
      onShown: () => noopUnsub,
    },
    cloud: {
      status: async () => ({
        portalBaseUrl: "",
        signedIn: false,
      }),
      login: async () => ({ portalBaseUrl: "", signedIn: false, ok: false }),
      logout: async () => ({ portalBaseUrl: "", signedIn: false, ok: true }),
      discover: async () => ({ agents: [] }),
      agentSignIn: async () => ({ baseUrl: "", connected: false }),
    },
    themes: {
      fetchMarketplace: async () => {
        throw new Error("Marketplace themes are not available in the web dashboard.");
      },
      searchMarketplace: async () => [],
    },
    uninstall: {
      summary: async () => ({
        work4you_home: "",
        agent_installed: false,
        gui_installed: false,
        source_built_artifacts: [],
        packaged_app_paths: [],
        userdata_dir: "",
        userdata_exists: false,
        platform: navigator.platform,
      }),
      run: async () => ({ ok: false, error: "unsupported" }),
    },
    sshConfigHosts: async () => ({ hosts: [] }),
    sshResolveHost: async () => ({
      hostname: null,
      identityFile: null,
      port: null,
      user: null,
    }),
    probeConnectionConfig: async (remoteUrl: string) => ({
      baseUrl: remoteUrl,
      reachable: false,
      authMode: "unknown" as const,
      providers: [],
      version: null,
      error: "unsupported",
    }),
    oauthLoginConnectionConfig: async () => ({
      ok: false,
      baseUrl: "",
      connected: false,
    }),
    oauthLogoutConnectionConfig: async () => ({ ok: true, connected: false }),
    getConnectionConfig: async () => ({
      envOverride: false,
      mode: "local" as const,
      profile: null,
      remoteAuthMode: "token" as const,
      remoteOauthConnected: false,
      remoteTokenPreview: null,
      remoteTokenSet: false,
      secureTokenStorage: false,
      remoteTokenPlainText: false,
      remoteUrl: "",
      cloudOrg: "",
      sshHost: "",
      sshUser: "",
      sshPort: null,
      sshKeyPath: "",
      sshRemoteWork4YouPath: "",
      sshRemoteProfile: "",
    }),
    saveConnectionConfig: async () => {
      throw new Error("Connection settings are not editable in the web dashboard.");
    },
    applyConnectionConfig: async () => {
      throw new Error("Connection settings are not editable in the web dashboard.");
    },
    testConnectionConfig: async () => ({ ok: true, reachable: true }),
    dataUrlReadMax: {
      get: async () => ({ defaultMaxMb: 8, maxBytes: 8 * 1024 * 1024, maxMb: 8 }),
      set: async (maxMb: number) => ({
        defaultMaxMb: 8,
        maxBytes: maxMb * 1024 * 1024,
        maxMb,
      }),
    },
    zoom: {
      get: async () => ({ level: 0, percent: 100 }),
      setPercent: () => {},
      onChanged: () => noopUnsub,
    },
    wakeIndicator: {
      getState: async () => ({ active: false, label: "" }),
      setState: () => {},
      onState: () => noopUnsub,
    },
    hud: undefined,
    readWindowBelow: async () => null,
    reachPreviewUrl: async (url: string) => url,
    onClosePreviewRequested: () => noopUnsub,
    onPreviewNav: () => noopUnsub,
    onOpenFolderRequested: () => noopUnsub,
    onOpenUpdatesRequested: () => noopUnsub,
    onDeepLink: () => noopUnsub,
    probePluginRepo: async () => ({ ok: false, agent: false, desktop: false }),
    installDesktopPlugin: async () => ({ ok: false, error: "unsupported" }),
    desktopPluginsRoot: async () => "",
    agentPluginsRoot: async () => "",
    renamePath: async () => {
      throw new Error("Filesystem writes are not available in the web dashboard.");
    },
    writeTextFile: async () => {
      throw new Error("Filesystem writes are not available in the web dashboard.");
    },
    trashPath: async () => false,
    gitRoot: async () => null,
    git: undefined,
    saveGatewayFile: async () => ({ saved: false, canceled: true }),
    selectSavePath: async () => null,
    openPreviewInBrowser: async (url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    watchPreviewFile: async () => ({ id: "", path: "" }),
    watchDirectory: async () => ({ id: "", path: "" }),
    stopPreviewFileWatch: async () => true,
    normalizePreviewTarget: async () => null,
    readFileDataUrlForAttach: async () => {
      throw new Error("Local file reads are not available in the web dashboard.");
    },
    contextMenuGuestAddWord: async () => {},
    getAgentRoster: async () => ({ agents: [], sources: [] }),
  };

  Object.defineProperty(window, "work4youDesktop", {
    value: desktop,
    configurable: true,
    writable: true,
  });
}

export function removeWebDesktopBridge(): void {
  if (!installed || typeof window === "undefined") return;
  installed = false;
  Reflect.deleteProperty(window, "work4youDesktop");
}
