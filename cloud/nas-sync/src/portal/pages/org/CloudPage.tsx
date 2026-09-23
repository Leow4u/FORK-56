'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrgPage } from '../../components/OrgPage'
import { requestSubscriptionCloud } from '../../lib/ensure-subscription-cloud'
import styles from './CloudPage.module.css'

type AgentRow = {
  id: string
  name: string
  status: string
  dashboardUrl: string | null
  dashboardGatewayState: string
  size: string
  model: string | null
  slug: string
  maxSessions: number
  memoryMb: number
  cpus: number
  diskGb: number
  priceRunningUsd: string
  priceStoppedUsd: string
  errorMessage: string | null
  createdAt: string
  pinnedImage?: string
  runningImage?: string | null
  updateAvailable?: boolean
}

const SIZE_LABELS: Record<string, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
}

function sizeLabel(size: string): string {
  return SIZE_LABELS[size.toLowerCase()] || size
}

function formatMemory(mb: number): string {
  if (mb >= 1024 && mb % 1024 === 0) return `${mb / 1024} GB`
  return `${mb} MB`
}

function statusLabel(status: string): string {
  switch (status) {
    case 'provisioning':
      return 'A provisionar'
    case 'starting':
      return 'A iniciar'
    case 'updating':
      return 'A atualizar'
    case 'online':
      return 'Online'
    case 'stopped':
      return 'Parado'
    case 'error':
      return 'Erro'
    case 'deleting':
      return 'A apagar'
    default:
      return status
  }
}

function gatewayHint(state: string, status: string): string | null {
  if (status !== 'online') return null
  switch (state) {
    case 'active':
      return null
    case 'degraded':
      return 'Gateway com lentidão'
    case 'down':
      return 'Gateway indisponível'
    default:
      return 'A verificar gateway'
  }
}

function statusTone(status: string): string {
  if (status === 'online') return styles.toneOnline
  if (
    status === 'starting' ||
    status === 'provisioning' ||
    status === 'updating'
  ) {
    return styles.toneWarm
  }
  if (status === 'error') return styles.toneError
  return styles.toneMuted
}

function actionErrorLabel(action: 'start' | 'stop' | 'update'): string {
  if (action === 'start') return 'Não foi possível iniciar a instância.'
  if (action === 'stop') return 'Não foi possível parar a instância.'
  return 'Não foi possível atualizar a instância (histórico preservado).'
}

const TRANSIENT_STATUSES = [
  'provisioning',
  'starting',
  'updating',
  'deleting',
] as const

