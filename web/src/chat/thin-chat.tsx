import { useCallback, useEffect, useState, type MutableRefObject } from "react";

import { EmptyHome } from "./empty-home";
import { SessionView } from "./session-view";
import {
  createMessageId,
  type ChatMessage,
  type ThinChatPhase,
} from "./types";

export interface ThinChatProps {
  /** When false, skip autofocus (persistent host hidden on other routes). */
  isActive?: boolean;
  /** Stored session id from `/chat?resume=<id>` — hydrated in step 3. */
  resumeSessionId?: string | null;
  /** Seed composer from `/chat?learn=…` (Skills page). */
  initialDraft?: string;
  onPhaseChange?: (phase: ThinChatPhase) => void;
  /** Fired when the local transcript is cleared (New chat). */
  onReset?: () => void;
  /** Parent can call `resetRef.current?.()` for the header New chat action. */
  resetRef?: MutableRefObject<(() => void) | null>;
}

/**
 * Thin chat shell: EmptyHome → SessionView after the first send.
 *
 * Step 2 is presentation + local state only. Submitting appends the user
 * turn and a short placeholder assistant reply; JSON-RPC (`session.create` /
 * `prompt.submit` / stream events) lands in step 3.
 */
export function ThinChat({
  isActive = true,
  resumeSessionId = null,
  initialDraft = "",
  onPhaseChange,
  onReset,
  resetRef,
}: ThinChatProps) {
  const [phase, setPhase] = useState<ThinChatPhase>(() =>
    resumeSessionId ? "session" : "home",
  );
  const [draft, setDraft] = useState(initialDraft);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    resumeSessionId ? [resumePlaceholderMessage()] : [],
  );

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  // External resume target changed (Sessions → /chat?resume=).
  useEffect(() => {
    if (!resumeSessionId) return;
    setPhase("session");
    setMessages([resumePlaceholderMessage()]);
    setDraft("");
  }, [resumeSessionId]);

  // Skills → /chat?learn=… seeds the composer without forcing a session.
  useEffect(() => {
    if (!initialDraft) return;
    setDraft(initialDraft);
  }, [initialDraft]);

  const enterSessionWith = useCallback((text: string) => {
    const user: ChatMessage = {
      id: createMessageId(),
      role: "user",
      text,
    };
    const assistant: ChatMessage = {
      id: createMessageId(),
      role: "assistant",
      text: "Chat UI skeleton is live. Gateway streaming lands in the next step.",
    };
    setMessages((prev) => [...prev, user, assistant]);
    setPhase("session");
    setDraft("");
  }, []);

  const handleSubmit = useCallback(
    (text: string) => {
      enterSessionWith(text);
    },
    [enterSessionWith],
  );

  const reset = useCallback(() => {
    setPhase("home");
    setMessages([]);
    setDraft("");
    onReset?.();
  }, [onReset]);

  useEffect(() => {
    if (!resetRef) return;
    resetRef.current = reset;
    return () => {
      resetRef.current = null;
    };
  }, [reset, resetRef]);

  if (phase === "home") {
    return (
      <EmptyHome
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        autoFocus={isActive}
      />
    );
  }

  return (
    <SessionView
      messages={messages}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
      autoFocus={isActive}
    />
  );
}

function resumePlaceholderMessage(): ChatMessage {
  return {
    id: createMessageId(),
    role: "system",
    text: "Session resume will load here once the gateway is wired.",
  };
}
