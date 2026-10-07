import { useCallback } from 'react'

import { translateNow } from '@/i18n'
import { gatewayEventCompletedFileDiff } from '@/lib/gateway-events'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { reachablePreviewUrl } from '@/lib/preview-reach'
import {
  $previewTabs,
  beginPreviewServerRestart,
  closePreviewMatchingIn,
  closeRightRail,
  completePreviewServerRestart,
  openPreview,
  type PreviewOwner,
  previewOwnerFor,
  progressPreviewServerRestart,
  requestPreviewReload
} from '@/store/preview'
import { $activeSessionId, $currentCwd, $selectedStoredSessionId } from '@/store/session'
import { $focusedRuntimeId, $sessionStates, $sessionTiles } from '@/store/session-states'
import type { RpcEvent } from '@/types/work4you'

type EventHandler = (event: RpcEvent) => void

interface PreviewRoutingOptions {
  baseHandleGatewayEvent: EventHandler
  currentCwd: string
  requestGateway: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
}

function sessionIsOnScreen(sessionId: string): boolean {
  return (
    sessionId === $focusedRuntimeId.get() ||
    sessionId === $activeSessionId.get() ||
    $sessionTiles.get().some(tile => tile.runtimeId === sessionId)
  )
}

/** The conversation an agent event speaks for, as the owner of its preview
 *  tabs: the primary chat's runtime is the primary selection (null = its
 *  draft), a tile's runtime is that tile, any other runtime resolves through
 *  its session state. Undefined when the event names no runtime this window
 *  knows — it then speaks for the conversation on screen, as it always has. */
export function previewOwnerForRuntime(runtimeId: null | string | undefined): PreviewOwner | undefined {
  if (!runtimeId) {
    return undefined
  }

  if (runtimeId === $activeSessionId.get()) {
    return previewOwnerFor($selectedStoredSessionId.get())
  }

  const tile = $sessionTiles.get().find(item => item.runtimeId === runtimeId)
  const storedSessionId = tile?.storedSessionId ?? $sessionStates.get()[runtimeId]?.storedSessionId

  return storedSessionId ? previewOwnerFor(storedSessionId) : undefined
}

export function usePreviewRouting({ baseHandleGatewayEvent, currentCwd, requestGateway }: PreviewRoutingOptions) {
  const restartPreviewServer = useCallback(
    async (url: string, context?: string) => {
      const sessionId = $focusedRuntimeId.get()

      if (!sessionId) {
        throw new Error(translateNow('desktop.previewRestart.noSession'))
      }

      const cwd = $currentCwd.get() || currentCwd || ''

      const result = await requestGateway<{ task_id?: string }>('preview.restart', {
        context: context || undefined,
        cwd: cwd || undefined,
        session_id: sessionId,
        url
      })

      const taskId = result.task_id || ''

      if (!taskId) {
        throw new Error(translateNow('desktop.previewRestart.noTask'))
      }

      beginPreviewServerRestart(taskId, url)

      return taskId
    },
    [currentCwd, requestGateway]
  )

  const handleDesktopGatewayEvent = useCallback<EventHandler>(
    event => {
      baseHandleGatewayEvent(event)

      if (event.type === 'preview.open') {
        // Agent-driven open in response to an explicit user request ("show
        // cnn.com in the preview pane"). Honor it for any session that's ON
        // SCREEN — the primary chat or an open tile — not only the focused
        // one: the turn's window routing already scoped the event to this
        // window, and gating on focus made the open silently vanish whenever
        // the user's click had moved focus to a different zone by the time
        // the tool ran (an "open reddit" they explicitly asked for). A
        // session that is NOT visible anywhere still can't yank the pane
        // open (offer, don't hijack). Routes through the same normalizer as
        // the file browser so URLs, localhost, and file paths all resolve.
        //
        // The tab belongs to the conversation that asked. When that isn't the
        // one the area follows (a tile's turn while the user works in main), it
        // waits in that conversation instead of taking over the area.
        const { url, label } = asRecord(event.payload)
        const target = typeof url === 'string' ? url.trim() : ''
        const owner = previewOwnerForRuntime(event.session_id)

        if (target && (!event.session_id || sessionIsOnScreen(event.session_id))) {
          void normalizeOrLocalPreviewTarget(target, $currentCwd.get() || currentCwd || undefined).then(
            async resolved => {
              if (!resolved) {
                return
              }

              const trimmedLabel = typeof label === 'string' ? label.trim() : ''
              // The agent's loopback is the GATEWAY's loopback. Give the pane a
              // URL this machine can load, keeping the original as the label so
              // the user still sees the address the agent named.
              const url = resolved.kind === 'url' ? await reachablePreviewUrl(resolved.url) : resolved.url
              const reached = url === resolved.url ? resolved : { ...resolved, label: resolved.label || target, url }

              openPreview(trimmedLabel ? { ...reached, label: trimmedLabel } : reached, 'tool-result', owner)
            }
          )
        }

        return
      }

      if (event.type === 'preview.close') {
        // Agent-driven close via close_preview. Same on-screen gate as open:
        // a session the user can see may tidy the pane it opened; a hidden
        // background turn must not dismiss the user's preview. It closes the
        // asking conversation's tabs, never another conversation's.
        const { url } = asRecord(event.payload)
        const target = typeof url === 'string' ? url.trim() : ''
        const owner = previewOwnerForRuntime(event.session_id)

        if (event.session_id && !sessionIsOnScreen(event.session_id)) {
          return
        }

        if (!target) {
          closeRightRail(owner)

          return
        }

        if (closePreviewMatchingIn(owner, target)) {
          return
        }

        void normalizeOrLocalPreviewTarget(target, $currentCwd.get() || currentCwd || undefined).then(
          async resolved => {
            const candidates = [target]

            if (resolved) {
              candidates.push(resolved.source, resolved.url)

              if (resolved.kind === 'url') {
                candidates.push(await reachablePreviewUrl(resolved.url))
              }
            }

            closePreviewMatchingIn(owner, ...candidates)
          }
        )

        return
      }

      if (event.type === 'preview.restart.complete') {
        const { task_id, text } = asRecord(event.payload)

        if (typeof task_id === 'string' && task_id) {
          completePreviewServerRestart(task_id, typeof text === 'string' ? text : '')
        }
      } else if (event.type === 'preview.restart.progress') {
        const { task_id, text } = asRecord(event.payload)

        if (typeof task_id === 'string' && task_id) {
          progressPreviewServerRestart(task_id, typeof text === 'string' ? text : '')
        }
      }

      if (event.session_id && event.session_id !== $focusedRuntimeId.get()) {
        return
      }

      // Only refresh an already-open live preview when a file changes; never
      // open one unprompted. (Preview links are surfaced from the tool row into
      // the status stack — see tool-fallback.tsx.)
      if ($previewTabs.get().some(tab => tab.target.kind === 'url') && gatewayEventCompletedFileDiff(event)) {
        requestPreviewReload()
      }
    },
    [baseHandleGatewayEvent, currentCwd]
  )

  return { handleDesktopGatewayEvent, restartPreviewServer }
}
