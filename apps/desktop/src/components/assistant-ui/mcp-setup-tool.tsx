'use client'

import { type ToolCallMessagePartProps, useAuiState } from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { type DirectoryApp, findComposioDirectoryApp, mcpSetupCardIdentity } from '@work4you/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { McpSetupCard } from '@/components/assistant-ui/mcp-setup-card'
import { ToolFallback } from '@/components/assistant-ui/tool/fallback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { connectWork4YouApp } from '@/lib/composio-connect'
import { triggerHaptic } from '@/lib/haptics'
import { AlertCircle, CheckCircle2, Loader2 } from '@/lib/icons'
import { completeMcpDesktopOAuth, McpOAuthCancelled } from '@/lib/mcp-dashboard-oauth'
import { directoryEntry } from '@/lib/mcp-directory'
import { prettyName } from '@/lib/text'
import { $gateway } from '@/store/gateway'
import { clearMcpSetupRequest, type McpSetupOutcome, sessionMcpSetupRequest } from '@/store/mcp-setup'
import { notifyError } from '@/store/notifications'
import { invalidateMcpSuggestionIndex } from '@/store/suggestion-providers/mcp'
import {
  addMcpServer,
  authMcpServer,
  cancelMcpOAuthFlow,
  getActionStatus,
  getConnectorsDirectory,
  getMcpCatalog,
  getMcpOAuthFlow,
  installMcpCatalogEntry,
  type McpCatalogEntry,
  removeMcpServer,
  setMcpServerEnabled
} from '@/work4you'

import { selectMessageRunning } from './tool/fallback-model'
import { parseMaybeObject } from './tool/fallback-model/format'

type SetupAction = 'authorize' | 'enable' | 'install'

interface SetupArgs {
  server: string
  action: SetupAction
  reason: string
}

const CATALOG_INSTALL_POLL_MS = 1500

// Thrown by the in-flight flow when the user cancels — the declined respond
// has already been sent, so the catch path must swallow this, not report it.
const CANCELLED = Symbol('mcp-setup-cancelled')

function readSetupArgs(args: unknown): SetupArgs {
  const row = parseMaybeObject(args)
  const rawAction = typeof row.action === 'string' ? row.action : 'install'

  return {
    action: rawAction === 'enable' || rawAction === 'authorize' ? rawAction : 'install',
    reason: typeof row.reason === 'string' ? row.reason : '',
    server: typeof row.server === 'string' ? row.server : ''
  }
}

/** The tool's settled JSON — the card's outcome plus the tool-only
 *  `unanswered` status (timeout, no user action). */
type SettledResult = Omit<Partial<McpSetupOutcome>, 'status'> & {
  status?: McpSetupOutcome['status'] | 'unanswered'
  note?: string
}

function readSetupResult(result: unknown): SettledResult {
  return parseMaybeObject(result) as SettledResult
}

// Same platform sniff the approval bar uses for its accelerator hint.
const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)

const STATUS_ICON_CLASS = 'size-4 shrink-0 text-(--ui-text-tertiary)'

