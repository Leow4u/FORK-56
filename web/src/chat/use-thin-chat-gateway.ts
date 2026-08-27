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
  ackApprovalReceived,
  applyPromptEvent,
  clearAllPrompts,
  EMPTY_PROMPT_STATE,
  hasBlockingPrompt,
  hasClarifyPrompt,
  mergePromptEvent,
  parseApprovalPayload,
  parseClarifyPayload,
  respondClarify,
  type ThinChatPromptState,
} from "./approvals";
import {
  buildPromptTextFromAttachments,
  type ThinComposerAttachment,
} from "./attachments";
import { syncAttachmentsForSubmit } from "./attach-upload";
import { textPart } from "@/lib/chat-messages";
import {
  activityLineFromGatewayEvent,
  thinChatSessionCreateParams,
  thinChatSessionResumeParams,
  type SessionCreateResult,
  type SessionResumeResult,
} from "./gateway-protocol";
import {
  applyPartsGatewayEvent,
  createPartsTurnState,
  historyToPartsMessages,
  optimisticUserPartsMessage,
  sessionMessagesToPartsMessages,
  type PartsTurnState,
} from "./parts-gateway-protocol";
import {
  buildResumeTranscript,
  turnStateFromInflight,
} from "./resume-transcript";
import type { ThinChatActivity } from "./chat-activity-strip";
import {
  makeQueuedEntry,
  type QueuedPromptEntry,
} from "./composer-queue";
import {
  clearInflightJournal,
  persistInflightJournal,
  prependOlderMessages,
  recoverInflightJournal,
} from "./inflight-journal";
import {
  mergeSessionInfo,
  sessionInfoFromPayload,
  sessionUsageFromPayload,
  type ThinChatSessionInfo,
  type ThinChatSessionUsage,
} from "./session-info";
import {
  readRememberedWorkspaceCwd,
  writeRememberedWorkspaceCwd,
} from "./workspace";
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

