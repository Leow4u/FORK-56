/**
 * ChatSessionList — a ChatGPT-style conversation switcher rendered in the
 * app sidebar.
 *
 * It lists the most recent sessions for the active management profile and
 * lets the user swap between them from anywhere: picking a row navigates to
 * `/chat?resume=<id>` (the same affordance as the Sessions page "Resume in
 * Chat" action). The "New chat" action clears the resume param and resets
 * the chat host.
 *
 * Everyday management mirrors the desktop sidebar: rename, pin and archive
 * act through the shared `PATCH /api/sessions/{id}` surface, so state set
 * here is the same state the desktop app shows (`sessions.pinned` /
 * `sessions.archived`). Pinned sessions group at the top; archiving
 * soft-hides a row (messages are kept — the Sessions page and desktop
 * Settings can restore). Store-wide hygiene (bulk delete, prune,
 * import/export) stays on the Sessions page.
 *
 * Best-effort, like ChatSidebar: a failed fetch surfaces a small inline
 * error with a retry affordance and the chat surface keeps working.
 */

import { Button } from "@work4you/ui/ui/components/button";
import { Input } from "@work4you/ui/ui/components/input";
import { ListItem } from "@work4you/ui/ui/components/list-item";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Check,
  Download,
  MessageSquarePlus,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { TuiPtyModal } from "@/components/TuiPtyModal";
import { useI18n } from "@/i18n";
import { api, type SessionInfo, type SessionSearchResult } from "@/lib/api";
import { sessionRowDetails } from "@/lib/session-row-details";
import { cn, timeAgo } from "@/lib/utils";

const SESSION_LIMIT = 30;
interface ChatSessionListProps {
  /** Active resume target (the session currently shown in the chat). */
  activeSessionId: string | null;
  /** Management profile from the dashboard switcher — scopes the listing. */
  profile?: string;
  className?: string;
  /** Optional callback fired after a row is picked (e.g. close mobile sheet). */
  onPicked?: () => void;
  /**
   * Starts a fresh chat. The app shell supplies a handler that navigates to
   * /chat and resets the thin-chat session.
   */
  onNewChat?: () => void;
  /** Bumped by the parent when a new stored session id appears (refresh list). */
  refreshToken?: number;
}

function rowLabel(session: SessionInfo, untitled: string): string {
  const title = session.title?.trim();
  if (title && title !== "Untitled") return title;
  const preview = session.preview?.trim();
  if (preview) return preview;
  return untitled;
}

