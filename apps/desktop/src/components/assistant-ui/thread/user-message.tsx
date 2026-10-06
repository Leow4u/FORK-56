import { ActionBarPrimitive, BranchPickerPrimitive, MessagePrimitive, useAuiState } from '@assistant-ui/react'
import { type FC, type ReactNode, useEffect, useState } from 'react'

import { DirectiveContent } from '@/components/assistant-ui/directive-text'
import { messageAttachmentRefs, messageContentText } from '@/components/assistant-ui/thread/content'
import { ReactionBadge, ReactionPicker } from '@/components/assistant-ui/thread/message-reactions'
import { MessageTimelineTimestamp } from '@/components/assistant-ui/thread/timeline-timestamp'
import { type RestoreMessageTarget } from '@/components/assistant-ui/thread/types'
import { useMessageReactions } from '@/components/assistant-ui/thread/use-message-reactions'
import { UserMessageText } from '@/components/assistant-ui/thread/user-message-text'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Codicon } from '@/components/ui/codicon'
import { CopyButton } from '@/components/ui/copy-button'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { PencilIcon, StopFilled } from '@/lib/icons'
import { $gateway } from '@/store/gateway'
import { notifyThreadEditOpen } from '@/store/thread-scroll'
import { isWatchWindow } from '@/store/windows'

/** True when the user has a live text highlight (drag-select / triple-click). */
export function hasTextSelection(): boolean {
  const selection = window.getSelection()

  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0)
}

/**
 * The row a prompt sits in. Everything in it lines up at the end of the line —
 * the right, or the left when the window runs right to left — so who is
 * speaking reads before a word of it does: the prompt there, the reply as prose
 * across the column. The inline editor takes the same row at full width.
 *
 * It scrolls with the conversation. The prompt used to pin to the top of the
 * scroller while its reply ran underneath; the conversation timeline rail is
 * the way back to a prompt now.
 */
export function HumanMessageContainer({ children, messageId }: { children: ReactNode; messageId?: string }) {
  return (
    <div
      className="group/user-message flex w-full min-w-0 flex-col items-end gap-0 pt-1"
      data-message-id={messageId}
      data-role="user"
      data-slot="aui_user-message-root"
    >
      {children}
    </div>
  )
}

// The prompt: as wide as its text, up to 80% of the column, filled with the
// theme's bubble color and no border — the fill is what sets it apart from the
// reply. Text inside reads from the start of the line.
//
// no-drag: a bubble scrolled up to the top of the transcript slides under the
// titlebar's [-webkit-app-region:drag] strips (app-shell.tsx). Electron resolves
// drag regions at the compositor level — z-index and pointer-events don't help —
// so without the carve-out a click there drags the window instead of selecting
// the text.
const USER_PROMPT_BUBBLE_CLASS =
  'composer-human-message relative w-fit min-w-0 max-w-full rounded-(--prompt-bubble-radius) bg-(--dt-user-bubble) px-3.5 py-2 text-start text-[length:var(--conversation-text-font-size)] leading-(--dt-line-height) text-foreground/95 [-webkit-app-region:no-drag]'

// The inline editor keeps the composer's look: a bordered field, full width,
// on the chat surface — the gray belongs to a prompt that has been sent.
export const USER_EDIT_BUBBLE_CLASS =
  'composer-human-message relative flex w-full min-w-0 max-w-full flex-col gap-1.5 overflow-y-auto rounded-xl border bg-(--ui-chat-bubble-background) px-3 py-2 text-left [-webkit-app-region:no-drag]'

export const USER_ACTION_ICON_BUTTON_CLASS =
  'grid place-items-center rounded-md bg-transparent text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-active-background) hover:text-foreground disabled:cursor-default disabled:text-(--ui-text-quaternary) disabled:opacity-70'

export const USER_ACTION_ICON_SIZE = '0.6875rem'
export const StopGlyph = <StopFilled aria-hidden className="size-3.5 -translate-y-px" />