const PROMPT_EVENT_TYPES = new Set([
  "approval.request",
  "clarify.request",
  "sudo.request",
  "secret.request",
  "clarify.expire",
  "sudo.expire",
  "secret.expire",
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
  /** GUI bridge: preview.open from desktop_ui tools. */
  onPreviewOpen?: (payload: Record<string, unknown>) => void;
  onPreviewClose?: () => void;
  onPaneReveal?: (pane: string) => void;
  getTerminalText?: () => string;
  getPreviewSnapshot?: () => Record<string, unknown> | null;
  /** Background-process agent terminal stream (desktop_ui / process_registry). */
  onAgentTerminalOutput?: (processId: string, chunk: string) => void;
  onAgentTerminalClose?: (processId: string) => void;
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
  loadingEarlier: boolean;
  submit: (
    text: string,
    attachments?: ThinComposerAttachment[],
  ) => Promise<void>;
  enqueueDraft: (
    text: string,
    attachments?: ThinComposerAttachment[],
  ) => void;
  /** Interactive queue panel state. */
  queueEntries: QueuedPromptEntry[];
  queueParked: boolean;
  removeQueuedPrompt: (id: string) => void;
  sendQueuedNow: (id: string) => void;
  steerQueuedNow: (id: string) => Promise<void>;
  parkQueue: () => void;
  resumeQueue: () => void;
  interrupt: () => Promise<void>;
  reset: () => Promise<void>;
  loadEarlier: () => Promise<void>;
  setReasoningEffort: (effort: string) => Promise<void>;
  refreshSessionUsage: () => Promise<void>;
  clearError: () => void;
  /** User-chosen workspace cwd (null = detached / no project). */
  workspaceCwd: string | null;
  setWorkspaceCwd: (cwd: string) => Promise<void>;
  clearWorkspaceCwd: () => Promise<void>;
  /** Mid-turn blocking prompts (approval / clarify / sudo / secret). */
  prompts: ThinChatPromptState;
  setPrompts: (
    updater: (prev: ThinChatPromptState) => ThinChatPromptState,
  ) => void;
  /** Approval/sudo/secret parked — composer must queue, not steer. */
  blockingPrompt: boolean;
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
    onPreviewOpen,
    onPreviewClose,
    onPaneReveal,
    getTerminalText,
    getPreviewSnapshot,
    onAgentTerminalOutput,
    onAgentTerminalClose,
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
  const [workspaceCwd, setWorkspaceCwdState] = useState<string | null>(() =>
    readRememberedWorkspaceCwd(profile),
  );
  const workspaceCwdRef = useRef<string | null>(workspaceCwd);
  const [backfillLoaded, setBackfillLoaded] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [activity, setActivity] = useState<ThinChatActivity>(EMPTY_ACTIVITY);
  const [queueEntries, setQueueEntries] = useState<QueuedPromptEntry[]>([]);
  const [queueParked, setQueueParked] = useState(false);
  const queueCount = queueEntries.length;
  const [prompts, setPrompts] = useState<ThinChatPromptState>(EMPTY_PROMPT_STATE);
  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;
  const blockingPrompt = hasBlockingPrompt(prompts);

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
  const queueRef = useRef<QueuedPromptEntry[]>([]);
  useEffect(() => {
    queueRef.current = queueEntries;
  }, [queueEntries]);

  const pushQueued = useCallback((entry: QueuedPromptEntry) => {
    setQueueEntries((prev) => {
      const next = [...prev, entry];
      queueRef.current = next;
      return next;
    });
  }, []);

  const turnStateRef = useRef<PartsTurnState>(createPartsTurnState());

  const profileRef = useRef(profile);
  const onStoredSessionIdRef = useRef(onStoredSessionId);
  const onTitleRef = useRef(onTitle);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onPreviewOpenRef = useRef(onPreviewOpen);
  const onPreviewCloseRef = useRef(onPreviewClose);
  const onPaneRevealRef = useRef(onPaneReveal);
  const getTerminalTextRef = useRef(getTerminalText);
  const getPreviewSnapshotRef = useRef(getPreviewSnapshot);
  const onAgentTerminalOutputRef = useRef(onAgentTerminalOutput);
  const onAgentTerminalCloseRef = useRef(onAgentTerminalClose);

  useEffect(() => {
    profileRef.current = profile;
    onStoredSessionIdRef.current = onStoredSessionId;
    onTitleRef.current = onTitle;
    onPhaseChangeRef.current = onPhaseChange;
    onPreviewOpenRef.current = onPreviewOpen;
    onPreviewCloseRef.current = onPreviewClose;
    onPaneRevealRef.current = onPaneReveal;
    getTerminalTextRef.current = getTerminalText;
    getPreviewSnapshotRef.current = getPreviewSnapshot;
    onAgentTerminalOutputRef.current = onAgentTerminalOutput;
    onAgentTerminalCloseRef.current = onAgentTerminalClose;
  }, [
    profile,
    onStoredSessionId,
    onTitle,
    onPhaseChange,
    onPreviewOpen,
    onPreviewClose,
    onPaneReveal,
    getTerminalText,
    getPreviewSnapshot,
    onAgentTerminalOutput,
    onAgentTerminalClose,
  ]);

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
      { id: createMessageId(), role: "system", parts: [textPart(text)] },
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

  const restorePendingPrompts = useCallback(
    (
      result: SessionCreateResult | SessionResumeResult,
      sessionId: string,
    ) => {
      let next = clearAllPrompts();
      if (result.pending_approval) {
        const approval = parseApprovalPayload(
          result.pending_approval,
          sessionId,
        );
        if (approval) {
          next = { ...next, approval };
          if (approval.requestId) {
            void ackApprovalReceived(gw, {
              requestId: approval.requestId,
              sessionId,
            }).catch(() => undefined);
          }
        }
      }
      if (result.pending_clarify) {
        const clarify = parseClarifyPayload(
          result.pending_clarify,
          sessionId,
        );
        if (clarify) next = { ...next, clarify };
      }
      setPrompts(next);
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
    (result: SessionResumeResult, localMessages?: ChatMessage[]) => {
      bindLiveSession(result.session_id);
      const stored = result.stored_session_id ?? result.resumed ?? null;
      rememberStored(stored);
      const authoritative = buildResumeTranscript(
        historyToPartsMessages(result.messages),
        result.inflight,
        localMessages ?? [],
        result.session_id,
      );
      const recovery = recoverInflightJournal(stored, authoritative, {
        keepPending: Boolean(result.running),
      });
      turnStateRef.current = recovery.applied
        ? recovery.turn
        : turnStateFromInflight(result.inflight, result.session_id);
      setMessages(recovery.messages);
      setPhase("session");
      setBusy(Boolean(result.running));
      setReady(true);
      setBackfillLoaded(false);
      setResumeProgress(null);
      if (result.info) {
        applySessionInfoPayload(result.info);
      }
      restorePendingPrompts(result, result.session_id);
      const title =
        result.info && typeof result.info.title === "string"
          ? result.info.title
          : null;
      if (title) onTitleRef.current?.(title);
      void refreshSessionUsage();
    },
    [
      applySessionInfoPayload,
      bindLiveSession,
      rememberStored,
      refreshSessionUsage,
      restorePendingPrompts,
    ],
  );

  const createFreshSession = useCallback(async (): Promise<string> => {
    await gw.connect();
    const created = await gw.request<SessionCreateResult>(
      "session.create",
      thinChatSessionCreateParams(profileRef.current, workspaceCwdRef.current),
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

  const setWorkspaceCwd = useCallback(
    async (cwd: string) => {
      const trimmed = cwd.trim();
      if (!trimmed) return;
      const sid = liveSessionIdRef.current;
      if (sid) {
        const info = await gw.request<Record<string, unknown>>("session.cwd.set", {
          session_id: sid,
          cwd: trimmed,
        });
        if (info) applySessionInfoPayload(info);
      }
      workspaceCwdRef.current = trimmed;
      setWorkspaceCwdState(trimmed);
      writeRememberedWorkspaceCwd(trimmed, profileRef.current);
    },
    [applySessionInfoPayload, gw],
  );

  const clearWorkspaceCwd = useCallback(async () => {
    workspaceCwdRef.current = null;
    setWorkspaceCwdState(null);
    writeRememberedWorkspaceCwd(null, profileRef.current);
    // Detached UI state — live session keeps its last gateway cwd for tools,
    // matching desktop: Files/Review hide when hasWorkspace is false.
  }, []);

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
    const storedSessionKey = storedSessionIdRef.current;
    if (storedSessionKey) {
      const resumed = await gw.request<SessionResumeResult>(
        "session.resume",
        thinChatSessionResumeParams(storedSessionKey, profileRef.current),
      );
      bindLiveSession(resumed.session_id);
      const storedId = resumed.stored_session_id ?? resumed.resumed ?? null;
      rememberStored(storedId);
      setMessages((current) => {
        const authoritative = buildResumeTranscript(
          historyToPartsMessages(resumed.messages),
          resumed.inflight,
          current,
          resumed.session_id,
        );
        const recovery = recoverInflightJournal(storedId, authoritative, {
          keepPending: Boolean(resumed.running),
        });
        turnStateRef.current = recovery.applied
          ? recovery.turn
          : turnStateFromInflight(resumed.inflight, resumed.session_id);
        return recovery.messages;
      });
      setBusy(Boolean(resumed.running));
      setReady(true);
      if (resumed.info) {
        applySessionInfoPayload(resumed.info);
      }
      restorePendingPrompts(resumed, resumed.session_id);
      void refreshSessionUsage();
      return;
    }
    // Home draft: reconnect only — session.create runs on first send (desktop parity).
    setReady(true);
  }, [
    applySessionInfoPayload,
    bindLiveSession,
    gw,
    rememberStored,
    refreshSessionUsage,
    restorePendingPrompts,
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

      if (PROMPT_EVENT_TYPES.has(ev.type) || ev.type === "message.complete") {
        const payload =
          ev.payload && typeof ev.payload === "object"
            ? (ev.payload as Record<string, unknown>)
            : null;
        const eventSid =
          (sid ??
            (typeof ev.session_id === "string" ? ev.session_id : null)) ||
          null;
        const patch = applyPromptEvent(ev.type, payload, eventSid);
        if (patch.kind !== "noop") {
          setPrompts((prev) => mergePromptEvent(prev, patch));
        }
        if (
          ev.type === "approval.request" &&
          payload &&
          typeof payload.request_id === "string" &&
          payload.request_id
        ) {
          void ackApprovalReceived(gw, {
            requestId: payload.request_id,
            sessionId: eventSid,
          }).catch(() => undefined);
        }
      }

      // desktop_ui bridge — answer read-backs; surface open/reveal to UI.
      const bridgePayload =
        ev.payload && typeof ev.payload === "object"
          ? (ev.payload as Record<string, unknown>)
          : null;

      if (ev.type === "preview.open" && bridgePayload) {
        onPreviewOpenRef.current?.(bridgePayload);
      }
      if (ev.type === "preview.close") {
        onPreviewCloseRef.current?.();
      }
      if (ev.type === "pane.reveal") {
        const pane =
          typeof bridgePayload?.pane === "string" ? bridgePayload.pane : "";
        if (pane) onPaneRevealRef.current?.(pane);
      }
      if (ev.type === "terminal.read.request") {
        const requestId =
          typeof bridgePayload?.request_id === "string"
            ? bridgePayload.request_id
            : "";
        if (requestId) {
          const text = getTerminalTextRef.current?.() ?? "";
          void gw
            .request("terminal.read.respond", {
              request_id: requestId,
              text: text
                ? JSON.stringify({ text, truncated: false })
                : "",
            })
            .catch(() => undefined);
        }
      }
      if (ev.type === "preview.read.request") {
        const requestId =
          typeof bridgePayload?.request_id === "string"
            ? bridgePayload.request_id
            : "";
        if (requestId) {
          const snap = getPreviewSnapshotRef.current?.() ?? null;
          void gw
            .request("preview.read.respond", {
              request_id: requestId,
              text: snap ? JSON.stringify(snap) : "",
            })
            .catch(() => undefined);
        }
      }
      if (ev.type === "window.read.request") {
        const requestId =
          typeof bridgePayload?.request_id === "string"
            ? bridgePayload.request_id
            : "";
        if (requestId) {
          // No native window enumeration in the browser dashboard.
          void gw
            .request("window.read.respond", {
              request_id: requestId,
              text: "",
            })
            .catch(() => undefined);
        }
      }
      if (ev.type === "tour.request") {
        const requestId =
          typeof bridgePayload?.request_id === "string"
            ? bridgePayload.request_id
            : "";
        if (requestId) {
          // Honest degrade: thin chat has no driver.js tour surface.
          void gw
            .request("tour.respond", {
              request_id: requestId,
              text: JSON.stringify({
                success: false,
                error:
                  "Guided tours are not available in the web dashboard chat.",
              }),
            })
            .catch(() => undefined);
        }
      }
      if (ev.type === "agent.terminal.output" && bridgePayload) {
        const processId =
          typeof bridgePayload.process_id === "string"
            ? bridgePayload.process_id
            : "";
        const chunk =
          typeof bridgePayload.chunk === "string" ? bridgePayload.chunk : "";
        if (processId) {
          onAgentTerminalOutputRef.current?.(processId, chunk);
        }
      }
      if (ev.type === "terminal.close" && bridgePayload) {
        const processId =
          typeof bridgePayload.process_id === "string"
            ? bridgePayload.process_id
            : "";
        if (processId) {
          onAgentTerminalCloseRef.current?.(processId);
        }
      }

      if (STREAM_EVENT_TYPES.has(ev.type)) {
        setMessages((prev) => {
          const result = applyPartsGatewayEvent(
            prev,
            ev.type,
            ev.payload,
            turnStateRef.current,
          );
          turnStateRef.current = result.turn;
          return result.messages;
        });
        if (ev.type === "message.start") {
          setBusy(true);
          setPhase("session");
        }
        if (ev.type === "message.complete" || ev.type === "error") {
          setBusy(false);
          clearInflightJournal(storedSessionIdRef.current);
          void refreshSessionUsage();
        }
      }
    },
    [applySessionInfoPayload, gw, refreshSessionUsage],
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
          await gw.connect();
          if (cancelled) return;
          setPhase("home");
          setMessages([]);
          setReady(true);
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
                parts: [textPart("Could not resume this session.")],
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
    async (text: string, attachments: ThinComposerAttachment[] = []) => {
      const hasAttachments = attachments.length > 0;
      const trimmed = text.trim();
      if (!trimmed && !hasAttachments) return;
      setError(null);
      setBusy(true);
      try {
        const sessionId = await ensureLiveSession();
        rememberStored(storedSessionIdRef.current);
        const staged = hasAttachments
          ? await syncAttachmentsForSubmit(attachments, {
              gateway: gw,
              sessionId,
            })
          : [];
        const promptText = buildPromptTextFromAttachments(trimmed, staged);
        if (!promptText.trim()) {
          setBusy(false);
          return;
        }
        await gw.request("prompt.submit", {
          session_id: sessionId,
          text: promptText,
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
    async (text: string, attachments: ThinComposerAttachment[] = []) => {
      const trimmed = text.trim();
      const hasAttachments = attachments.length > 0;
      if (!trimmed && !hasAttachments) return;

      const isSlash = trimmed.startsWith("/") && !hasAttachments;
      if (!isSlash && credentialWarning && !busy) {
        return;
      }

      setError(null);
      setPhase("session");

      const displayText =
        buildPromptTextFromAttachments(trimmed, attachments) || trimmed;

      if (busy && !isSlash) {
        // Clarify: typing IS "none of these" — skip then continue.
        if (hasClarifyPrompt(promptsRef.current)) {
          const clarify = promptsRef.current.clarify;
          setPrompts((prev) => ({ ...prev, clarify: null }));
          if (clarify) {
            void respondClarify(gw, {
              requestId: clarify.requestId,
              answer: "",
            }).catch(() => undefined);
          }
        }

        // Approval / sudo / secret: cannot answer by typing — queue, not steer.
        const blocking = hasBlockingPrompt(promptsRef.current);
        if (hasAttachments || blocking) {
          const images = attachments
            .filter((a) => a.kind === "image")
            .map((a) => a.previewUrl || a.path || "")
            .filter(Boolean);
          setMessages((prev) => [
            ...prev,
            optimisticUserPartsMessage(
              displayText,
              images.length ? images : undefined,
            ),
          ]);
          pushQueued(
            makeQueuedEntry({
              text: trimmed,
              displayText,
              attachments,
            }),
          );
          appendSystemMessage("Message queued for next turn");
          return;
        }

        setMessages((prev) => [
          ...prev,
          optimisticUserPartsMessage(trimmed),
        ]);
        const steerResult = await trySteer(trimmed);
        if (steerResult === "queued") return;
        pushQueued(makeQueuedEntry({ text: trimmed, attachments: [] }));
        appendSystemMessage(
          steerResult === "rejected"
            ? "Steer rejected — message queued for next turn"
            : "Steer failed — message queued for next turn",
        );
        return;
      }

      if (busy && isSlash) return;

      // Idle + clarify: skip before sending so the tool batch unblocks.
      if (!busy && hasClarifyPrompt(promptsRef.current) && !isSlash) {
        const clarify = promptsRef.current.clarify;
        setPrompts((prev) => ({ ...prev, clarify: null }));
        if (clarify) {
          void respondClarify(gw, {
            requestId: clarify.requestId,
            answer: "",
          }).catch(() => undefined);
        }
      }

      const images = attachments
        .filter((a) => a.kind === "image")
        .map((a) => a.previewUrl || a.path || "")
        .filter(Boolean);
      setMessages((prev) => [
        ...prev,
        optimisticUserPartsMessage(
          displayText,
          images.length ? images : undefined,
        ),
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
                  optimisticUserPartsMessage(message),
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

      await submitPrompt(trimmed, attachments);
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
      pushQueued,
    ],
  );

  // Drain steer-fallback queue when the agent turn finishes (unless parked).
  useEffect(() => {
    if (busy || queueParked || queueRef.current.length === 0) return;
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    setQueueEntries(rest);
    if (!next) return;
    void submitPrompt(next.text, next.attachments);
  }, [busy, queueParked, submitPrompt]);

  useEffect(() => {
    persistInflightJournal(
      storedSessionId,
      messages,
      turnStateRef.current,
      busy,
    );
  }, [busy, messages, storedSessionId]);

  const enqueueDraft = useCallback(
    (text: string, attachments: ThinComposerAttachment[] = []) => {
      const trimmed = text.trim();
      if ((!trimmed && !attachments.length) || !busy) return;
      const displayText =
        buildPromptTextFromAttachments(trimmed, attachments) || trimmed;
      const images = attachments
        .filter((a) => a.kind === "image")
        .map((a) => a.previewUrl || a.path || "")
        .filter(Boolean);
      setMessages((prev) => [
        ...prev,
        optimisticUserPartsMessage(
          displayText,
          images.length ? images : undefined,
        ),
      ]);
      pushQueued(
        makeQueuedEntry({
          text: trimmed,
          displayText,
          attachments,
        }),
      );
    },
    [busy, pushQueued],
  );

  const removeQueuedPrompt = useCallback((id: string) => {
    setQueueEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      queueRef.current = next;
      return next;
    });
  }, []);

  const sendQueuedNow = useCallback(
    (id: string) => {
      const entry = queueRef.current.find((e) => e.id === id);
      if (!entry) return;
      if (busy) {
        setQueueEntries((prev) => {
          const next = [entry, ...prev.filter((e) => e.id !== id)];
          queueRef.current = next;
          return next;
        });
        setQueueParked(false);
        return;
      }
      setQueueEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        queueRef.current = next;
        return next;
      });
      setQueueParked(false);
      void submitPrompt(entry.text, entry.attachments);
    },
    [busy, submitPrompt],
  );

  const steerQueuedNow = useCallback(
    async (id: string) => {
      const entry = queueRef.current.find((e) => e.id === id);
      if (!entry || !busy) return;
      const result = await trySteer(entry.text);
      if (result === "queued" || result === "rejected" || result === "failed") {
        // Leave in queue on failure; remove only when steer accepted as queued
        // at gateway (still drains later). On true mid-turn accept there's no
        // distinct status — gateway "queued" means accepted into steer buffer.
        if (result === "queued") {
          setQueueEntries((prev) => {
            const next = prev.filter((e) => e.id !== id);
            queueRef.current = next;
            return next;
          });
        }
      }
    },
    [busy, trySteer],
  );

  const parkQueue = useCallback(() => setQueueParked(true), []);
  const resumeQueue = useCallback(() => setQueueParked(false), []);

  const interrupt = useCallback(async () => {
    const sid = liveSessionIdRef.current;
    if (!sid) return;
    try {
      await gw.request("session.interrupt", { session_id: sid });
      setQueueParked(true);
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
      const older = sessionMessagesToPartsMessages(resp.messages ?? []);
      if (older.length > 0) {
        setMessages((prev) => prependOlderMessages(prev, older));
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

  const canLoadEarlier = Boolean(
    storedSessionId &&
      phase === "session" &&
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
    turnStateRef.current = createPartsTurnState();
    clearInflightJournal(storedSessionIdRef.current);
    setQueueEntries([]);
    setQueueParked(false);
    setActivity(EMPTY_ACTIVITY);
    setPrompts(clearAllPrompts());
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
      await gw.connect();
      setPhase("home");
      setMessages([]);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start new chat");
    }
  }, [bindLiveSession, gw]);

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
    loadingEarlier,
    submit,
    enqueueDraft,
    queueEntries,
    queueParked,
    removeQueuedPrompt,
    sendQueuedNow,
    steerQueuedNow,
    parkQueue,
    resumeQueue,
    interrupt,
    reset,
    loadEarlier,
    setReasoningEffort,
    refreshSessionUsage,
    clearError: () => setError(null),
    workspaceCwd,
    setWorkspaceCwd,
    clearWorkspaceCwd,
    prompts,
    setPrompts,
    blockingPrompt,
  };
}
