'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrgPage } from '../../components/OrgPage'
import { cloudAgentChatUrl } from '../../lib/cloud-agent-chat'
import styles from './AgentHomePage.module.css'

type AgentRow = {
  id: string
  name: string
  status: string
  dashboardUrl: string | null
}

function statusHeadline(status: string): string {
  switch (status) {
    case 'online':
      return 'Pronto para conversar'
    case 'starting':
    case 'provisioning':
      return 'A preparar a instância'
    case 'updating':
      return 'A atualizar o runtime'
    case 'stopped':
      return 'Instância parada'
    case 'parked':
      return 'Instância em pausa'
    case 'error':
      return 'Algo correu mal'
    default:
      return 'Estado da Cloud'
  }
}

function statusDetail(status: string, canUseCloud: boolean): string {
  switch (status) {
    case 'online':
      return 'A sua casa na nuvem está acordada. O histórico e a memória ficam no disco — abra o chat para continuar.'
    case 'starting':
    case 'provisioning':
      return 'A máquina do plano está a nascer. Esta página atualiza sozinha.'
    case 'updating':
      return 'Nova imagem de runtime — o disco e o histórico são preservados.'
    case 'stopped':
      return canUseCloud
        ? 'Inicie a instância na página Cloud ou abra o chat para acordar automaticamente.'
        : 'No plano Free a instância fica parada; o disco é guardado.'
    case 'parked':
      return canUseCloud
        ? 'A instância volta com o plano pago. Abra o chat ou inicie na Cloud.'
        : 'No plano Free a instância fica em pausa; o disco é guardado.'
    case 'error':
      return 'Veja detalhes na página Instância Cloud ou contacte suporte.'
    default:
      return 'Gerencie tamanho e energia em Instância Cloud.'
  }
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

  const chatUrl = cloudAgentChatUrl(agent?.dashboardUrl)
  const canOpenChat =
    Boolean(chatUrl) &&
    agent != null &&
    agent.status === 'online' &&
    canUseCloud

  const cloudPath = orgId ? `/orgs/${orgId}/agents` : '/agents'
  const billingPath = orgId ? `/orgs/${orgId}/billing` : '/billing'
  const localPath = orgId ? `/orgs/${orgId}/local-dashboards` : '/local-dashboards'

  const status = agent?.status ?? (canUseCloud ? 'provisioning' : 'none')

  return (
    <OrgPage
      eyebrow="Work4You Agent"
      title="Agente"
      lead="Depois do login, o passo principal é falar com o agente — Cloud, CLI ou dashboard local."
    >
      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <section className={styles.hero} aria-labelledby="agent-cta-heading">
        <h2 id="agent-cta-heading" className={styles.heroTitle}>
          {loading ? 'A carregar…' : statusHeadline(status)}
        </h2>
        <p className={styles.heroLead}>
          {loading
            ? 'A verificar a instância Cloud desta conta.'
            : statusDetail(status, canUseCloud)}
        </p>

        <div className={styles.actions}>
          {canOpenChat && chatUrl ? (
            <a className={styles.primary} href={chatUrl} target="_blank" rel="noreferrer">
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