// Background-process notifications are injected into the conversation as user
// messages (the agent must react to them, and message-role alternation forbids
// a synthetic system row mid-loop). They are NOT something the human typed, so
// render them as a compact system-style notice instead of a user bubble.
// Shape: see tools/process_registry.py format_process_notification().
const PROCESS_NOTIFICATION_RE = /^\[IMPORTANT: Background process [\s\S]*\]$/

// Agent-to-agent deliveries ("Message from 🤖 <sender>: …", the Bot Mode /
// multi-profile convention; optional "(@<handle>)" carries the sender's
// profile name for avatar resolution; legacy "[Message from agent
// '<sender>'] …" too). They arrive on the user role because the recipient's
// turn runs on it, but they are NOT the human speaking — render them as a
// compact attributed timeline notice instead of a user bubble.
export const AGENT_MESSAGE_RE =
  /^(?:Message from (?:🤖\s*)?([^:\n(]{1,64}?)(?:\s*\(@([a-z0-9][a-z0-9_-]{0,63})\))?:\s*|\[Message from agent '([^']{1,64})'\]\s*)([\s\S]*)$/u

// sender handle -> avatar data URL. Module-level so a chat full of notices
// from one bot resolves once. Hits are cached for the window's lifetime;
// misses only briefly (30s) — an avatar can appear at any moment (bot just
// created, art backfill still running), and a permanent negative cache
// froze the 🤖 glyph until an app restart.
export const agentAvatarCache = new Map<string, null | string>()
const agentAvatarMissAt = new Map<string, number>()
const AVATAR_MISS_TTL_MS = 30_000
const agentAvatarInflight = new Map<string, Promise<null | string>>()

export async function resolveAgentAvatar(handle: string): Promise<null | string> {
  const key = handle.trim().toLowerCase()

  if (!key) {
    return null
  }

  if (agentAvatarCache.has(key)) {
    const hit = agentAvatarCache.get(key) ?? null

    if (hit !== null) {
      return hit
    }

    // Negative entry: honor it only within the TTL, then re-probe.
    if (Date.now() - (agentAvatarMissAt.get(key) ?? 0) < AVATAR_MISS_TTL_MS) {
      return null
    }

    agentAvatarCache.delete(key)
  }

  const inflight = agentAvatarInflight.get(key)

  if (inflight) {
    return inflight
  }

  const run = (async (): Promise<null | string> => {
    try {
      const gateway = $gateway.get()

      if (!gateway) {
        return null
      }

      const res = await gateway.request<{ profiles?: Array<{ has_avatar?: boolean; name: string }> }>('profiles.list', {
        include_sessions: false
      })

      const profiles = res?.profiles ?? []
      let profile = profiles.find(p => p.name.toLowerCase() === key)

      // 'work4you' is the conventional alias for the primary profile.
      if (!profile && key === 'work4you') {
        profile = profiles.find(p => p.name === 'default')
      }

      if (!profile?.has_avatar) {
        return null
      }

      const asset = await gateway.request<{ data?: string; found?: boolean }>('profiles.get_asset', {
        asset: 'avatar',
        name: profile.name
      })

      return asset?.found && asset.data ? asset.data : null
    } catch {
      // Older gateway (no profiles.* RPCs) or transient failure — the 🤖
      // glyph fallback is always correct.
      return null
    } finally {
      agentAvatarInflight.delete(key)
    }
  })()

  agentAvatarInflight.set(key, run)
  const out = await run
  agentAvatarCache.set(key, out)

  if (out === null) {
    agentAvatarMissAt.set(key, Date.now())
  }

  return out
}

const AgentMessageNote: FC<{ text: string }> = ({ text }) => {
  const notices = useI18n().t.assistant.notices
  const match = AGENT_MESSAGE_RE.exec(text)
  const sender = (match?.[1] || match?.[3] || 'agent').trim()
  const handle = (match?.[2] || match?.[3] || sender).trim()
  const body = (match?.[4] || '').trim()
  const [avatar, setAvatar] = useState<null | string>(() => agentAvatarCache.get(handle.toLowerCase()) ?? null)

  useEffect(() => {
    let live = true

    void resolveAgentAvatar(handle).then(url => {
      if (live && url) {
        setAvatar(url)
      }
    })

    return () => {
      live = false
    }
  }, [handle])

  // Grok-bots shape: an inter-agent delivery is a timeline EVENT, not a
  // conversation bubble — a subtle centered notice ("Message from 🤖 X"),
  // with the delivered text one click away instead of shouting in the
  // transcript. The recipient's reply below it stays a normal assistant
  // message, so the exchange still reads in order.
  return (
    <div
      className="flex max-w-[min(86%,44rem)] flex-col gap-0.5 self-center px-2 py-0.5 text-[0.6875rem] leading-5 text-(--ui-text-tertiary)"
      data-slot="aui_agent-message-note"
    >
      <span className="flex items-center justify-center gap-1.5">
        {avatar ? (
          <img alt="" aria-hidden className="size-4 shrink-0 rounded-full object-cover" src={avatar} />
        ) : (
          <span aria-hidden className="text-[0.8125rem] leading-none">
            🤖
          </span>
        )}
        <span className="wrap-anywhere">{notices.messageFrom(sender)}</span>
      </span>
      {body && (
        <details className="self-center">
          <summary className="cursor-pointer select-none text-center text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)">
            {notices.showMessage}
          </summary>
          <div className="mt-1 max-w-[36rem] rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2 text-left text-[0.75rem] leading-5 text-foreground/85">
            <UserMessageText text={body} />
          </div>
        </details>
      )}
    </div>
  )
}

const ProcessNotificationNote: FC<{ text: string }> = ({ text }) => {
  const notices = useI18n().t.assistant.notices
  const body = text.replace(/^\[IMPORTANT:\s*/, '').replace(/\]$/, '')
  const newline = body.indexOf('\n')
  const headline = (newline === -1 ? body : body.slice(0, newline)).trim()
  const detail = newline === -1 ? '' : body.slice(newline + 1).trim()

  return (
    <div className="flex max-w-[min(86%,44rem)] flex-col gap-0.5 self-center px-2 py-0.5 text-[0.6875rem] leading-5 text-(--ui-text-tertiary)">
      <span className="flex items-center gap-1.5">
        <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="terminal" size="0.75rem" />
        <span className="wrap-anywhere">{headline}</span>
      </span>
      {detail && (
        <details className="pl-[1.3125rem]">
          <summary className="cursor-pointer select-none text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)">
            {notices.output}
          </summary>
          <pre
            className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[0.625rem] leading-4 text-(--ui-text-tertiary)"
            data-selectable-text="true"
          >
            {detail}
          </pre>
        </details>
      )}
    </div>
  )
}

export const UserMessage: FC<{
  onCancel?: () => Promise<void> | void
  onRequestRestoreConfirm?: (messageId: string, target: RestoreMessageTarget) => void
}> = ({ onCancel, onRequestRestoreConfirm }) => {
  const { t } = useI18n()
  const copy = t.assistant.thread
  const messageId = useAuiState(s => s.message.id)
  const content = useAuiState(s => s.message.content)
  const messageText = messageContentText(content)
  const threadRunning = useAuiState(s => s.thread.isRunning)

  const latestUserId = useAuiState(s => {
    for (let i = s.thread.messages.length - 1; i >= 0; i--) {
      const message = s.thread.messages[i] as { id?: string; role?: string }

      if (message.role === 'user') {
        return message.id ?? null
      }
    }

    return null
  })

  const runtimeUserOrdinal = useAuiState(s => {
    let ordinal = 0

    for (const message of s.thread.messages) {
      if (message.role !== 'user') {
        continue
      }

      if (message.id === s.message.id) {
        return ordinal
      }

      ordinal += 1
    }

    return null
  })

  const attachmentRefs = useAuiState(s => {
    const custom = (s.message.metadata?.custom ?? {}) as { attachmentRefs?: unknown }

    return messageAttachmentRefs(custom.attachmentRefs)
  })

  const [pickerOpen, setPickerOpen] = useState(false)
  const { enabled: reactionsEnabled, react, reactions: shownReactions } = useMessageReactions(messageId, 'user')

  const pickEmoji = (emoji: null | string) => {
    setPickerOpen(false)
    react(emoji)
  }

  // Watch windows spectate a subagent run driven elsewhere — prompts can't be
  // edited, restored, or stopped from here. Copying still works.
  const readOnly = isWatchWindow()

  // Injected background-process notification, not a human prompt — render the
  // compact system-style notice (after all hooks above have run).
  if (PROCESS_NOTIFICATION_RE.test(messageText.trim())) {
    return (
      <MessagePrimitive.Root
        className="flex w-full min-w-0 flex-col items-stretch"
        data-role="user"
        data-slot="aui_user-message-root"
      >
        <ProcessNotificationNote text={messageText.trim()} />
        <MessageTimelineTimestamp className="self-center" />
      </MessagePrimitive.Root>
    )
  }

  // Agent-to-agent delivery, not a human prompt — attributed inter-agent card.
  if (AGENT_MESSAGE_RE.test(messageText.trim())) {
    return (
      <MessagePrimitive.Root
        className="flex w-full min-w-0 flex-col items-stretch pb-(--conversation-turn-gap)"
        data-role="user"
        data-slot="aui_user-message-root"
      >
        <AgentMessageNote text={messageText.trim()} />
      </MessagePrimitive.Root>
    )
  }

  const hasBody = messageText.trim().length > 0
  const isLatestUser = messageId === latestUserId
  const showStop = !readOnly && isLatestUser && threadRunning && Boolean(onCancel)
  // Restore (re-run this exact prompt) is available everywhere the Stop button
  // isn't — including mid-stream on older prompts, since the action interrupts
  // the live turn before rewinding.
  const showRestore = !readOnly && !showStop && Boolean(onRequestRestoreConfirm) && hasBody

  return (
    <MessagePrimitive.Root asChild>
      <HumanMessageContainer messageId={messageId}>
        {attachmentRefs.length > 0 && (
          // Attachments go with what they were sent with: at the end of the
          // line, just above the bubble. Image refs render as thumbnails, file
          // refs as chips.
          <div className="flex max-w-[80%] flex-wrap justify-end gap-1 pb-1" data-slot="aui_user-attachments">
            <DirectiveContent text={attachmentRefs.join(' ')} />
          </div>
        )}
        <ActionBarPrimitive.Root className="flex w-full min-w-0 flex-col items-end" data-slot="aui_user-bubble-actions">
          {hasBody && (
            <ReactionPicker
              onOpenChange={setPickerOpen}
              onSelect={pickEmoji}
              open={pickerOpen}
              selected={shownReactions.find(reaction => reaction.author === 'user')?.emoji}
            >
              <div
                className="min-w-0 max-w-[80%]"
                // The app context menu skips PLAIN right-clicks here (the
                // attr below) so this handler keeps the picker gesture; a
                // link/image/selection inside the bubble still gets the app
                // menu, and this handler's selection guard keeps ⌘C flows.
                data-context-menu-skip=""
                onContextMenu={
                  // Right-click is the desktop stand-in for iOS touch-and-hold —
                  // but only when there's nothing selected. A live highlight
                  // keeps the native Copy menu (and ⌘C) instead of the picker.
                  readOnly || !reactionsEnabled
                    ? undefined
                    : event => {
                        if (hasTextSelection()) {
                          return
                        }

                        event.preventDefault()
                        setPickerOpen(true)
                      }
                }
              >
                {/* Text, not a button: a click selects, the way it does in
                    the reply. The prompt is read in full — no clamp, however
                    long — and editing has its own button below. Messages
                    render a bare-minimum markdown: backtick `code` and ```
                    fenced ``` blocks, with directive chips (`@file:` etc.)
                    still resolved inside the plain-text spans. */}
                <div className={USER_PROMPT_BUBBLE_CLASS} data-slot="aui_user-bubble">
                  <UserMessageText className="wrap-anywhere" text={messageText} />
                </div>
              </div>
            </ReactionPicker>
          )}
          {/* One line under the bubble, at its end: the reactions it got,
              always shown, and its actions, shown while the pointer is on the
              prompt or a button in it has focus. The line keeps its height
              while hidden, so nothing moves when it appears. */}
          <div className="flex h-7 min-w-0 items-center justify-end gap-1.5" data-slot="aui_user-footer">
            <MessageTimelineTimestamp />
            <ReactionBadge className="gap-1.5" onRetract={() => react(null)} reactions={shownReactions} />
            <div
              className="pointer-events-none flex items-center gap-0.5 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/user-message:pointer-events-auto group-hover/user-message:opacity-100"
              data-slot="aui_user-actions"
            >
              {hasBody && <CopyButton appearance="icon" buttonSize="icon-xs" label={copy.copy} text={messageText} />}
              {!readOnly && (
                <ActionBarPrimitive.Edit asChild>
                  <TooltipIconButton
                    onClick={() => triggerHaptic('selection')}
                    // Before React swaps the editor in, so the viewport holds
                    // its place while the bubble turns into the full-width
                    // editor (thread-scroll).
                    onPointerDown={() => notifyThreadEditOpen()}
                    tooltip={copy.editMessage}
                  >
                    <PencilIcon className="size-3.5" />
                  </TooltipIconButton>
                </ActionBarPrimitive.Edit>
              )}
              {showStop && (
                <TooltipIconButton onClick={() => void onCancel?.()} tooltip={copy.stop}>
                  {StopGlyph}
                </TooltipIconButton>
              )}
              {showRestore && (
                <TooltipIconButton
                  onClick={() => {
                    triggerHaptic('selection')
                    onRequestRestoreConfirm?.(messageId, {
                      text: messageText,
                      userOrdinal: runtimeUserOrdinal
                    })
                  }}
                  tooltip={copy.restoreFromHere}
                >
                  <Codicon name="discard" size="0.875rem" />
                </TooltipIconButton>
              )}
            </div>
          </div>
          {!readOnly && (
            <BranchPickerPrimitive.Root
              className="checkpoint-container flex items-center justify-end gap-1 pb-0 pt-1 pe-1.5 text-[0.75rem] leading-none text-(--ui-text-tertiary)"
              hideWhenSingleBranch
            >
              <span aria-hidden className="checkpoint-icon size-1.5 rounded-full border border-current" />
              <BranchPickerPrimitive.Previous
                className="checkpoint-restore-text rounded-sm bg-transparent px-1 opacity-65 hover:opacity-100 disabled:hidden disabled:cursor-default"
                title={copy.restorePrevious}
              >
                {copy.restoreCheckpoint}
              </BranchPickerPrimitive.Previous>
              <span className="checkpoint-divider opacity-55">
                <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
              </span>
              <BranchPickerPrimitive.Next
                className="checkpoint-restore-text rounded-sm bg-transparent px-1 opacity-65 hover:opacity-100 disabled:hidden disabled:cursor-default"
                title={copy.restoreNext}
              >
                {copy.goForward}
              </BranchPickerPrimitive.Next>
            </BranchPickerPrimitive.Root>
          )}
        </ActionBarPrimitive.Root>
      </HumanMessageContainer>
    </MessagePrimitive.Root>
  )
}
