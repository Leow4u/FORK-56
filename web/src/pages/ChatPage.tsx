/**
 * ChatPage — thin conversation UI for the dashboard /chat tab.
 *
 * Conversation shell over ``GatewayClient`` → ``/api/ws`` (same JSON-RPC as
 * TUI/desktop). No PTY / xterm embed.
 */

import { Button } from "@work4you/ui/ui/components/button";
import { FolderTree, PanelLeft, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { ThinChat } from "@/chat";
import {
  readFilesPaneOpen,
  writeFilesPaneOpen,
} from "@/chat/right-files";
import { ChatSessionList } from "@/components/ChatSessionList";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";
import { cn } from "@/lib/utils";

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  const { t } = useI18n();
  const { setEnd, setTitle } = usePageHeader();
  const { profile: scopedProfile } = useProfileScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const resetRef = useRef<(() => void) | null>(null);
  const [learnSeed] = useState(() => searchParams.get("learn") ?? "");
  const [sessionListNonce, setSessionListNonce] = useState(0);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
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

  const clearChatParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("resume");
        next.delete("learn");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const startFresh = useCallback(() => {
    clearChatParams();
    resetRef.current?.();
    setSessionListNonce((n) => n + 1);
  }, [clearChatParams]);

  const handleReset = useCallback(() => {
    clearChatParams();
  }, [clearChatParams]);

  const handleStoredSessionId = useCallback(
    (storedId: string | null) => {
      if (storedId) {
        setSessionListNonce((n) => n + 1);
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (storedId) {
            if (next.get("resume") === storedId) return prev;
            next.set("resume", storedId);
          } else {
            next.delete("resume");
          }
          next.delete("learn");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleTitle = useCallback(
    (title: string | null) => {
      if (!isActive) return;
      setTitle(title?.trim() || t.app.nav.chat);
    },
    [isActive, setTitle, t.app.nav.chat],
  );

  useEffect(() => {
    if (!searchParams.get("learn")) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("learn");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

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
          onClick={() => setMobileSessionsOpen(true)}
          aria-label={t.sessions.title}
          className="text-muted-foreground hover:text-foreground lg:hidden"
        >
          <PanelLeft className="h-4 w-4" />
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
          aria-label={t.sessions.newChat}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t.sessions.newChat}</span>
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
    setEnd,
    setTitle,
    startFresh,
    t.app.nav.chat,
    t.sessions.newChat,
    t.sessions.title,
  ]);

  const profileKey = scopedProfile || "__own__";

  const sessionListProps = {
    activeSessionId: resumeParam,
    profile: scopedProfile || undefined,
    onNewChat: startFresh,
    refreshToken: sessionListNonce,
    onPicked: () => setMobileSessionsOpen(false),
    className: "h-full",
  } as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PluginSlot name="chat:top" />
      <div
        className={cn(
          "relative flex min-h-0 flex-1 overflow-hidden rounded-lg",
          "border border-border/40 bg-background",
        )}
      >
        <aside className="hidden h-full w-60 shrink-0 border-r border-border/40 bg-background/60 lg:flex">
          <ChatSessionList {...sessionListProps} />
        </aside>

        {mobileSessionsOpen && (
          <>
            <button
              type="button"
              aria-label={t.common.close}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileSessionsOpen(false)}
            />
            <aside
              className={cn(
                "fixed inset-y-0 left-0 z-50 flex w-[min(100%,18rem)] flex-col",
                "border-r border-border/40 bg-background shadow-xl lg:hidden",
              )}
            >
              <div className="flex justify-end px-2 pt-2">
                <Button
                  ghost
                  size="icon"
                  onClick={() => setMobileSessionsOpen(false)}
                  aria-label={t.common.close}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatSessionList {...sessionListProps} />
              </div>
            </aside>
          </>
        )}

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
