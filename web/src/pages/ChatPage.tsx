/**
 * ChatPage — thin conversation UI for the dashboard /chat tab.
 *
 * Replaces the previous xterm + `/api/pty` embed. Step 2 ships EmptyHome →
 * SessionView with local state only; step 3 wires `GatewayClient` → `/api/ws`.
 */

import { Button } from "@work4you/ui/ui/components/button";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { ThinChat } from "@/chat";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  const { t } = useI18n();
  const { setEnd, setTitle } = usePageHeader();
  const { profile: scopedProfile } = useProfileScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const resetRef = useRef<(() => void) | null>(null);
  // Capture ?learn= once so clearing the query doesn't wipe the composer seed.
  const learnSeedRef = useRef(searchParams.get("learn") ?? "");

  const resumeParam = searchParams.get("resume");

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
  }, [clearChatParams]);

  const handleReset = useCallback(() => {
    clearChatParams();
  }, [clearChatParams]);

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
      <Button
        ghost
        size="sm"
        onClick={startFresh}
        aria-label={t.sessions.newChat}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">{t.sessions.newChat}</span>
      </Button>,
    );
    return () => {
      setEnd(null);
      setTitle(null);
    };
  }, [isActive, setEnd, setTitle, startFresh, t.app.nav.chat, t.sessions.newChat]);

  const profileKey = scopedProfile || "__own__";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PluginSlot name="chat:top" />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/40 bg-background">
        <ThinChat
          key={profileKey}
          isActive={isActive}
          resumeSessionId={resumeParam}
          initialDraft={learnSeedRef.current}
          onReset={handleReset}
          resetRef={resetRef}
        />
      </div>
      <PluginSlot name="chat:bottom" />
    </div>
  );
}
