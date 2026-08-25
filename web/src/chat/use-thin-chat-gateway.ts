import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import {
  EVENTS_CONNECT_TIMEOUT_MS,
  EVENTS_MAX_RECONNECT_ATTEMPTS,
  eventsGaveUpMessage,
  eventsReconnectDelayMs,
  eventsReconnectingMessage,
  shouldRetryEventsClose,
} from "@/lib/events-reconnect";
import {
  GatewayClient,
  type ConnectionState,
  type GatewayEvent,
} from "@/lib/gatewayClient";
import { executeSlash } from "@/lib/slashExec";

import {
  applyGatewayEvent,
  activityLineFromGatewayEvent,
  historyToChatMessages,
  sessionMessagesToChatMessages,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
  type SessionCreateResult,
  type SessionResumeResult,
} from "./gateway-protocol";
import type { ThinChatActivity } from "./chat-activity-strip";
import {
  mergeSessionInfo,
  sessionInfoFromPayload,
  sessionUsageFromPayload,
  type ThinChatSessionInfo,
  type ThinChatSessionUsage,
} from "./session-info";
import {
  createMessageId,
  type ChatMessage,
  type ThinChatPhase,
} from "./types";

const STREAM_EVENT_TYPES = new Set([
  "message.start",
  "message.delta",
  "message.interim",
  "message.complete",
  "reasoning.delta",
  "thinking.delta",
  "reasoning.available",
  "tool.start",
  "tool.progress",
  "tool.complete",
  "tool.generating",
  "tool.output_risk",
  "status.update",
  "review.summary",
  "notification.show",
  "notification.clear",
  "moa.reference",
  "moa.aggregating",
  "moa.progress",
  "moa.phase",
  "subagent.spawn_requested",
  "subagent.start",
  "subagent.thinking",
  "subagent.tool",
  "subagent.progress",
  "subagent.complete",
  "error",
]);

const ACTIVITY_EVENT_TYPES = new Set([
  "tool.generating",
  "tool.start",
  "tool.progress",
  "tool.complete",
  "status.update",
  "notification.show",
  "subagent.spawn_requested",
  "subagent.start",
  "subagent.thinking",
  "subagent.tool",
  "subagent.progress",
  "subagent.complete",
]);

const EMPTY_ACTIVITY: ThinChatActivity = {
  toolLine: null,
  backgroundLine: null,
  queueCount: 0,
};

function activityPatchFromEvent(
  eventType: string,
  payload: unknown,
): Partial<ThinChatActivity> | null {
  if (!ACTIVITY_EVENT_TYPES.has(eventType)) return null;
  const line = activityLineFromGatewayEvent(eventType, payload);
  if (eventType === "notification.show") {
    return line ? { backgroundLine: line } : null;
  }
  if (eventType === "status.update") {
    const kind =
      payload && typeof payload === "object"
        ? (payload as { kind?: unknown }).kind
        : undefined;
    if (kind === "compacted") return { backgroundLine: null };
    if (kind === "process") {
      return line ? { backgroundLine: line } : null;
    }
    return line ? { toolLine: line } : null;
  }
  if (eventType.startsWith("subagent.") || eventType.startsWith("tool.")) {
    return line ? { toolLine: line } : null;
  }
  return line ? { toolLine: line } : null;
}