function useDirectoryApp(server: string) {
  const [composioApp, setComposioApp] = useState<DirectoryApp | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    void getConnectorsDirectory()
      .then(directory => {
        if (!cancelled) {
          setComposioApp(findComposioDirectoryApp(directory.apps, server) ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComposioApp(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [server])

  return composioApp
}

export const McpSetupTool = (props: ToolCallMessagePartProps) => {
  // Settled → static outcome line (the flow already ran or was declined).
  if (props.result !== undefined) {
    return <McpSetupSettled {...props} />
  }

  return <McpSetupLive {...props} />
}

const McpSetupLive = (props: ToolCallMessagePartProps) => {
  const messageRunning = useAuiState(selectMessageRunning)

  // Stopped mid-prompt with no result — don't leave a dead interactive panel.
  if (!messageRunning) {
    return <ToolFallback {...props} />
  }

  return <McpSetupPending {...props} />
}

function McpSetupSettled({ args, result }: ToolCallMessagePartProps) {
  const { t } = useI18n()
  const copy = t.assistant.mcpSetup
  const fromArgs = useMemo(() => readSetupArgs(args), [args])
  const fromResult = useMemo(() => readSetupResult(result), [result])

  const server = fromResult.server || fromArgs.server
  const status = fromResult.status ?? 'error'
  const composioApp = useDirectoryApp(server)

  const identity = mcpSetupCardIdentity({
    composioApp,
    nativeLogo: Boolean(directoryEntry(server)),
    server
  })

  const displayName = identity.name

  const line =
    status === 'installed'
      ? copy.installed(displayName)
      : status === 'enabled'
        ? copy.enabled(displayName)
        : status === 'authorized'
          ? copy.authorized(displayName)
          : status === 'declined'
            ? copy.declined
            : status === 'unanswered'
              ? copy.unanswered
              : copy.failed(displayName)

  const ok = status === 'installed' || status === 'enabled' || status === 'authorized'
  const neutral = status === 'declined' || status === 'unanswered'
  const toolCount = Array.isArray(fromResult.tools) ? fromResult.tools.length : 0
  const subtitle = ok && toolCount > 0 ? copy.toolCount(toolCount) : !ok && !neutral ? (fromResult.detail ?? '') : ''

  return (
    <McpSetupCard
      label={line}
      logo={identity.logo}
      markName={identity.name}
      muted={neutral}
      statusIcon={
        ok ? (
          <CheckCircle2 aria-hidden className={`${STATUS_ICON_CLASS} text-emerald-400`} />
        ) : neutral ? null : (
          <AlertCircle aria-hidden className={`${STATUS_ICON_CLASS} text-destructive`} />
        )
      }
      subtitle={subtitle}
      title={line}
    />
  )
}

function McpSetupPending({ args }: ToolCallMessagePartProps) {
  const { t } = useI18n()
  const copy = t.assistant.mcpSetup
  // The tool row is in whichever session's transcript rendered it — read THAT
  // session's request (primary or tile), not the globally-active one.
  const sessionId = useStore(useSessionView().$runtimeId)
  const $request = useMemo(() => sessionMcpSetupRequest(sessionId), [sessionId])
  const request = useStore($request)
  const gateway = useStore($gateway)
  const fromArgs = useMemo(() => readSetupArgs(args), [args])

  const server = fromArgs.server || request?.server || ''
  const action: SetupAction = fromArgs.action ?? request?.action ?? 'install'
  const reason = fromArgs.reason || request?.reason || ''

  const [working, setWorking] = useState(false)
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({})
  const [entry, setEntry] = useState<McpCatalogEntry | null | undefined>(undefined)
  const [envOpen, setEnvOpen] = useState(false)
  const composioApp = useDirectoryApp(server)
  // Set when the user cancels mid-flight (a stuck OAuth tab, a hung install).
  // The in-flight flow checks it at every poll boundary and aborts via the
  // CANCELLED sentinel; the declined respond has already been sent by then.
  const cancelRef = useRef(false)

  // Race: tool.start fires a tick before mcp.setup.request — hold the buttons
  // until the gateway request is wired (same spinner rule as clarify).
  const ready = Boolean(request?.requestId)

  const respond = useCallback(
    async (outcome: McpSetupOutcome) => {
      // Another path (cancel racing completion) may have already resolved this
      // request; the store is the single source of truth, so bail if this
      // session's entry is gone — same guard as the approval bar.
      if (!request || sessionMcpSetupRequest(request.sessionId).get()?.requestId !== request.requestId) {
        return
      }

      if (!gateway) {
        notifyError(new Error(copy.gatewayDisconnected), copy.sendFailed)

        return
      }

      // Clear first: the answer is decided, and an in-flight RPC must not
      // leave a live card that can be answered a second time.
      clearMcpSetupRequest(request.requestId, request.sessionId)

      // A successful outcome changed mcp_servers — reload the live session
      // BEFORE unblocking the tool, or the agent resumes being told the
      // server is ready while its tool snapshot still lacks it (the same
      // write-through mcp-tab's silentReload does; consent was the card
      // click, so no confirm prompt). Reload failure isn't outcome failure:
      // the config landed, tools arrive next session — report it and move on.
      if (outcome.status === 'installed' || outcome.status === 'enabled' || outcome.status === 'authorized') {
        try {
          await gateway.request('reload.mcp', { confirm: true, session_id: request.sessionId ?? undefined })
        } catch (error) {
          notifyError(error, copy.reloadFailed)
        }

        // The just-set-up server must stop being suggested immediately.
        invalidateMcpSuggestionIndex()
      }

      try {
        await gateway.request<{ status?: string }>('mcp.setup.respond', {
          request_id: request.requestId,
          result: JSON.stringify(outcome)
        })
        // tool.complete lands next → McpSetupSettled.
      } catch (error) {
        notifyError(error, copy.sendFailed)
      }
    },
    [copy.gatewayDisconnected, copy.reloadFailed, copy.sendFailed, gateway, request]
  )

  const decline = useCallback(() => {
    // While a flow is in flight this is a CANCEL: answer declined right away
    // and let the abandoned work notice via cancelRef at its next poll.
    cancelRef.current = true
    triggerHaptic('cancel')
    void respond({ server, status: 'declined' })
  }, [respond, server])

  const approve = useCallback(async () => {
    cancelRef.current = false
    setWorking(true)

    // Poll-boundary abort for the background-install loop; the OAuth flows
    // carry their own cancel via completeMcpDesktopOAuth's `cancelled`.
    const throwIfCancelled = <T,>(value: T): T => {
      if (cancelRef.current) {
        throw CANCELLED
      }

      return value
    }

    try {
      const directory = await getConnectorsDirectory().catch(() => null)
      const composio = directory ? findComposioDirectoryApp(directory.apps, server) : undefined

      if (composio) {
        if (composio.needs_login) {
          await respond({ detail: copy.loginRequired, server, status: 'error' })

          return
        }

        if (composio.connected) {
          triggerHaptic('submit')
          await respond({ server: composio.id, status: action === 'enable' ? 'enabled' : 'authorized' })

          return
        }

        const ok = await connectWork4YouApp(composio.id, {
          open: url => window.work4youDesktop.openExternal(url)
        })

        if (cancelRef.current) {
          throw CANCELLED
        }

        if (!ok) {
          throw new Error(copy.failed(prettyName(composio.name || server)))
        }

        triggerHaptic('submit')
        await respond({
          server: composio.id,
          status: action === 'enable' ? 'enabled' : action === 'authorize' ? 'authorized' : 'installed'
        })

        return
      }

      if (action === 'enable') {
        await setMcpServerEnabled(server, true)
        triggerHaptic('submit')
        await respond({ server, status: 'enabled' })

        return
      }

      if (action === 'authorize') {
        const flow = await completeMcpDesktopOAuth({
          serverName: server,
          start: authMcpServer,
          status: getMcpOAuthFlow,
          cancelled: () => cancelRef.current,
          cancel: cancelMcpOAuthFlow,
          openExternal: url => window.work4youDesktop.openExternal(url)
        })

        triggerHaptic('submit')
        await respond({ server, status: 'authorized', tools: (flow.tools ?? []).map(tool => tool.name) })

        return
      }

      // Install: prefer the reviewed catalog entry when one exists; otherwise
      // fall back to the desktop suggestion directory (official URL-only
      // remotes), written through the same validated POST the dashboard's add
      // form uses. Required catalog credentials get an inline prompt first
      // (never pre-filled, never echoed back).
      let resolved = entry

      if (resolved === undefined) {
        const catalog = await getMcpCatalog()
        resolved = catalog.entries.find(candidate => candidate.name === server) ?? null
        setEntry(resolved)
      }

      if (!resolved) {
        const known = directoryEntry(server)

        if (!known) {
          await respond({ detail: copy.notInCatalog(server), server, status: 'error' })

          return
        }

        // URL-only remote: add to config, then run the OAuth/probe flow so
        // "Install" lands the user on a working server, not a 401. If the
        // flow dies after the config write (cancel, closed OAuth tab), roll
        // the write back — decline means "no server", not an unauthorized
        // entry squatting in mcp_servers (authoritative-write rule).
        await addMcpServer({ name: known.name, url: known.url })

        let flow

        try {
          flow = await completeMcpDesktopOAuth({
            serverName: known.name,
            start: authMcpServer,
            status: getMcpOAuthFlow,
            cancelled: () => cancelRef.current,
            cancel: cancelMcpOAuthFlow,
            openExternal: url => window.work4youDesktop.openExternal(url)
          })
        } catch (error) {
          await removeMcpServer(known.name).catch(() => {
            // Rollback is best-effort; the primary error/cancel wins.
          })
          throw error
        }

        triggerHaptic('submit')
        await respond({ server, status: 'installed', tools: (flow.tools ?? []).map(tool => tool.name) })

        return
      }

      const required = resolved.required_env.filter(env => env.required)

      if (required.some(env => !envDraft[env.name]?.trim())) {
        // Reveal the credential fields; the user approves again once filled.
        setEnvOpen(true)

        return
      }

      const res = await installMcpCatalogEntry(server, envDraft)

      // Git-backed entries clone in the background — poll to completion so a
      // non-zero exit surfaces as a real failure instead of a false success.
      if (res.background && res.action) {
        for (;;) {
          const status = throwIfCancelled(await getActionStatus(res.action, 1))

          if (!status.running) {
            if (status.exit_code !== 0) {
              throw new Error(copy.failed(server))
            }

            break
          }

          await new Promise(resolve => setTimeout(resolve, CATALOG_INSTALL_POLL_MS))
        }
      }

      triggerHaptic('submit')
      await respond({ server, status: 'installed' })
    } catch (error) {
      // User cancel: the declined respond is already on the wire — the
      // abandoned flow just stops, nothing to report.
      if (error === CANCELLED || error instanceof McpOAuthCancelled) {
        return
      }

      notifyError(error, copy.failed(server))
      await respond({
        detail: error instanceof Error ? error.message : String(error),
        server,
        status: 'error'
      })
    } finally {
      setWorking(false)
    }
  }, [action, copy, entry, envDraft, respond, server])

  const title = composioApp
    ? copy.connectTitle(prettyName(composioApp.name || server))
    : action === 'enable'
      ? copy.enableTitle(prettyName(server))
      : action === 'authorize'
        ? copy.authorizeTitle(prettyName(server))
        : copy.installTitle(prettyName(server))

  const actionLabel = composioApp
    ? copy.connectAction
    : action === 'enable'
      ? copy.enableAction
      : action === 'authorize'
        ? copy.authorizeAction
        : copy.installAction

  // What connecting actually means — the endpoint that will be contacted.
  // VS Code's trust dialog links the config it's about to trust; same idea.
  // Catalog entries carry their transport URL in the API response; the
  // static directory remains a fallback rung for older backends.
  const known = directoryEntry(server)

  const sourceLine = composioApp
    ? copy.work4youAppsSource
    : action === 'install'
      ? (entry?.url ?? known?.url ?? copy.catalogSource)
      : null

  const identity = mcpSetupCardIdentity({
    catalogDescription: known?.description,
    composioApp,
    nativeLogo: Boolean(known || entry),
    reason,
    server,
    sourceLine
  })

  // ⌘/Ctrl+Enter → approve, Esc → decline/cancel. Same accelerators, same
  // guard shape as the approval bar (tool/approval.tsx). Unlike approve, Esc
  // stays live while a flow is in flight — that's the cancel path. Stands
  // down whenever a focusable control has focus (clarify's rule): a keystroke
  // meant for the composer, a popover, or the card's own credential fields
  // must never silently approve an install or throw away typed input.
  useEffect(() => {
    if (!ready) {
      return
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const active = document.activeElement as HTMLElement | null

      if (
        active &&
        (active.isContentEditable || active.matches('a[href], button, input, select, textarea, [role="button"]'))
      ) {
        return
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        if (!working) {
          event.preventDefault()
          void approve()
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        decline()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [approve, decline, ready, working])

  if (!ready) {
    return (
      <McpSetupCard
        header={copy.helpersHeader}
        label={title}
        logo={identity.logo}
        markName={identity.name}
        ready={false}
        subtitle={identity.subtitle}
        title={identity.name}
      />
    )
  }

  return (
    <McpSetupCard
      action={
        <Button className="rounded-full" disabled={working} onClick={() => void approve()} size="sm" variant="outline">
          {working ? <Loader2 className="animate-spin" /> : actionLabel}
          {!working && <span className="text-[0.625rem] text-(--ui-text-tertiary)">{isMac ? '⌘⏎' : 'Ctrl⏎'}</span>}
        </Button>
      }
      decline={
        // Never disabled: while a flow is in flight this is the cancel —
        // a stuck OAuth tab or hung install must always have a way out.
        <Button className="justify-self-start" onClick={decline} size="inline" variant="text">
          {working ? t.common.cancel : copy.decline}
          <span className="text-[0.625rem] opacity-55">Esc</span>
        </Button>
      }
      header={copy.helpersHeader}
      label={title}
      logo={identity.logo}
      markName={identity.name}
      subtitle={identity.subtitle}
      title={identity.name}
    >
      {envOpen && entry && entry.required_env.length > 0 && (
        <div className="grid gap-2" data-slot="mcp-setup-env">
          <p className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.envRequired}</p>
          {entry.required_env.map(env => (
            <label className="grid gap-1" key={env.name}>
              <span className="text-[0.6875rem] text-(--ui-text-secondary)">
                {env.prompt || env.name}
                {env.required ? ' *' : ''}
              </span>
              <Input
                className="h-7 text-xs"
                onChange={event => setEnvDraft(prev => ({ ...prev, [env.name]: event.currentTarget.value }))}
                type="password"
                value={envDraft[env.name] ?? ''}
              />
            </label>
          ))}
        </div>
      )}
    </McpSetupCard>
  )
}