export function ChatSessionList({
  activeSessionId,
  profile,
  className,
  onPicked,
  onNewChat,
  refreshToken = 0,
}: ChatSessionListProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SessionSearchResult[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped to force a refetch (after switching, on Refresh, on mount).
  const [reloadNonce, setReloadNonce] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `profile` is read inside the fetch; it's part of the scope key so a
  // profile switch refetches. The empty-string fallback keeps the dep
  // stable when no profile is selected (default profile).
  const scopeKey = profile ?? "";

  // Monotonic request token: only the most recent fetch is allowed to
  // commit state, so a fast profile switch (or Refresh spam) can't land a
  // stale list out of order.
  const reqRef = useRef(0);

  const load = useCallback(() => {
    const myReq = ++reqRef.current;
    setLoading(true);
    setError(null);
    api
      .getSessions(SESSION_LIMIT, 0, scopeKey, "recent")
      .then((res) => {
        if (reqRef.current !== myReq) return;
        setSessions(res.sessions);
      })
      .catch((e: Error) => {
        if (reqRef.current !== myReq) return;
        setError(e.message || "failed to load sessions");
      })
      .finally(() => {
        if (reqRef.current === myReq) setLoading(false);
      });
  }, [scopeKey]);

  useEffect(() => {
    // Dashboard data surfaces fetch from an effect on mount + scope change;
    // keep this local and explicit until the shared lint profile is updated
    // for async loaders (matches FilesPage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // `reloadNonce` is a manual refetch trigger; `refreshToken` is parent-driven.
  }, [load, reloadNonce, refreshToken]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      debounceRef.current = setTimeout(() => {
        setSearchResults(null);
        setSearching(false);
      }, 0);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      setSearchResults(null);
      api
        .searchSessions(search.trim(), scopeKey)
        .then((resp) => setSearchResults(resp.results))
        .catch(() => setSearchResults(null))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, scopeKey]);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Picking a row navigates to `/chat?resume=<id>` — same as the Sessions
  // page "Resume in Chat" action, so the list works from any route.
  const pick = useCallback(
    (id: string) => {
      onPicked?.();
      if (id === activeSessionId) return;
      navigate(`/chat?resume=${encodeURIComponent(id)}`);
    },
    [activeSessionId, navigate, onPicked],
  );

  // "New chat" prefers the shell handler (navigates to /chat + resets).
  const startNew = useCallback(() => {
    onPicked?.();
    if (onNewChat) {
      onNewChat();
      return;
    }
    navigate("/chat");
  }, [navigate, onNewChat, onPicked]);

  const handleActionError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "session update failed");
  }, []);

  const content = useMemo(() => {
    const visible = searchResults ?? sessions;
    if (loading && sessions === null && !search.trim()) {
      return (
        <div className="flex items-center justify-center gap-2 px-2 py-6 text-xs text-text-secondary">
          <Spinner /> {t.common.loading}
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-start gap-2 px-2 py-4 text-xs">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="wrap-break-word">{error}</span>
          </div>
          <Button size="sm" outlined onClick={reload} prefix={<RefreshCw />}>
            {t.common.retry}
          </Button>
        </div>
      );
    }
    if (!visible || visible.length === 0) {
      return (
        <div className="px-2 py-6 text-center text-xs text-text-secondary">
          {search.trim() ? t.sessions.noMatch : t.sessions.noSessions}
        </div>
      );
    }
    const pinnedRows = visible.filter((s) => s.pinned);
    const restRows = visible.filter((s) => !s.pinned);
    const renderRow = (s: SessionInfo) => (
      <SessionRow
        key={s.id}
        session={s}
        isActive={s.id === activeSessionId}
        profile={scopeKey}
        untitled={t.sessions.untitledSession}
        labels={{
          pin: t.sessions.pinSession ?? "Pin",
          unpin: t.sessions.unpinSession ?? "Unpin",
          archive: t.sessions.archiveSession ?? "Archive",
          restore: "Restore",
          rename: t.sessions.renameSession ?? "Rename",
          delete: t.sessions.deleteSession ?? "Delete",
          export: "Export",
          openTui: t.sessions.openInTui ?? "Open in TUI",
        }}
        onPick={() => pick(s.id)}
        onChanged={reload}
        onError={handleActionError}
        onDeleted={(id) => {
          if (id === activeSessionId) onNewChat?.();
          reload();
        }}
      />
    );
    return (
      <div className="flex flex-col gap-0.5">
        {pinnedRows.length > 0 && (
          <>
            <span className="px-2 pt-1 pb-0.5 text-display text-[0.625rem] tracking-wider text-text-tertiary">
              {t.sessions.pinnedSection ?? "Pinned"}
            </span>
            {pinnedRows.map(renderRow)}
            {restRows.length > 0 && (
              <span
                aria-hidden
                className="mx-2 my-1 border-t border-border/40"
              />
            )}
          </>
        )}
        {restRows.map(renderRow)}
      </div>
    );
  }, [
    activeSessionId,
    error,
    handleActionError,
    loading,
    onNewChat,
    pick,
    reload,
    scopeKey,
    search,
    searchResults,
    sessions,
    t,
  ]);

  return (
    <aside
      className={cn(
        "flex h-full w-full min-w-0 shrink-0 flex-col overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <span className="text-display text-xs tracking-wider text-text-tertiary">
          {t.sessions.title}
        </span>
        <Button
          ghost
          size="icon"
          onClick={reload}
          aria-label={t.common.refresh}
          title={t.common.refresh}
          className="text-text-secondary hover:text-foreground"
        >
          <RefreshCw className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      <div className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.sessions.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-text-tertiary"
        />
        {searching && <Spinner className="h-3.5 w-3.5" />}
      </div>

      <Button
        outlined
        size="sm"
        onClick={startNew}
        prefix={<MessageSquarePlus />}
        className="mx-2 mb-2 justify-center"
      >
        {t.sessions.newChat}
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-1">
        {content}
      </div>
    </aside>
  );
}

interface SessionRowProps {
  session: SessionInfo;
  isActive: boolean;
  profile: string;
  untitled: string;
  labels: {
    pin: string;
    unpin: string;
    archive: string;
    restore: string;
    rename: string;
    delete: string;
    export: string;
    openTui: string;
  };
  onPick: () => void;
  /** Fired after a successful rename / pin / archive so the list refetches. */
  onChanged: () => void;
  onError: (e: unknown) => void;
  /** Fired after delete — parent may reset the live chat if the row was active. */
  onDeleted: (id: string) => void;
}

/**
 * One session row: the main ListItem resumes the conversation; a hover
 * action cluster (rename / pin / archive) overlays the right edge. The
 * actions are siblings of the ListItem — it renders a <button>, so nesting
 * buttons inside it would be invalid HTML.
 */
function SessionRow({
  session,
  isActive,
  profile,
  untitled,
  labels,
  onPick,
  onChanged,
  onError,
  onDeleted,
}: SessionRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tuiOpen, setTuiOpen] = useState(false);
  const pinned = Boolean(session.pinned);
  const archived = Boolean(session.archived);
  const title = rowLabel(session, untitled);
  const details = sessionRowDetails(session, {
    messageCount: (count) => `${count} msgs`,
    toolCallCount: (count) => `${count} tools`,
  });

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async () => {
    const value = renameValue.trim();
    if (!value || value === session.title) {
      setRenaming(false);
      return;
    }
    await runAction(() => api.renameSession(session.id, value, profile));
    setRenaming(false);
  };

  const handleExport = () => {
    const url = api.exportSessionUrl(session.id, profile);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.deleteSession(session.id, profile);
      setDeleteOpen(false);
      onDeleted(session.id);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitRename();
            else if (e.key === "Escape") setRenaming(false);
          }}
          placeholder={untitled}
          className="h-7 min-w-0 flex-1 py-0 text-xs"
          disabled={busy}
        />
        <Button
          ghost
          size="icon"
          aria-label={labels.rename}
          disabled={busy}
          onClick={() => void submitRename()}
          className="text-text-secondary hover:text-success"
        >
          {busy ? <Spinner className="text-sm" /> : <Check />}
        </Button>
        <Button
          ghost
          size="icon"
          aria-label={`${labels.rename} — cancel`}
          disabled={busy}
          onClick={() => setRenaming(false)}
          className="text-text-secondary hover:text-foreground"
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="group/row relative">
        <ListItem
          onClick={onPick}
          aria-current={isActive ? "true" : undefined}
          className={cn(
            "flex-col items-start gap-0.5 rounded px-2 py-1.5",
            "normal-case tracking-normal",
            isActive
              ? "bg-primary/10 text-foreground border-l-2 border-primary"
              : "text-text-secondary hover:bg-midground/5 hover:text-foreground",
            archived && "opacity-70",
          )}
        >
          <span className="w-full truncate pr-24 text-sm font-medium">{title}</span>
          {details.preview && (
            <span className="w-full truncate pr-24 text-[0.6875rem] text-text-tertiary">
              {details.preview}
            </span>
          )}
          <span className="flex w-full items-center gap-1.5 text-[0.6875rem] text-text-tertiary">
            {pinned && <Pin aria-hidden className="h-3 w-3 shrink-0" />}
            {archived && <Archive aria-hidden className="h-3 w-3 shrink-0" />}
            <span>{timeAgo(session.last_active)}</span>
            {details.metadata && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{details.metadata}</span>
              </>
            )}
            {session.source && session.source !== "cli" && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{session.source}</span>
              </>
            )}
          </span>
        </ListItem>

        <span
          className={cn(
            "absolute right-1 top-1 flex items-center gap-0.5 rounded bg-background/90",
            "opacity-0 transition-opacity group-hover/row:opacity-100",
            "focus-within:opacity-100",
          )}
        >
          <Button
            ghost
            size="icon"
            aria-label={labels.rename}
            title={labels.rename}
            disabled={busy}
            onClick={() => {
              setRenameValue(
                session.title && session.title !== "Untitled"
                  ? session.title
                  : "",
              );
              setRenaming(true);
            }}
            className="h-6 w-6 text-text-tertiary hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            ghost
            size="icon"
            aria-label={pinned ? labels.unpin : labels.pin}
            title={pinned ? labels.unpin : labels.pin}
            disabled={busy}
            onClick={() =>
              void runAction(() =>
                api.setSessionPinned(session.id, !pinned, profile),
              )
            }
            className="h-6 w-6 text-text-tertiary hover:text-foreground"
          >
            {pinned ? (
              <PinOff className="h-3 w-3" />
            ) : (
              <Pin className="h-3 w-3" />
            )}
          </Button>
          {archived ? (
            <Button
              ghost
              size="icon"
              aria-label={labels.restore}
              title={labels.restore}
              disabled={busy}
              onClick={() =>
                void runAction(() =>
                  api.setSessionArchived(session.id, false, profile),
                )
              }
              className="h-6 w-6 text-text-tertiary hover:text-foreground"
            >
              {busy ? (
                <Spinner className="text-xs" />
              ) : (
                <ArchiveRestore className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <Button
              ghost
              size="icon"
              aria-label={labels.archive}
              title={labels.archive}
              disabled={busy}
              onClick={() =>
                void runAction(() =>
                  api.setSessionArchived(session.id, true, profile),
                )
              }
              className="h-6 w-6 text-text-tertiary hover:text-foreground"
            >
              {busy ? (
                <Spinner className="text-xs" />
              ) : (
                <Archive className="h-3 w-3" />
              )}
            </Button>
          )}
          <Button
            ghost
            size="icon"
            aria-label={labels.openTui}
            title={labels.openTui}
            disabled={busy}
            onClick={() => setTuiOpen(true)}
            className="h-6 w-6 text-text-tertiary hover:text-foreground"
          >
            <Terminal className="h-3 w-3" />
          </Button>
          <Button
            ghost
            size="icon"
            aria-label={labels.export}
            title={labels.export}
            disabled={busy}
            onClick={handleExport}
            className="h-6 w-6 text-text-tertiary hover:text-foreground"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            ghost
            size="icon"
            aria-label={labels.delete}
            title={labels.delete}
            disabled={busy}
            onClick={() => setDeleteOpen(true)}
            className="h-6 w-6 text-text-tertiary hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </span>
      </div>

      <TuiPtyModal
        open={tuiOpen}
        onClose={() => setTuiOpen(false)}
        resumeSessionId={session.id}
        profile={profile || undefined}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title={labels.delete}
        description="Delete this conversation permanently? This cannot be undone."
        confirmLabel={labels.delete}
        loading={busy}
      />
    </>
  );
}
