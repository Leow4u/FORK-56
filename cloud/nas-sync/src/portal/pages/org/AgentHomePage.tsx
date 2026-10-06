'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'
import {
  CLOUD_PERSISTENCE_TAGLINE,
  canOpenCloudChat,
  cloudAgentStatusDetail,
  cloudAgentStatusHeadline,
  cloudChatWakeHint,
} from '../../lib/portal-cloud-lifecycle'
import styles from './AgentHomePage.module.css'

type AgentRow = {
  id: string
  name: string
  status: string
  dashboardUrl: string | null
}

export function AgentHomePage() {
  const { orgId } = useParams()
  const { getAccessToken, authenticated, ready } = usePrivy()
  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [canUseCloud, setCanUseCloud] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orgQuery = orgId ? `?org=${encodeURIComponent(orgId)}` : ''

  const load = useCallback(async () => {
    if (!authenticated) {
      setAgent(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch(`/api/agents${orgQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setError('Não foi possível carregar a instância Cloud.')
        setAgent(null)
        setCanUseCloud(false)
        return
      }
      const data = (await res.json()) as {
        agents?: AgentRow[]
        entitlement?: { canUseCloud?: boolean }
      }
      const rows = Array.isArray(data.agents) ? data.agents : []
      setAgent(rows[0] ?? null)
      setCanUseCloud(data.entitlement?.canUseCloud === true)
    } catch {
      setError('Não foi possível contactar o Portal.')
      setAgent(null)
      setCanUseCloud(false)
    } finally {
      setLoading(false)
    }
  }, [authenticated, getAccessToken, orgQuery])

  useEffect(() => {
    if (!ready) return
    void load()
  }, [ready, load])

  useEffect(() => {
    if (!agent) return
    const pending = ['provisioning', 'starting', 'updating'].includes(agent.status)
    if (!pending) return
    const t = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(t)
  }, [agent, load])

  const chatAccess = canOpenCloudChat({
    dashboardUrl: agent?.dashboardUrl,
    status: agent?.status ?? '',
    canUseCloud,
  })
  const wakeHint = cloudChatWakeHint(chatAccess.wakeOnOpen)

  const cloudPath = orgId ? `/orgs/${orgId}/agents` : '/agents'
  const billingPath = orgId ? `/orgs/${orgId}/billing` : '/billing'
  const localPath = orgId ? `/orgs/${orgId}/local-dashboards` : '/local-dashboards'

  const status = agent?.status ?? (canUseCloud ? 'provisioning' : 'none')

  return (
    <OrgPage
      eyebrow="Work4You Agent"
      title="Agente"
      lead="Fale com o agente na Cloud (casa persistente), no CLI ou num dashboard local — a conta Portal é o mesmo login."
    >
      <p className={pageStyles.policyCallout}>{CLOUD_PERSISTENCE_TAGLINE}</p>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <section className={styles.hero} aria-labelledby="agent-cta-heading">
        <h2 id="agent-cta-heading" className={styles.heroTitle}>
          {loading ? 'A carregar…' : cloudAgentStatusHeadline(status)}
        </h2>
        <p className={styles.heroLead}>
          {loading
            ? 'A verificar a instância Cloud desta conta.'
            : cloudAgentStatusDetail(status, canUseCloud)}
        </p>

        <div className={styles.actions}>
          {chatAccess.allowed && chatAccess.chatUrl ? (
            <a
              className={styles.primary}
              href={chatAccess.chatUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir chat
            </a>
          ) : (
            <button type="button" className={styles.primary} disabled>
              Abrir chat
            </button>
          )}
          <Link className={styles.secondary} to={cloudPath}>
            Instância Cloud
          </Link>
        </div>

        {wakeHint ? <p className={styles.meta}>{wakeHint}</p> : null}

        {agent?.name ? (
          <p className={styles.meta}>
            Instância: <strong>{agent.name}</strong>
          </p>
        ) : null}

        {!loading && !canUseCloud && !agent ? (
          <p className={styles.meta}>
            <Link to={billingPath}>Ver planos</Link> para ativar a Cloud incluída no
            Plus, Super e Ultra.
          </p>
        ) : null}
      </section>

      <section className={styles.alt} aria-labelledby="other-surfaces">
        <h2 id="other-surfaces" className={styles.altTitle}>
          Outras formas de correr o agente
        </h2>
        <ul className={styles.altList}>
          <li>
            <code>work4you setup --portal</code> — CLI com login OAuth
          </li>
          <li>
            <Link to={localPath}>Dashboards locais</Link> — agente no seu PC com a mesma
            conta
          </li>
        </ul>
      </section>
    </OrgPage>
  )
}
