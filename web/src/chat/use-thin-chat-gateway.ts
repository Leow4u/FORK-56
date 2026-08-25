import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GatewayClient,
  type ConnectionState,
  type GatewayEvent,
} from "@/lib/gatewayClient";

import {
  applyGatewayEvent,
  historyToChatMessages,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
  type SessionCreateResult,
  type SessionResumeResult,
} from "./gateway-protocol";
import {
  createMessageId,
  type ChatMessage,
  type ThinChatPhase,
} from "./types";

export interface UseThinChatGatewayOptions {
  profile?: string;
  resumeSessionId?: string | null;
  /** When false, skip connect (persistent host on another route is fine). */
  enabled?: boolean;
  onStoredSessionId?: (storedId: string | null) => void;
  onTitle?: (title: string | null) => void;
  onPhaseChange?: (phase: ThinChatPhase) => void;
}

export interface UseThinChatGatewayResult {
  phase: ThinChatPhase;
  messages: ChatMessage[];
  connectionState: ConnectionState;
  busy: boolean;
  error: string | null;
  ready: boolean;
  submit: (text: string) => Promise<void>;
  interrupt: () => Promise<void>;
  reset: () => Promise<void>;
  clearError: () => void;
}

/**
 * Owns the thin-chat gateway lifecycle: connect → create/resume → submit → stream.
 */
