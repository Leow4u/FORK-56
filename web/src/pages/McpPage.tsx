import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { KeyRound, Power, Search, Trash2, X, Zap } from "lucide-react";
import { Badge } from "@work4you/ui/ui/components/badge";
import { Button } from "@work4you/ui/ui/components/button";
import { Select, SelectOption } from "@work4you/ui/ui/components/select";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { H2 } from "@work4you/ui/ui/components/typography/h2";
import { api } from "@/lib/api";
import type {
  ConnectorsDirectoryApp,
  McpCatalogDiagnostic,
  McpCatalogEntry,
  McpHttpAuth,
  McpServer,
  McpTestResult,
} from "@/lib/api";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useToast } from "@work4you/ui/hooks/use-toast";
import { useConfirmDelete } from "@work4you/ui/hooks/use-confirm-delete";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { Toast } from "@work4you/ui/ui/components/toast";
import { Card, CardContent } from "@work4you/ui/ui/components/card";
import { Input } from "@work4you/ui/ui/components/input";
import { Label } from "@work4you/ui/ui/components/label";
import { Segmented } from "@work4you/ui/ui/components/segmented";
import { usePageHeader } from "@/contexts/usePageHeader";
import { cn, themedBody } from "@/lib/utils";
import {
  buildMcpServerCreate,
  type McpTransport,
} from "@/lib/mcp-server-create";
import { completeMcpDashboardOAuth } from "@/lib/mcp-dashboard-oauth";
import { brandFor, brandGlyphStyle } from "@/lib/mcp-brands";
import { mcpCatalogPrimaryAction } from "@/lib/mcp-directory-filter";
import {
  completeComposioConnect,
  DIRECTORY_SECTION_IDS,
  DIRECTORY_SECTION_LABELS,
  directoryAppDescription,
  directoryAppLogoUrl,
  filterDirectoryApps,
  groupDirectorySections,
  isTrustedComposioLogoUrl,
  type DirectoryApp,
  type McpDirectoryFilter,
} from "@work4you/shared";
import { prettyName } from "@/lib/text";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
}

function directoryNativeEntry(
  app: DirectoryApp,
  found: McpCatalogEntry | undefined,
): McpCatalogEntry {
  if (found) return found;
  const authType =
    app.auth_type === "oauth" || app.auth_type === "api_key"
      ? app.auth_type
      : "none";
  return {
    name: app.id,
    description: app.description,
    source: "official",
    transport: "http",
    auth_type: authType,
    required_env: app.required_env ?? [],
    command: null,
    args: [],
    url: null,
    install_url: null,
    install_ref: null,
    bootstrap: [],
    default_enabled: null,
    post_install: "",
    needs_install: Boolean(app.needs_install),
    installed: Boolean(app.installed),
    enabled: Boolean(app.enabled),
  };
}