export interface ResumeProgress {
  phase?: string;
  status?: string;
  message?: string;
  messageCount?: number;
}

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
  reconnecting: boolean;
  credentialWarning: string | null;
  ready: boolean;
  gateway: GatewayClient;
  liveSessionId: string | null;
  storedSessionId: string | null;
  sessionInfo: ThinChatSessionInfo;
  sessionUsage: ThinChatSessionUsage | null;
  activity: ThinChatActivity;
  resumeProgress: ResumeProgress | null;
  canLoadEarlier: boolean;
  showLoadEarlier: boolean;
  loadingEarlier: boolean;
  submit: (text: string) => Promise<void>;
  enqueueDraft: (text: string) => void;
  interrupt: () => Promise<void>;
  reset: () => Promise<void>;
  loadEarlier: () => Promise<void>;
  setReasoningEffort: (effort: string) => Promise<void>;
  refreshSessionUsage: () => Promise<void>;
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
  const [reconnecting, setReconnecting] = useState(false);
  const [credentialWarning, setCredentialWarning] = useState<string | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [storedSessionId, setStoredSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<ThinChatSessionInfo>({});
  const [sessionUsage, setSessionUsage] = useState<ThinChatSessionUsage | null>(
    null,
  );
  const [resumeProgress, setResumeProgress] = useState<ResumeProgress | null>(
    null,
  );
  const [backfillLoaded, setBackfillLoaded] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [activity, setActivity] = useState<ThinChatActivity>(EMPTY_ACTIVITY);
  const [queueCount, setQueueCount] = useState(0);

  const activityWithQueue = useMemo(
    () =>
      activity.queueCount === queueCount
        ? activity
        : { ...activity, queueCount },
    [activity, queueCount],
  );

  const liveSessionIdRef = useRef<string | null>(null);
  const storedSessionIdRef = useRef<string | null>(null);
  const ensurePromiseRef = useRef<Promise<string> | null>(null);
  const suppressResumeRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  const profileRef = useRef(profile);
  const onStoredSessionIdRef = useRef(onStoredSessionId);
  const onTitleRef = useRef(onTitle);
  const onPhaseChangeRef = useRef(onPhaseChange);

  useEffect(() => {
    profileRef.current = profile;
    onStoredSessionIdRef.current = onStoredSessionId;
    onTitleRef.current = onTitle;
    onPhaseChangeRef.current = onPhaseChange;
  }, [profile, onStoredSessionId, onTitle, onPhaseChange]);

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
    setStoredSessionId(stored);
    onStoredSessionIdRef.current?.(stored);
  }, []);

  const bindLiveSession = useCallback((sessionId: string | null) => {
    liveSessionIdRef.current = sessionId;
    setLiveSessionId(sessionId);
  }, []);

  const appendSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: "system", text },
    ]);
  }, []);

  const refreshSessionUsage = useCallback(async () => {
    const sid = liveSessionIdRef.current;
    if (!sid) return;
    try {
      const usage = await gw.request<unknown>("session.usage", {
        session_id: sid,
      });
      const parsed = sessionUsageFromPayload(usage);
      if (parsed) setSessionUsage(parsed);
    } catch {
      // Usage is best-effort chrome — ignore transient RPC failures.
    }
  }, [gw]);

  const setReasoningEffort = useCallback(
    async (effort: string) => {
      const sid = liveSessionIdRef.current;
      if (!sid) return;
      setSessionInfo((prev) => mergeSessionInfo(prev, { reasoningEffort: effort }));
      try {
        await gw.request("config.set", {
          key: "reasoning",
          session_id: sid,
          value: effort,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not set reasoning");
      }
    },
    [gw],
  );

  const applySessionInfoPayload = useCallback((payload: unknown) => {
    const patch = sessionInfoFromPayload(payload);
    if (Object.keys(patch).length > 0) {
      setSessionInfo((prev) => mergeSessionInfo(prev, patch));
    }
    if (typeof patch.running === "boolean") {
      setBusy(patch.running);
    }
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      const title = typeof p.title === "string" ? p.title : undefined;
      if (typeof title === "string" && title.trim()) {
        onTitleRef.current?.(title.trim());
      }
      const warn =
        typeof p.credential_warning === "string"
          ? p.credential_warning
          : null;
      if (warn?.trim()) {
        setCredentialWarning(warn.trim());
      }
    }
  }, []);

  const applyResumeResult = useCallback(
    (result: SessionResumeResult) => {
      bindLiveSession(result.session_id);
      rememberStored(result.stored_session_id ?? result.resumed);
      setMessages(historyToChatMessages(result.messages));
      setPhase("session");
      setBusy(Boolean(result.running));
      setReady(true);
      setBackfillLoaded(false);
      setResumeProgress(null);
      if (result.info) {
        applySessionInfoPayload(result.info);
      }
      const title =
        result.info && typeof result.info.title === "string"
          ? result.info.title
          : null;
      if (title) onTitleRef.current?.(title);
      void refreshSessionUsage();
    },
    [applySessionInfoPayload, bindLiveSession, rememberStored, refreshSessionUsage],
  );

  const createFreshSession = useCallback(async (): Promise<string> => {
    await gw.connect();
    const created = await gw.request<SessionCreateResult>(
      "session.create",
      thinChatSessionCreateParams(profileRef.current),
    );
    bindLiveSession(created.session_id);
    if (created.stored_session_id) {
      storedSessionIdRef.current = created.stored_session_id;
      setStoredSessionId(created.stored_session_id);
    }
    if (created.info) {
      applySessionInfoPayload(created.info);
    }
    setReady(true);
    void refreshSessionUsage();
    return created.session_id;
  }, [applySessionInfoPayload, bindLiveSession, gw, refreshSessionUsage]);

  const ensureLiveSession = useCallback(async (): Promise<string> => {
    if (liveSessionIdRef.current) return liveSessionIdRef.current;
    if (ensurePromiseRef.current) return ensurePromiseRef.current;

    const run = (async () => {
      const target = storedSessionIdRef.current;
      if (target && phase === "session" && messages.length > 0) {
        await gw.connect();
        const resumed = await gw.request<SessionResumeResult>(
          "session.resume",
          thinChatSessionResumeParams(target, profileRef.current),
        );
        bindLiveSession(resumed.session_id);
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
  }, [bindLiveSession, createFreshSession, gw, messages.length, phase, rememberStored]);

  const resumeAfterReconnect = useCallback(async () => {
    const stored = storedSessionIdRef.current;
    if (stored) {
      const resumed = await gw.request<SessionResumeResult>(
        "session.resume",
        thinChatSessionResumeParams(stored, profileRef.current),
      );
      bindLiveSession(resumed.session_id);
      rememberStored(resumed.stored_session_id ?? resumed.resumed);
      setBusy(Boolean(resumed.running));
      setReady(true);
      if (resumed.info) {
        applySessionInfoPayload(resumed.info);
      }
      void refreshSessionUsage();
      return;
    }
    if (!liveSessionIdRef.current) {
      await createFreshSession();
    }
  }, [
    applySessionInfoPayload,
    bindLiveSession,
    createFreshSession,
    gw,
    rememberStored,
    refreshSessionUsage,
  ]);

  const handleGatewayEvent = useCallback(
    (ev: GatewayEvent) => {
      const sid = liveSessionIdRef.current;
      if (sid && ev.session_id && ev.session_id !== sid) return;

      if (ev.type === "session.info" || ev.type === "session.title") {
        applySessionInfoPayload(ev.payload);
        return;
      }

      if (ev.type === "session.usage") {
        const usage = sessionUsageFromPayload(ev.payload);
        if (usage) setSessionUsage(usage);
        return;
      }

      const activityPatch = activityPatchFromEvent(ev.type, ev.payload);
      if (activityPatch) {
        setActivity((prev) => ({ ...prev, ...activityPatch }));
      }

      if (ev.type === "session.resume_progress") {
        const payload =
          ev.payload && typeof ev.payload === "object"
            ? (ev.payload as Record<string, unknown>)
            : null;
        if (!payload) return;
        setResumeProgress({
          phase:
            typeof payload.phase === "string" ? payload.phase : undefined,
          status:
            typeof payload.status === "string" ? payload.status : undefined,
          message:
            typeof payload.message === "string" ? payload.message : undefined,
          messageCount:
            typeof payload.message_count === "number"
              ? payload.message_count
              : undefined,
        });
        if (payload.status === "complete" || payload.status === "failed") {
          setTimeout(() => setResumeProgress(null), 2000);
        }
        return;
      }

      if (STREAM_EVENT_TYPES.has(ev.type)) {
        setMessages((prev) => applyGatewayEvent(prev, ev.type, ev.payload));
        if (ev.type === "message.start") {
          setBusy(true);
          setPhase("session");
        }
        if (ev.type === "message.complete" || ev.type === "error") {
          setBusy(false);
          void refreshSessionUsage();
        }
      }
    },
    [applySessionInfoPayload, refreshSessionUsage],
  );

  // Boot: connect + create (EmptyHome) or resume (?resume=).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    intentionalCloseRef.current = false;

    const offState = gw.onState(setConnectionState);
    const offAny = gw.onAny(handleGatewayEvent);

    (async () => {
      try {
        if (resumeSessionId) {
          suppressResumeRef.current = false;
          storedSessionIdRef.current = resumeSessionId;
          setStoredSessionId(resumeSessionId);
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
      intentionalCloseRef.current = true;
      offState();
      offAny();
      bindLiveSession(null);
      ensurePromiseRef.current = null;
      gw.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gw, enabled]);

  // WebSocket auto-reconnect (same backoff policy as ChatSidebar events feed).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let connectGeneration = 0;

    const clearTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
    };

    const scheduleReconnect = (closeCode?: number) => {
      if (cancelled || intentionalCloseRef.current) return;
      if (!shouldRetryEventsClose(closeCode)) return;
      if (reconnectTimer) return;
      if (attempt >= EVENTS_MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(false);
        setError(eventsGaveUpMessage());
        return;
      }
      const delay = eventsReconnectDelayMs(attempt);
      attempt += 1;
      setReconnecting(true);
      setError(eventsReconnectingMessage(delay));
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled || intentionalCloseRef.current) return;
      const generation = ++connectGeneration;
      clearTimers();
      connectTimer = setTimeout(() => {
        connectTimer = null;
        if (cancelled || generation !== connectGeneration) return;
        connectGeneration += 1;
        scheduleReconnect();
      }, EVENTS_CONNECT_TIMEOUT_MS);

      try {
        await gw.connect();
        if (cancelled || generation !== connectGeneration) return;
        clearTimers();
        attempt = 0;
        setReconnecting(false);
        setError((current) =>
          current?.startsWith("events feed ") || current?.includes("reconnecting")
            ? null
            : current,
        );
        await resumeAfterReconnect();
      } catch {
        if (cancelled || generation !== connectGeneration) return;
        clearTimers();
        scheduleReconnect();
      }
    };

    const offState = gw.onState((state) => {
      if (state === "closed" || state === "error") {
        if (!intentionalCloseRef.current) {
          scheduleReconnect();
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimers();
      offState();
    };
  }, [enabled, gw, resumeAfterReconnect]);

  // `/chat?resume=` changed while the host stays mounted.
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
    // First prompt from EmptyHome calls rememberStored → parent sets ?resume= to
    // the session key we already have live. Re-resuming would close the in-flight
    // turn and replace the local transcript with empty durable history.
    if (
      resumeSessionId === storedSessionIdRef.current &&
      liveSessionIdRef.current
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const prev = liveSessionIdRef.current;
        bindLiveSession(null);
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
  }, [applyResumeResult, enabled, gw, resumeSessionId, bindLiveSession]);

  const submitPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      setBusy(true);
      try {
        const sessionId = await ensureLiveSession();
        rememberStored(storedSessionIdRef.current);
        await gw.request("prompt.submit", {
          session_id: sessionId,
          text: trimmed,
        });
      } catch (e) {
        setBusy(false);
        const message = e instanceof Error ? e.message : "Send failed";
        setError(message);
        appendSystemMessage(message);
      }
    },
    [appendSystemMessage, ensureLiveSession, gw, rememberStored],
  );

  const trySteer = useCallback(
    async (text: string): Promise<"queued" | "rejected" | "failed"> => {
      const sid = liveSessionIdRef.current;
      if (!sid) return "failed";
      try {
        const result = await gw.request<{ status?: string }>("session.steer", {
          session_id: sid,
          text,
        });
        return result?.status === "queued" ? "queued" : "rejected";
      } catch {
        return "failed";
      }
    },
    [gw],
  );

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const isSlash = trimmed.startsWith("/");
      if (!isSlash && credentialWarning && !busy) {
        return;
      }

      setError(null);
      setPhase("session");

      if (busy && !isSlash) {
        setMessages((prev) => [
          ...prev,
          { id: createMessageId(), role: "user", text: trimmed },
        ]);
        const steerResult = await trySteer(trimmed);
        if (steerResult === "queued") return;
        queueRef.current.push(trimmed);
        setQueueCount(queueRef.current.length);
        appendSystemMessage(
          steerResult === "rejected"
            ? "Steer rejected — message queued for next turn"
            : "Steer failed — message queued for next turn",
        );
        return;
      }

      if (busy && isSlash) return;

      setMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: "user", text: trimmed },
      ]);

      if (isSlash) {
        try {
          const sessionId = await ensureLiveSession();
          rememberStored(storedSessionIdRef.current);
          const result = await executeSlash({
            command: trimmed,
            sessionId,
            gw,
            callbacks: {
              sys: appendSystemMessage,
              send: async (message) => {
                setMessages((prev) => [
                  ...prev,
                  { id: createMessageId(), role: "user", text: message },
                ]);
                await submitPrompt(message);
              },
            },
          });
          if (result === "sent") return;
        } catch (e) {
          const message = e instanceof Error ? e.message : "Command failed";
          setError(message);
          appendSystemMessage(message);
        }
        return;
      }

      setBusy(true);
      try {
        const sessionId = await ensureLiveSession();
        rememberStored(storedSessionIdRef.current);
        await gw.request("prompt.submit", {
          session_id: sessionId,
          text: trimmed,
        });
      } catch (e) {
        setBusy(false);
        const message = e instanceof Error ? e.message : "Send failed";
        setError(message);
        appendSystemMessage(message);
      }
    },
    [
      appendSystemMessage,
      busy,
      credentialWarning,
      ensureLiveSession,
      gw,
      rememberStored,
      submitPrompt,
      trySteer,
    ],
  );

  // Drain steer-fallback queue when the agent turn finishes.
  useEffect(() => {
    if (busy || queueRef.current.length === 0) return;
    const next = queueRef.current.shift();
    setQueueCount(queueRef.current.length);
    if (!next) return;
    void submitPrompt(next);
  }, [busy, submitPrompt]);

  const enqueueDraft = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !busy) return;
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: "user", text: trimmed },
    ]);
    queueRef.current.push(trimmed);
    setQueueCount(queueRef.current.length);
  }, [busy]);

  const interrupt = useCallback(async () => {
    const sid = liveSessionIdRef.current;
    if (!sid) return;
    try {
      await gw.request("session.interrupt", { session_id: sid });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interrupt failed");
    }
  }, [gw]);

  const loadEarlier = useCallback(async () => {
    const stored = storedSessionIdRef.current;
    if (!stored || loadingEarlier || backfillLoaded) return;
    setLoadingEarlier(true);
    try {
      const resp = await api.getSessionMessages(stored, profileRef.current);
      const older = sessionMessagesToChatMessages(resp.messages ?? []);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
      }
      setBackfillLoaded(true);
    } catch (e) {
      appendSystemMessage(
        e instanceof Error ? e.message : "Could not load earlier messages",
      );
    } finally {
      setLoadingEarlier(false);
    }
  }, [appendSystemMessage, backfillLoaded, loadingEarlier]);

  const showLoadEarlier = Boolean(storedSessionId && phase === "session");

  const canLoadEarlier = Boolean(
    showLoadEarlier &&
      !backfillLoaded &&
      (sessionInfo.messageCount ?? 0) > messages.length,
  );

  const reset = useCallback(async () => {
    suppressResumeRef.current = true;
    const sid = liveSessionIdRef.current;
    bindLiveSession(null);
    storedSessionIdRef.current = null;
    setStoredSessionId(null);
    ensurePromiseRef.current = null;
    queueRef.current = [];
    setQueueCount(0);
    setActivity(EMPTY_ACTIVITY);
    setBusy(false);
    setError(null);
    setReconnecting(false);
    setCredentialWarning(null);
    setSessionInfo({});
    setSessionUsage(null);
    setResumeProgress(null);
    setBackfillLoaded(false);
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
  }, [bindLiveSession, createFreshSession, gw]);

  return {
    phase,
    messages,
    connectionState,
    busy,
    error,
    reconnecting,
    credentialWarning,
    ready,
    gateway: gw,
    liveSessionId,
    storedSessionId,
    sessionInfo,
    sessionUsage,
    activity: activityWithQueue,
    resumeProgress,
    canLoadEarlier,
    showLoadEarlier,
    loadingEarlier,
    submit,
    enqueueDraft,
    interrupt,
    reset,
    loadEarlier,
    setReasoningEffort,
    refreshSessionUsage,
    clearError: () => setError(null),
  };
}