export function useThinChatGateway(
  options: UseThinChatGatewayOptions = {},
): UseThinChatGatewayResult {
  const {
    profile,
    resumeSessionId = null,
    enabled = true,
    onStoredSessionId,
    onTitle,
    onPhaseChange,
  } = options;

  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gw = useMemo(() => new GatewayClient(), [version]);

  const [phase, setPhase] = useState<ThinChatPhase>(() =>
    resumeSessionId ? "session" : "home",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const liveSessionIdRef = useRef<string | null>(null);
  const storedSessionIdRef = useRef<string | null>(null);
  const ensurePromiseRef = useRef<Promise<string> | null>(null);
  /** When true, ignore external resume effect (user hit New chat). */
  const suppressResumeRef = useRef(false);

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const onStoredSessionIdRef = useRef(onStoredSessionId);
  onStoredSessionIdRef.current = onStoredSessionId;
  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  useEffect(() => {
    onPhaseChangeRef.current?.(phase);
  }, [phase]);

  const scopeKey = profile ?? "";
  const prevScope = useRef<string | null>(null);
  useEffect(() => {
    if (prevScope.current === null) {
      prevScope.current = scopeKey;
      return;
    }
    if (prevScope.current === scopeKey) return;
    prevScope.current = scopeKey;
    setVersion((v) => v + 1);
  }, [scopeKey]);

  const rememberStored = useCallback((stored: string | null | undefined) => {
    if (!stored) return;
    storedSessionIdRef.current = stored;
    onStoredSessionIdRef.current?.(stored);
  }, []);

  const applyResumeResult = useCallback(
    (result: SessionResumeResult) => {
      liveSessionIdRef.current = result.session_id;
      rememberStored(result.stored_session_id ?? result.resumed);
      setMessages(historyToChatMessages(result.messages));
      setPhase("session");
      setBusy(Boolean(result.running));
      setReady(true);
      const title =
        result.info && typeof result.info.title === "string"
          ? result.info.title
          : null;
      if (title) onTitleRef.current?.(title);
    },
    [rememberStored],
  );

  const createFreshSession = useCallback(async (): Promise<string> => {
    await gw.connect();
    const created = await gw.request<SessionCreateResult>(
      "session.create",
      thinChatSessionCreateParams(profileRef.current),
    );
    liveSessionIdRef.current = created.session_id;
    if (created.stored_session_id) {
      storedSessionIdRef.current = created.stored_session_id;
    }
    setReady(true);
    return created.session_id;
  }, [gw]);

  const ensureLiveSession = useCallback(async (): Promise<string> => {
    if (liveSessionIdRef.current) return liveSessionIdRef.current;
    if (ensurePromiseRef.current) return ensurePromiseRef.current;

    const run = (async () => {
      const target = storedSessionIdRef.current;
      // Only resume here if we already bound a stored id but lost the live id
      // (shouldn't be common). Prefer createFresh for EmptyHome first send.
      if (target && phase === "session" && messages.length > 0) {
        await gw.connect();
        const resumed = await gw.request<SessionResumeResult>(
          "session.resume",
          thinChatSessionResumeParams(target, profileRef.current),
        );
        liveSessionIdRef.current = resumed.session_id;
        rememberStored(resumed.stored_session_id ?? resumed.resumed);
        setReady(true);
        return resumed.session_id;
      }
      return createFreshSession();
    })();

    ensurePromiseRef.current = run;
    try {
      return await run;
    } finally {
      ensurePromiseRef.current = null;
    }
  }, [createFreshSession, gw, messages.length, phase, rememberStored]);

  // Boot: connect + create (EmptyHome) or resume (?resume=).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const offState = gw.onState(setConnectionState);

    const onEvent = (ev: GatewayEvent) => {
      const sid = liveSessionIdRef.current;
      if (sid && ev.session_id && ev.session_id !== sid) return;

      if (ev.type === "session.info" || ev.type === "session.title") {
        const title =
          ev.payload && typeof ev.payload === "object"
            ? (ev.payload as { title?: string }).title
            : undefined;
        if (typeof title === "string" && title.trim()) {
          onTitleRef.current?.(title.trim());
        }
        return;
      }

      if (
        ev.type === "message.start" ||
        ev.type === "message.delta" ||
        ev.type === "message.interim" ||
        ev.type === "message.complete" ||
        ev.type === "tool.start" ||
        ev.type === "tool.complete" ||
        ev.type === "error"
      ) {
        setMessages((prev) => applyGatewayEvent(prev, ev.type, ev.payload));
        if (ev.type === "message.start") {
          setBusy(true);
          setPhase("session");
        }
        if (ev.type === "message.complete" || ev.type === "error") {
          setBusy(false);
        }
      }
    };

    const offAny = gw.onAny(onEvent);

    (async () => {
      try {
        if (resumeSessionId) {
          suppressResumeRef.current = false;
          storedSessionIdRef.current = resumeSessionId;
          await gw.connect();
          if (cancelled) return;
          const resumed = await gw.request<SessionResumeResult>(
            "session.resume",
            thinChatSessionResumeParams(resumeSessionId, profileRef.current),
          );
          if (cancelled) return;
          applyResumeResult(resumed);
        } else {
          await createFreshSession();
          if (cancelled) return;
          setPhase("home");
          setMessages([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to connect");
          if (resumeSessionId) {
            setPhase("session");
            setMessages([
              {
                id: createMessageId(),
                role: "system",
                text: "Could not resume this session.",
              },
            ]);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      offState();
      offAny();
      liveSessionIdRef.current = null;
      ensurePromiseRef.current = null;
      gw.close();
    };
    // Initial boot only for this gateway instance. Resume URL changes use the
    // effect below; New chat uses reset().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gw, enabled]);

  // `/chat?resume=` changed while the host stays mounted (not the initial boot).
  const prevResumeRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    if (prevResumeRef.current === undefined) {
      prevResumeRef.current = resumeSessionId;
      return;
    }
    if (prevResumeRef.current === resumeSessionId) return;
    prevResumeRef.current = resumeSessionId;

    if (suppressResumeRef.current) {
      suppressResumeRef.current = false;
      return;
    }
    if (!resumeSessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const prev = liveSessionIdRef.current;
        liveSessionIdRef.current = null;
        if (prev) {
          await gw
            .request("session.close", { session_id: prev })
            .catch(() => undefined);
        }
        await gw.connect();
        const resumed = await gw.request<SessionResumeResult>(
          "session.resume",
          thinChatSessionResumeParams(resumeSessionId, profileRef.current),
        );
        if (cancelled) return;
        applyResumeResult(resumed);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Resume failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyResumeResult, enabled, gw, resumeSessionId]);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      setPhase("session");
      setMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: "user", text: trimmed },
      ]);
      setBusy(true);
      try {
        const sessionId = await ensureLiveSession();
        rememberStored(storedSessionIdRef.current);
        await gw.request("prompt.submit", {
          session_id: sessionId,
          text: trimmed,
        });
        // Stream events drive the assistant bubble + clear busy on complete.
      } catch (e) {
        setBusy(false);
        const message = e instanceof Error ? e.message : "Send failed";
        setError(message);
        setMessages((prev) => [
          ...prev,
          { id: createMessageId(), role: "system", text: message },
        ]);
      }
    },
    [busy, ensureLiveSession, gw, rememberStored],
  );

  const interrupt = useCallback(async () => {
    const sid = liveSessionIdRef.current;
    if (!sid) return;
    try {
      await gw.request("session.interrupt", { session_id: sid });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interrupt failed");
    }
  }, [gw]);

  const reset = useCallback(async () => {
    suppressResumeRef.current = true;
    const sid = liveSessionIdRef.current;
    liveSessionIdRef.current = null;
    storedSessionIdRef.current = null;
    ensurePromiseRef.current = null;
    setBusy(false);
    setError(null);
    setMessages([]);
    setPhase("home");
    setReady(false);
    onStoredSessionIdRef.current?.(null);
    onTitleRef.current?.(null);
    if (sid) {
      await gw.request("session.close", { session_id: sid }).catch(() => undefined);
    }
    try {
      await createFreshSession();
      setPhase("home");
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start new chat");
    }
  }, [createFreshSession, gw]);

  return {
    phase,
    messages,
    connectionState,
    busy,
    error,
    ready,
    submit,
    interrupt,
    reset,
    clearError: () => setError(null),
  };
}
