/**
 * ChatPage — thin conversation UI for the dashboard /chat tab.
 *
 * Conversation shell over ``GatewayClient`` → ``/api/ws`` (same JSON-RPC as
 * TUI/desktop). No PTY / xterm embed.
 *
 * The session list lives in the app sidebar (see ``SidebarSessions`` in
 * App.tsx), not inside this page — matching the desktop app, where the
 * system sidebar owns conversations. This page wires the shell hooks:
 * ``newChatRef`` lets the sidebar's "New session" reset the live session, and
 * ``onSessionsChanged`` tells the sidebar list to refetch when a new stored
 * session id appears.
 */

import { Button } from "@work4you/ui/ui/components/button";
import { useStore } from "@nanostores/react";
import { Bot, FolderTree, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useNavigate, useSearchParams } from "react-router";

import { ThinChat } from "@/chat";
import {
  readFilesPaneOpen,
  writeFilesPaneOpen,
} from "@/chat/right-files";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";
import { cn } from "@/lib/utils";
import {
  $subagentsBySession,
  activeSubagentCount,
  allSubagents,
} from "@/store/subagents";

export default function ChatPage({
  isActive = true,
  newChatRef,
  onSessionsChanged,
}: {
  isActive?: boolean;
  /** The app shell's sidebar "New session" calls through this ref. */
  newChatRef?: MutableRefObject<(() => void) | null>;
  /** Fired when the stored-session set changes (sidebar list refetch). */
  onSessionsChanged?: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setEnd, setTitle } = usePageHeader();
  const { profile: scopedProfile } = useProfileScope();
  const subagentsBySession = useStore($subagentsBySession);
  const activeAgents = activeSubagentCount(allSubagents(subagentsBySession));
  const agentsLabel = t.app.nav.agents ?? "Agents";
  const [searchParams, setSearchParams] = useSearchParams();
  const resetRef = useRef<(() => void) | null>(null);
  const [learnSeed] = useState(() => searchParams.get("learn") ?? "");
  const [filesPaneOpen, setFilesPaneOpen] = useState(() =>
    readFilesPaneOpen(scopedProfile),
  );

  const resumeParam = searchParams.get("resume");

  const handleFilesPaneOpenChange = useCallback(
    (open: boolean) => {
      writeFilesPaneOpen(open, scopedProfile);
      setFilesPaneOpen(open);
    },
    [scopedProfile],
  );

  useEffect(() => {
    setFilesPaneOpen(readFilesPaneOpen(scopedProfile));
  }, [scopedProfile]);

  // The persistent host stays mounted on Capabilities / Artifacts /
  // Scheduled jobs. Any setSearchParams from this page while /chat is not
  // the URL overwrites a pending sidebar navigate("/chat") and the New
  // session click appears to do nothing.
  const replaceChatSearchParams = useCallback(
    (updater: (prev: URLSearchParams) => URLSearchParams) => {
      if (!isActive) return;
      setSearchParams(updater, { replace: true });
    },
    [isActive, setSearchParams],
  );

  const clearChatParams = useCallback(() => {
    replaceChatSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("resume");
      next.delete("learn");
      return next;
    });
  }, [replaceChatSearchParams]);

  const startFresh = useCallback(() => {
    clearChatParams();
    resetRef.current?.();
    onSessionsChanged?.();
  }, [clearChatParams, onSessionsChanged]);

  useEffect(() => {
    if (!newChatRef) return;
    newChatRef.current = startFresh;
    return () => {
      newChatRef.current = null;
    };
  }, [newChatRef, startFresh]);

  const handleReset = useCallback(() => {
    clearChatParams();
  }, [clearChatParams]);

  const handleStoredSessionId = useCallback(
    (storedId: string | null) => {
      if (storedId) {
        onSessionsChanged?.();
      }
      replaceChatSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (storedId) {
          if (next.get("resume") === storedId) return prev;
          next.set("resume", storedId);
        } else {
          next.delete("resume");
        }
        next.delete("learn");
        return next;
      });
    },
    [onSessionsChanged, replaceChatSearchParams],
  );

  const handleTitle = useCallback(
    (title: string | null) => {
      if (!isActive) return;
      setTitle(title?.trim() || t.app.nav.chat);
    },
    [isActive, setTitle, t.app.nav.chat],
  );

  useEffect(() => {
    if (!isActive || !searchParams.get("learn")) return;
    replaceChatSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("learn");
      return next;
    });
  }, [isActive, replaceChatSearchParams, searchParams]);

  useEffect(() => {
    if (!isActive) {
      setEnd(null);
      setTitle(null);
      return;
    }
    setTitle(t.app.nav.chat);
    setEnd(
      <div className="flex items-center gap-1">
        <Button
          ghost
          size="sm"
          onClick={() => navigate("/agents")}
          aria-label={
            activeAgents > 0
              ? `${agentsLabel} (${activeAgents})`
              : agentsLabel
          }
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">{agentsLabel}</span>
          {activeAgents > 0 ? (
            <span className="text-[0.7rem] tabular-nums text-muted-foreground/80">
              {activeAgents}
            </span>
          ) : null}
        </Button>
        <Button
          ghost
          size="sm"
          onClick={() => handleFilesPaneOpenChange(!filesPaneOpen)}
          aria-label={filesPaneOpen ? "Hide files" : "Show files"}
          aria-pressed={filesPaneOpen}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            filesPaneOpen && "text-foreground",
          )}
        >
          <FolderTree className="h-4 w-4" />
        </Button>
        <Button
          ghost
          size="sm"
          onClick={startFresh}
          aria-label={t.app.nav.newSession ?? t.sessions.newChat}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t.app.nav.newSession ?? t.sessions.newChat}
          </span>
        </Button>
      </div>,
    );
    return () => {
      setEnd(null);
      setTitle(null);
    };
  }, [
    filesPaneOpen,
    handleFilesPaneOpenChange,
    isActive,
    navigate,
    setEnd,
    setTitle,
    startFresh,
    activeAgents,
    agentsLabel,
    t.app.nav.chat,
    t.app.nav.newSession,
    t.sessions.newChat,
  ]);

  const profileKey = scopedProfile || "__own__";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PluginSlot name="chat:top" />
      <div
        className={cn(
          "relative flex min-h-0 flex-1 overflow-hidden rounded-lg",
          "border border-border/40 bg-background",
        )}
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <ThinChat
            key={profileKey}
            isActive={isActive}
            profile={scopedProfile || undefined}
            resumeSessionId={resumeParam}
            initialDraft={learnSeed}
            onReset={handleReset}
            onStoredSessionId={handleStoredSessionId}
            onTitle={handleTitle}
            resetRef={resetRef}
            filesPaneOpen={filesPaneOpen}
            onFilesPaneOpenChange={handleFilesPaneOpenChange}
          />
        </div>
      </div>
      <PluginSlot name="chat:bottom" />
    </div>
  );
}