export function CloudPage() {
  const { orgId } = useParams()
  const { getAccessToken, authenticated, ready } = usePrivy()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canUseCloud, setCanUseCloud] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [ensureSettled, setEnsureSettled] = useState(false)
  const cloudEnsureOrg = useRef<string | null>(null)
  const ensureAttemptAt = useRef(0)

  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const authHeaders = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return null
    return { Authorization: `Bearer ${token}` }
  }, [getAccessToken])

  const orgQuery = orgId ? `?org=${encodeURIComponent(orgId)}` : ''

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!authenticated) {
      setAgents([])
      setLoading(false)
      return
    }
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const headers = await authHeaders()
      if (!headers) return
      const res = await fetch(`/api/agents${orgQuery}`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (!opts?.silent) {
          setError(
            typeof body?.message === 'string'
              ? body.message
              : 'Não foi possível carregar as instâncias.',
          )
          setAgents([])
          setCanUseCloud(false)
        }
        return
      }
      const data = (await res.json()) as {
        agents?: AgentRow[]
        entitlement?: { canUseCloud?: boolean }
      }
      setAgents(Array.isArray(data.agents) ? data.agents : [])
      setCanUseCloud(data.entitlement?.canUseCloud === true)
    } catch {
      if (!opts?.silent) {
        setError('Não foi possível contactar o Portal.')
        setAgents([])
        setCanUseCloud(false)
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [authenticated, authHeaders, orgQuery])

  useEffect(() => {
    if (!ready) return
    void load()
  }, [ready, load])

  useEffect(() => {
    if (!ready || loading || !authenticated || !canUseCloud || agents.length > 0) {
      return
    }
    const slot = orgId ?? ''
    if (cloudEnsureOrg.current === slot) return
    cloudEnsureOrg.current = slot
    void (async () => {
      const headers = await authHeaders()
      if (!headers) {
        setEnsureSettled(true)
        return
      }
      setPreparing(true)
      setError(null)
      try {
        const result = await requestSubscriptionCloud({
          headers,
          org: orgId,
          checkoutReturn: false,
        })
        await load({ silent: true })
        if (!result.ensured) {
          setError(
            'A instância do plano ainda não ficou pronta. Atualize a página dentro de momentos.',
          )
        }
      } finally {
        setPreparing(false)
        setEnsureSettled(true)
      }
    })()
  }, [
    ready,
    loading,
    authenticated,
    canUseCloud,
    agents.length,
    orgId,
    authHeaders,
    load,
  ])

  const unbornKey = agents
    .filter(
      (agent) =>
        agent.status === 'provisioning' ||
        agent.status === 'error' ||
        agent.status === 'starting',
    )
    .map((agent) => `${agent.id}:${agent.status}`)
    .join(',')

  // A row can exist before Fly finishes. Polling GET does not resume it.
  // POST /api/cloud/ensure is cheap while the row is still in-flight, and
  // finishes the same row once that request is stale or has recorded an error.
  useEffect(() => {
    if (!ready || !authenticated || !canUseCloud || !unbornKey) return
    let cancelled = false
    const attempt = () => {
      if (cancelled) return
      if (Date.now() - ensureAttemptAt.current < 65_000) return
      ensureAttemptAt.current = Date.now()
      void (async () => {
        const headers = await authHeaders()
        if (!headers || cancelled) return
        await requestSubscriptionCloud({
          headers,
          org: orgId,
          checkoutReturn: false,
        })
        if (!cancelled) await load({ silent: true })
      })()
    }
    attempt()
    const timer = window.setInterval(attempt, 65_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ready, authenticated, canUseCloud, unbornKey, orgId, authHeaders, load])

  useEffect(() => {
    const pending =
      preparing ||
      (canUseCloud && agents.length === 0 && !ensureSettled) ||
      agents.some((a) =>
        (TRANSIENT_STATUSES as readonly string[]).includes(a.status),
      )
    if (!pending) return
    const t = setInterval(() => void load({ silent: true }), 4000)
    return () => clearInterval(t)
  }, [agents, preparing, canUseCloud, ensureSettled, load])

  // Online instances do not hit the 4s pending poll. Without a refresh, a tab
  // left open while the Portal pin moves never shows Atualizar.
  useEffect(() => {
    if (!authenticated || !ready) return
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return
      void load({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load({ silent: true })
    }, 30_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(t)
    }
  }, [authenticated, ready, load])

  const runAction = async (
    id: string,
    action: 'start' | 'stop' | 'update',
  ) => {
    setBusyId(id)
    setError(null)
    try {
      const headers = await authHeaders()
      if (!headers) return
      if (action === 'update') {
        if (
          !confirm(
            'Atualizar o runtime desta instância? O histórico (sessões, memória, skills) no disco é preservado.',
          )
        ) {
          return
        }
      }
      const res = await fetch(`/api/agents/${id}/${action}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ org: orgId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(
          typeof body?.message === 'string'
            ? body.message
            : actionErrorLabel(action),
        )
        return
      }
      await load()
    } catch {
      setError('Ação falhou — rede.')
    } finally {
      setBusyId(null)
    }
  }

  const saveRename = async (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    setBusyId(id)
    try {
      const headers = await authHeaders()
      if (!headers) return
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, org: orgId }),
      })
      if (!res.ok) {
        setError('Não foi possível renomear.')
        return
      }
      setRenameId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const instanceCountLabel = loading
    ? 'A carregar…'
    : agents.length === 1
      ? 'A sua instância'
      : `${agents.length} instâncias`

  const billingPath = orgId ? `/orgs/${orgId}/billing` : '/billing'

  return (
    <OrgPage
      eyebrow="Work4You Cloud"
      title="Instâncias"
      lead="A instância Cloud desta organização. Acompanhe o estado e abra o dashboard. Atualizações de runtime aplicam a image nova sem apagar o disco — o histórico permanece."
    >
      {loading || agents.length > 0 ? (
        <section className={styles.toolbar}>
          <p className={styles.sectionLead}>{instanceCountLabel}</p>
        </section>
      ) : null}

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      {!loading && agents.length === 0 && (canUseCloud || !error) ? (
        <section className={styles.empty}>
          {canUseCloud ? (
            <>
              <p className={styles.emptyTitle}>
                {preparing || !ensureSettled
                  ? 'A criar a sua instância'
                  : 'A instância ainda não está pronta'}
              </p>
              <p className={styles.emptyText}>
                {preparing || !ensureSettled
                  ? 'A máquina do plano está a nascer. Esta página atualiza sozinha até ela aparecer.'
                  : 'Quando a máquina do plano ficar disponível, aparece aqui.'}
              </p>
            </>
          ) : (
            <>
              <p className={styles.emptyTitle}>A Cloud vem com o plano</p>
              <p className={styles.emptyText}>
                Plus, Super e Ultra incluem uma instância. No plano Free ainda
                não há máquina.
              </p>
              <Link
                className={`${styles.primary} ${styles.emptyAction}`}
                to={billingPath}
              >
                Ver planos
              </Link>
            </>
          )}
        </section>
      ) : null}

      <div className={styles.grid}>
        {agents.map((agent) => {
          const hint = gatewayHint(agent.dashboardGatewayState, agent.status)
          return (
            <article key={agent.id} className={styles.card}>
              <header className={styles.cardHead}>
                {renameId === agent.id ? (
                  <div className={styles.renameRow}>
                    <input
                      className={styles.input}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRename(agent.id)
                        if (e.key === 'Escape') setRenameId(null)
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => void saveRename(agent.id)}
                    >
                      Guardar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.nameBtn}
                    onClick={() => {
                      setRenameId(agent.id)
                      setRenameValue(agent.name)
                    }}
                    title="Renomear"
                  >
                    {agent.name}
                  </button>
                )}
                <span className={`${styles.badge} ${statusTone(agent.status)}`}>
                  {statusLabel(agent.status)}
                </span>
              </header>

              <p className={styles.cardMeta}>
                <span className={styles.sizeChip}>{sizeLabel(agent.size)}</span>
                {agent.maxSessions} sessões · {formatMemory(agent.memoryMb)} ·{' '}
                {agent.cpus} vCPU · {agent.diskGb} GB disco
              </p>
              {agent.model ? (
                <p className={styles.cardModel}>{agent.model}</p>
              ) : null}
              {agent.updateAvailable ? (
                <p className={styles.cardWarn}>
                  Atualização de runtime disponível — o histórico no disco é
                  preservado.
                </p>
              ) : agent.runningImage ? (
                <p className={styles.cardMeta}>Runtime em dia.</p>
              ) : null}
              {hint ? <p className={styles.cardWarn}>{hint}</p> : null}
              {agent.errorMessage ? (
                <p className={styles.cardError}>{agent.errorMessage}</p>
              ) : null}

              <div className={styles.cardActions}>
                {agent.dashboardUrl ? (
                  <a
                    className={styles.primary}
                    href={
                      agent.dashboardUrl.replace(/\/$/, '') + '/chat'
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir dashboard
                  </a>
                ) : (
                  <button type="button" className={styles.primary} disabled>
                    Abrir dashboard
                  </button>
                )}
                {agent.status === 'stopped' ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={busyId === agent.id}
                    onClick={() => void runAction(agent.id, 'start')}
                  >
                    Iniciar
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={
                      busyId === agent.id ||
                      (TRANSIENT_STATUSES as readonly string[]).includes(
                        agent.status,
                      )
                    }
                    onClick={() => void runAction(agent.id, 'stop')}
                  >
                    Parar
                  </button>
                )}
                {agent.updateAvailable ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={
                      busyId === agent.id ||
                      (TRANSIENT_STATUSES as readonly string[]).includes(
                        agent.status,
                      )
                    }
                    onClick={() => void runAction(agent.id, 'update')}
                  >
                    Atualizar
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </OrgPage>
  )
}