function McpBrandMark({ logo, name }: { logo?: string | null; name: string }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  const src =
    typeof logo === "string" &&
    isTrustedComposioLogoUrl(logo) &&
    failedLogo !== logo
      ? logo
      : null;

  const brand = src ? null : brandFor(name);
  return (
    <span
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-md text-sm font-medium",
        src && "bg-white",
        !src && !brand && "bg-muted text-muted-foreground",
      )}
      style={
        !src && brand
          ? {
              backgroundColor: `color-mix(in srgb, ${brand.color} 16%, transparent)`,
            }
          : undefined
      }
    >
      {src ? (
        <img
          alt=""
          className="size-5 object-contain"
          decoding="async"
          onError={() => setFailedLogo(src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : brand ? (
        <brand.Icon
          aria-hidden
          className="size-4"
          style={brandGlyphStyle(brand)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

export default function McpPage({ embedded = false }: { embedded?: boolean }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [catalog, setCatalog] = useState<McpCatalogEntry[]>([]);
  const [directory, setDirectory] = useState<ConnectorsDirectoryApp[]>([]);
  const [diagnostics, setDiagnostics] = useState<McpCatalogDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToast();
  const { setEnd } = usePageHeader();

  // Add server modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransport>("http");
  const [url, setUrl] = useState("");
  const [httpAuth, setHttpAuth] = useState<McpHttpAuth>("none");
  const [bearerToken, setBearerToken] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [env, setEnv] = useState("");
  const [creating, setCreating] = useState(false);
  const closeCreateModal = useCallback(() => {
    setBearerToken("");
    setCreateModalOpen(false);
  }, []);
  const createModalRef = useModalBehavior({
    open: createModalOpen,
    onClose: closeCreateModal,
  });

  // Test results keyed by server name
  const [testing, setTesting] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, McpTestResult>>(
    {},
  );

  // Enable/disable state
  const [togglingName, setTogglingName] = useState<string | null>(null);
  const [restartNote, setRestartNote] = useState<string | null>(null);

  // Catalog install modal state
  const [installEntry, setInstallEntry] = useState<McpCatalogEntry | null>(
    null,
  );
  const [installEnv, setInstallEnv] = useState<Record<string, string>>({});
  const [installingName, setInstallingName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] =
    useState<McpDirectoryFilter>("discover");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const closeInstallModal = useCallback(() => setInstallEntry(null), []);
  const installModalRef = useModalBehavior({
    open: installEntry !== null,
    onClose: closeInstallModal,
  });

  const loadServers = useCallback(() => {
    return api
      .getMcpServers()
      .then((res) => setServers(res.servers))
      .catch((e) => showToast(`Error: ${e}`, "error"));
  }, [showToast]);

  const loadCatalog = useCallback(() => {
    return api
      .getMcpCatalog()
      .then((res) => {
        setCatalog(res.entries);
        setDiagnostics(res.diagnostics);
      })
      .catch((e) => showToast(`Error: ${e}`, "error"));
  }, [showToast]);

  const loadDirectory = useCallback(() => {
    return api
      .getConnectorsDirectory()
      .then((res) => {
        setDirectory(res.apps);
      })
      .catch((e) => showToast(`Error: ${e}`, "error"));
  }, [showToast]);

  useEffect(() => {
    Promise.all([loadServers(), loadCatalog(), loadDirectory()]).finally(() =>
      setLoading(false),
    );
  }, [loadServers, loadCatalog, loadDirectory]);

  const handleCreate = async () => {
    let body;
    try {
      body = buildMcpServerCreate({
        name,
        transport,
        url,
        httpAuth,
        bearerToken,
        command,
        args,
        env,
      });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Invalid MCP server",
        "error",
      );
      return;
    }

    setCreating(true);
    try {
      await api.addMcpServer(body);
      showToast(
        transport === "http" && httpAuth === "oauth"
          ? "Added — authenticate with OAuth"
          : "Add ✓",
        "success",
      );
      setName("");
      setUrl("");
      setHttpAuth("none");
      setBearerToken("");
      setCommand("");
      setArgs("");
      setEnv("");
      setTransport("http");
      setCreateModalOpen(false);
      void Promise.all([loadServers(), loadDirectory()]);
    } catch (e) {
      showToast(`Failed to add: ${e}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (server: McpServer) => {
    setTesting(server.name);
    try {
      const result = await api.testMcpServer(server.name);
      setTestResults((prev) => ({ ...prev, [server.name]: result }));
      if (result.ok) {
        showToast(`${server.name}: ${result.tools.length} tool(s)`, "success");
      } else {
        showToast(`${server.name}: ${result.error ?? "Failed"}`, "error");
      }
    } catch (e) {
      showToast(`Error: ${e}`, "error");
    } finally {
      setTesting(null);
    }
  };

  const handleAuthenticate = async (server: McpServer) => {
    setAuthenticating(server.name);
    try {
      const result = await completeMcpDashboardOAuth({
        serverName: server.name,
        start: api.authMcpServer,
        status: api.getMcpOAuthFlow,
        open: window.open.bind(window),
      });
      setTestResults((prev) => ({
        ...prev,
        [server.name]: { ok: true, tools: result.tools ?? [] },
      }));
      showToast(`${server.name}: OAuth authentication complete`, "success");
    } catch (e) {
      showToast(`OAuth error: ${e}`, "error");
    } finally {
      setAuthenticating(null);
    }
  };

  const handleToggleEnabled = async (server: McpServer) => {
    const next = !server.enabled;
    setTogglingName(server.name);
    try {
      await api.setMcpServerEnabled(server.name, next);
      setServers((prev) =>
        prev.map((s) => (s.name === server.name ? { ...s, enabled: next } : s)),
      );
      setRestartNote(
        "Enable/disable takes effect on the next gateway restart.",
      );
    } catch (e) {
      showToast(`Error: ${e}`, "error");
    } finally {
      setTogglingName(null);
    }
  };

  const serverDelete = useConfirmDelete({
    onDelete: useCallback(
      async (serverName: string) => {
        try {
          await api.removeMcpServer(serverName);
          showToast(`Delete: "${truncateText(serverName, 30)}"`, "success");
          setTestResults((prev) => {
            const next = { ...prev };
            delete next[serverName];
            return next;
          });
          loadServers();
          void loadDirectory();
        } catch (e) {
          showToast(`Error: ${e}`, "error");
          throw e;
        }
      },
      [loadServers, loadDirectory, showToast],
    ),
  });

  // ── Catalog install ──────────────────────────────────────────────────
  const runInstall = useCallback(
    async (entry: McpCatalogEntry, envMap: Record<string, string>) => {
      setInstallingName(entry.name);
      try {
        const res = await api.installMcpCatalogEntry(entry.name, envMap, true);
        if (res.background) {
          showToast("Installing in background…", "success");
        } else {
          showToast(`Installed: "${truncateText(entry.name, 30)}"`, "success");
        }
        setInstallEntry(null);
        setInstallEnv({});
        await Promise.all([loadServers(), loadCatalog(), loadDirectory()]);
      } catch (e) {
        showToast(`Failed to install: ${e}`, "error");
      } finally {
        setInstallingName(null);
      }
    },
    [loadServers, loadCatalog, loadDirectory, showToast],
  );

  const handleInstallClick = (entry: McpCatalogEntry) => {
    if (entry.required_env.length > 0) {
      const initial: Record<string, string> = {};
      entry.required_env.forEach((item) => {
        initial[item.name] = "";
      });
      setInstallEnv(initial);
      setInstallEntry(entry);
    } else {
      void runInstall(entry, {});
    }
  };

  const handleInstallSubmit = () => {
    if (!installEntry) return;
    const missing = installEntry.required_env.filter(
      (item) => item.required && !(installEnv[item.name] ?? "").trim(),
    );
    if (missing.length > 0) {
      showToast(`${missing[0].prompt} required`, "error");
      return;
    }
    const envMap: Record<string, string> = {};
    Object.entries(installEnv).forEach(([k, v]) => {
      if (v.trim()) envMap[k] = v.trim();
    });
    void runInstall(installEntry, envMap);
  };

  const handleConnectComposio = async (app: DirectoryApp) => {
    if (app.needs_login) {
      showToast("Sign in to Work4You to connect this app.", "error");
      return;
    }
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setConnectingSlug(app.id);
    try {
      await api.bootstrapConnectors();
      const ok = await completeComposioConnect({
        authorize: () => api.authorizeConnector(app.id),
        wait: () => api.waitConnector(app.id),
        open: (url) => {
          if (popup && !popup.closed) {
            popup.location.href = url;
          } else {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        },
      });
      if (ok) {
        showToast(
          `${app.name} connected — available in new sessions.`,
          "success",
        );
      }
      await loadDirectory();
    } catch (e) {
      popup?.close();
      showToast(`Failed to connect: ${e}`, "error");
    } finally {
      setConnectingSlug(null);
    }
  };

  const handleDisconnectComposio = async (app: DirectoryApp) => {
    setConnectingSlug(app.id);
    try {
      await api.disconnectConnector(app.id);
      showToast(`${app.name} disconnected`, "success");
      await loadDirectory();
    } catch (e) {
      showToast(`Error: ${e}`, "error");
    } finally {
      setConnectingSlug(null);
    }
  };

  // Put "Add Server" button in page header. When embedded (Capabilities →
  // MCP tab), the host page owns the header; an inline button renders in
  // the body instead.
  useLayoutEffect(() => {
    if (embedded) return;
    setEnd(
      <Button
        className="uppercase"
        size="sm"
        onClick={() => setCreateModalOpen(true)}
      >
        Add Server
      </Button>,
    );
    return () => {
      setEnd(null);
    };
  }, [embedded, setEnd, loading]);

  const catalogByName = useMemo(() => {
    const map = new Map<string, McpCatalogEntry>();
    for (const entry of catalog) {
      map.set(entry.name.toLowerCase(), entry);
    }
    return map;
  }, [catalog]);

  const serversByName = useMemo(() => {
    const map = new Map<string, McpServer>();
    for (const server of servers) {
      map.set(server.name, server);
    }
    return map;
  }, [servers]);

  const directoryApps = useMemo(() => {
    const rows: DirectoryApp[] = directory.map((app) => ({
      ...app,
      source: app.source === "composio" ? "composio" : "native",
    }));
    const known = new Set(rows.map((app) => app.id));
    for (const server of servers) {
      if (server.name === "work4you_apps" || known.has(server.name)) continue;
      rows.push({
        id: server.name,
        name: server.name,
        description:
          catalogByName.get(server.name.toLowerCase())?.description ?? "",
        section: "other",
        popular: false,
        source: "custom",
        connected: true,
        auth_type: server.auth ?? undefined,
      });
    }
    return filterDirectoryApps(rows, {
      filter: directoryFilter,
      query,
      section: sectionFilter === "all" ? null : sectionFilter,
    });
  }, [catalogByName, directory, directoryFilter, query, sectionFilter, servers]);

  const directoryGroups = useMemo(
    () => groupDirectorySections(directoryApps),
    [directoryApps],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  const diagnosticsByName: Record<string, McpCatalogDiagnostic[]> = {};
  diagnostics.forEach((d) => {
    (diagnosticsByName[d.name] ??= []).push(d);
  });

  return (
    <div className="flex flex-col gap-6">
      <Toast toast={toast} />

      {embedded && (
        <div className="flex justify-end">
          <Button
            className="uppercase"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
          >
            Add Server
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps..."
            value={query}
          />
        </div>
        <Segmented
          onChange={(v) => setDirectoryFilter(v as McpDirectoryFilter)}
          options={[
            { value: "discover", label: "Discover" },
            { value: "all", label: "All" },
            { value: "connected", label: "Connected" },
            { value: "available", label: "Available" },
          ]}
          value={directoryFilter}
        />
        <select
          aria-label="Category"
          className="h-9 max-w-[12rem] truncate rounded-md border border-border bg-background px-2 text-sm"
          onChange={(e) => setSectionFilter(e.currentTarget.value)}
          value={sectionFilter}
        >
          <option value="all">All categories</option>
          {DIRECTORY_SECTION_IDS.map((id) => (
            <option key={id} value={id}>
              {DIRECTORY_SECTION_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      <DeleteConfirmDialog
        open={serverDelete.isOpen}
        onCancel={serverDelete.cancel}
        onConfirm={serverDelete.confirm}
        title="Remove MCP server"
        description={
          serverDelete.pendingId
            ? `"${truncateText(serverDelete.pendingId, 40)}" — this will remove the server.`
            : "This will remove the server."
        }
        loading={serverDelete.isDeleting}
      />

      {/* Add server modal */}
      {createModalOpen && (
        <div
          ref={createModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4"
          onClick={(e) => e.target === e.currentTarget && closeCreateModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-mcp-title"
        >
          <div
            className={cn(
              themedBody,
              "relative w-full max-w-lg border border-border bg-card shadow-2xl flex flex-col",
            )}
          >
            <Button
              ghost
              size="icon"
              onClick={closeCreateModal}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X />
            </Button>

            <header className="p-5 pb-3 border-b border-border">
              <h2
                id="create-mcp-title"
                className="font-mondwest text-display text-base tracking-wider"
              >
                Add MCP server
              </h2>
            </header>

            <div className="p-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="mcp-name">Name</Label>
                <Input
                  id="mcp-name"
                  autoFocus
                  placeholder="my-server"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mcp-transport">Transport</Label>
                <Select
                  id="mcp-transport"
                  value={transport}
                  onValueChange={(value) => {
                    const nextTransport = value as McpTransport;
                    setTransport(nextTransport);
                    if (nextTransport === "stdio") setBearerToken("");
                  }}
                >
                  <SelectOption value="http">HTTP/SSE</SelectOption>
                  <SelectOption value="stdio">stdio</SelectOption>
                </Select>
              </div>

              {transport === "http" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="mcp-url">URL</Label>
                    <Input
                      id="mcp-url"
                      placeholder="https://example.com/mcp"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mcp-auth">Authentication</Label>
                    <Select
                      id="mcp-auth"
                      value={httpAuth}
                      onValueChange={(value) => {
                        const nextAuth = value as McpHttpAuth;
                        setHttpAuth(nextAuth);
                        if (nextAuth !== "header") setBearerToken("");
                      }}
                    >
                      <SelectOption value="none">None</SelectOption>
                      <SelectOption value="header">Bearer token</SelectOption>
                      <SelectOption value="oauth">OAuth</SelectOption>
                    </Select>
                  </div>
                  {httpAuth === "header" && (
                    <div className="grid gap-2">
                      <Label htmlFor="mcp-bearer-token">Bearer token</Label>
                      <Input
                        id="mcp-bearer-token"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Token or Bearer token"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Stored in this profile&apos;s .env; config.yaml keeps
                        only an environment-variable reference.
                      </p>
                    </div>
                  )}
                  {httpAuth === "oauth" && (
                    <p className="text-xs text-muted-foreground">
                      Add the server, then use Authenticate. Work4You opens the
                      OAuth browser on the machine running the Dashboard
                      backend.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="mcp-command">Command</Label>
                    <Input
                      id="mcp-command"
                      placeholder="npx"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mcp-args">Args</Label>
                    <Input
                      id="mcp-args"
                      placeholder="-y @modelcontextprotocol/server-foo"
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mcp-env">
                      Environment (KEY=VALUE per line)
                    </Label>
                    <textarea
                      id="mcp-env"
                      className="flex min-h-[80px] w-full border border-border bg-background/40 px-3 py-2 text-sm font-courier shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 focus-visible:border-foreground/25"
                      placeholder={"API_KEY=secret\nDEBUG=1"}
                      value={env}
                      onChange={(e) => setEnv(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button
                  className="uppercase"
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating}
                  prefix={creating ? <Spinner /> : undefined}
                >
                  {creating ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog install modal (required env vars) */}
      {installEntry && (
        <div
          ref={installModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4"
          onClick={(e) => e.target === e.currentTarget && setInstallEntry(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-mcp-title"
        >
          <div
            className={cn(
              themedBody,
              "relative w-full max-w-lg border border-border bg-card shadow-2xl flex flex-col",
            )}
          >
            <Button
              ghost
              size="icon"
              onClick={() => setInstallEntry(null)}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X />
            </Button>

            <header className="p-5 pb-3 border-b border-border">
              <h2
                id="install-mcp-title"
                className="font-mondwest text-display text-base tracking-wider"
              >
                Install {installEntry.name}
              </h2>
            </header>

            <div className="p-5 grid gap-4">
              <p className="text-xs text-muted-foreground">
                This MCP requires the following values to be configured.
              </p>
              {installEntry.required_env.map((item) => (
                <div className="grid gap-2" key={item.name}>
                  <Label htmlFor={`install-env-${item.name}`}>
                    {item.prompt}
                    {item.required ? " *" : ""}
                  </Label>
                  <Input
                    id={`install-env-${item.name}`}
                    type="password"
                    placeholder={item.name}
                    value={installEnv[item.name] ?? ""}
                    onChange={(e) =>
                      setInstallEnv((prev) => ({
                        ...prev,
                        [item.name]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}

              <div className="flex justify-end">
                <Button
                  className="uppercase"
                  size="sm"
                  onClick={handleInstallSubmit}
                  disabled={installingName === installEntry.name}
                  prefix={
                    installingName === installEntry.name ? (
                      <Spinner />
                    ) : undefined
                  }
                >
                  {installingName === installEntry.name
                    ? "Installing..."
                    : "Install"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {restartNote && <p className="text-xs text-warning">{restartNote}</p>}

      {directoryApps.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {query.trim()
              ? "No MCP servers match your search."
              : directoryFilter === "available"
                ? "No catalog entries available."
                : "No MCP servers configured."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {directoryGroups.map((group) => (
            <section className="flex flex-col gap-3" key={group.id}>
              <H2 variant="sm" className="text-muted-foreground">
                {group.label}
              </H2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.apps.map((app) => {
                  const server = serversByName.get(app.id);
                  if ((app.source === "native" || app.source === "custom") && server) {
                    const envCount = Object.keys(server.env ?? {}).length;
                    const result = testResults[server.name];
                    const description =
                      app.description ||
                      catalogByName.get(server.name.toLowerCase())?.description;
                    return (
                      <Card key={`${group.id}-${app.id}`}>
                        <CardContent
                          className={cn(
                            "flex items-start gap-3 py-4",
                            !server.enabled && "opacity-60",
                          )}
                        >
                          <McpBrandMark logo={directoryAppLogoUrl(app)} name={app.id} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {app.name || prettyName(server.name)}
                              </span>
                              {!server.enabled && (
                                <Badge tone="outline">disabled</Badge>
                              )}
                            </div>
                            {description && (
                              <p className="mb-1 text-xs text-muted-foreground line-clamp-2">
                                {description}
                              </p>
                            )}
                            {result && (
                              <div className="text-xs">
                                {result.ok ? (
                                  <p className="text-success">
                                    {result.tools.length === 0
                                      ? "Connected — no tools"
                                      : `Tools: ${result.tools
                                          .map((tool) => tool.name)
                                          .join(", ")}`}
                                  </p>
                                ) : (
                                  <p className="text-destructive">
                                    {result.error ?? "Connection failed"}
                                  </p>
                                )}
                              </div>
                            )}
                            <details className="mt-1 text-xs text-muted-foreground">
                              <summary className="cursor-pointer select-none">
                                Details
                              </summary>
                              <div className="mt-1 space-y-1">
                                <p className="font-mono break-all">
                                  {server.transport === "http"
                                    ? (server.url ?? "—")
                                    : [server.command, ...(server.args ?? [])]
                                        .filter(Boolean)
                                        .join(" ") || "—"}
                                </p>
                                {envCount > 0 && (
                                  <p>
                                    {envCount} env var
                                    {envCount === 1 ? "" : "s"}
                                  </p>
                                )}
                              </div>
                            </details>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {server.auth === "oauth" && (
                              <Button
                                ghost
                                size="sm"
                                title="Authenticate with OAuth"
                                onClick={() => handleAuthenticate(server)}
                                disabled={authenticating === server.name}
                                prefix={
                                  authenticating === server.name ? (
                                    <Spinner />
                                  ) : (
                                    <KeyRound />
                                  )
                                }
                              >
                                Authenticate
                              </Button>
                            )}
                            <Button
                              ghost
                              size="sm"
                              title={server.enabled ? "Disable" : "Enable"}
                              aria-label={
                                server.enabled ? "Disable" : "Enable"
                              }
                              onClick={() => handleToggleEnabled(server)}
                              disabled={togglingName === server.name}
                              prefix={
                                togglingName === server.name ? (
                                  <Spinner />
                                ) : (
                                  <Power />
                                )
                              }
                              className={
                                server.enabled ? "text-success" : undefined
                              }
                            >
                              {server.enabled ? "Disable" : "Enable"}
                            </Button>
                            <div className="flex gap-1">
                              <Button
                                ghost
                                size="icon"
                                title="Test connection"
                                aria-label="Test connection"
                                onClick={() => handleTest(server)}
                                disabled={testing === server.name}
                              >
                                {testing === server.name ? (
                                  <Spinner />
                                ) : (
                                  <Zap />
                                )}
                              </Button>
                              <Button
                                ghost
                                destructive
                                size="icon"
                                title="Delete"
                                aria-label="Delete"
                                onClick={() =>
                                  serverDelete.requestDelete(server.name)
                                }
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  if (app.source === "composio") {
                    const busy = connectingSlug === app.id;
                    return (
                      <Card key={`${group.id}-${app.id}`}>
                        <CardContent className="flex items-start gap-3 py-4">
                          <McpBrandMark logo={directoryAppLogoUrl(app)} name={app.id} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {app.name}
                              </span>
                              {app.connected && (
                                <Badge tone="outline">connected</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {directoryAppDescription(app)}
                            </p>
                          </div>
                          <Button
                            className="uppercase shrink-0"
                            size="sm"
                            onClick={() =>
                              app.connected
                                ? void handleDisconnectComposio(app)
                                : void handleConnectComposio(app)
                            }
                            disabled={busy}
                            prefix={busy ? <Spinner /> : undefined}
                          >
                            {busy
                              ? app.connected
                                ? "Disconnecting..."
                                : "Connecting..."
                              : app.connected
                                ? "Disconnect"
                                : "Connect"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  }

                  const entry = directoryNativeEntry(
                    app,
                    catalogByName.get(app.id.toLowerCase()),
                  );
                  const entryDiags = diagnosticsByName[entry.name] ?? [];
                  const isInstalling = installingName === entry.name;
                  const action = mcpCatalogPrimaryAction(entry.auth_type);
                  return (
                    <Card key={`${group.id}-${app.id}`}>
                      <CardContent className="flex items-start gap-3 py-4">
                        <McpBrandMark logo={directoryAppLogoUrl(app)} name={app.id} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {app.name || prettyName(entry.name)}
                            </span>
                            {entry.needs_install && (
                              <Badge tone="warning">Needs build</Badge>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {entry.description}
                            </p>
                          )}
                          {(entry.url ||
                            entry.command ||
                            entry.install_url ||
                            entry.bootstrap.length > 0 ||
                            entry.post_install ||
                            entryDiags.length > 0) && (
                            <details className="mt-1 text-xs text-muted-foreground">
                              <summary className="cursor-pointer select-none">
                                Details
                              </summary>
                              <div className="mt-1 space-y-1">
                                {entry.transport === "http" && entry.url && (
                                  <p>
                                    <span className="font-medium">
                                      Endpoint:
                                    </span>{" "}
                                    <code className="font-mono">
                                      {entry.url}
                                    </code>
                                  </p>
                                )}
                                {entry.transport === "stdio" &&
                                  entry.command && (
                                    <p className="break-all">
                                      <span className="font-medium">
                                        Runs:
                                      </span>{" "}
                                      <code className="font-mono">
                                        {[entry.command, ...entry.args].join(
                                          " ",
                                        )}
                                      </code>
                                    </p>
                                  )}
                                {entry.install_url && (
                                  <p className="break-all">
                                    <span className="font-medium">
                                      Installs from:
                                    </span>{" "}
                                    {isHttpUrl(entry.install_url) ? (
                                      <a
                                        href={entry.install_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline underline-offset-2 hover:opacity-80"
                                      >
                                        {entry.install_url}
                                      </a>
                                    ) : (
                                      <code className="font-mono">
                                        {entry.install_url}
                                      </code>
                                    )}
                                    {entry.install_ref && (
                                      <span> @ {entry.install_ref}</span>
                                    )}
                                  </p>
                                )}
                                {entry.bootstrap.length > 0 && (
                                  <ul className="ml-3 list-disc space-y-0.5">
                                    {entry.bootstrap.map((cmd, i) => (
                                      <li
                                        key={`${entry.name}-bs-${i}`}
                                        className="break-all"
                                      >
                                        <code className="font-mono">
                                          {cmd}
                                        </code>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {entry.post_install && (
                                  <p className="whitespace-pre-wrap">
                                    {entry.post_install.trim()}
                                  </p>
                                )}
                                {entryDiags.map((d, i) => (
                                  <p
                                    key={`${entry.name}-diag-${i}`}
                                    className="text-warning"
                                  >
                                    {d.message}
                                  </p>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                        <Button
                          className="uppercase shrink-0"
                          size="sm"
                          onClick={() => handleInstallClick(entry)}
                          disabled={isInstalling}
                          prefix={
                            isInstalling ? <Spinner /> : undefined
                          }
                        >
                          {isInstalling
                            ? "Installing..."
                            : action === "connect"
                              ? "Connect"
                              : "Install"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
