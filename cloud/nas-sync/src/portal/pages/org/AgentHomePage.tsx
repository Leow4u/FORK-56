'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OpenCloudChatButton } from '../../components/OpenCloudChatButton'
import { OrgPage } from '../../components/OrgPage'
import {
  canOpenCloudChat,
  cloudAgentStatusDetail,
  cloudAgentStatusHeadline,
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
        setError('Não foi possível carregar o agente.')
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
      setError('Sem ligação ao Portal.')
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

  const status = agent?.status ?? (canUseCloud ? 'provisioning' : 'none')
  const detail = loading ? null : cloudAgentStatusDetail(status)
  const billingPath = orgId ? `/orgs/${orgId}/billing` : '/billing'

  return (
    <OrgPage eyebrow="Work4You" title={loading ? '…' : cloudAgentStatusHeadline(status)}>
      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <div className={styles.center}>
        <OpenCloudChatButton
          chatUrl={chatAccess.chatUrl}
          allowed={!loading && chatAccess.allowed}
          wakeOnOpen={chatAccess.wakeOnOpen}
          agentId={agent?.id}
          orgId={orgId}
          getAccessToken={getAccessToken}
        />
        {detail ? <p className={styles.hint}>{detail}</p> : null}
        {!loading && chatAccess.blockedReason === 'paid_plan_required' ? (
          <Link className={styles.upgrade} to={billingPath}>
            Ver planos
          </Link>
        ) : null}
      </div>
    </OrgPage>
  )
}
