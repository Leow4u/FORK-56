'use client'

import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'
import styles from './AgentSessionsPage.module.css'

/**
 * OAuth client sessions (CLI, Fly agent, local dashboards).
 * Data is loaded from NAS when wired; table mirrors production Portal.
 */
export interface OAuthLoginSession {
  id: string
  app: string
  createdLabel: string
  lastActiveLabel: string
  expiresLabel: string
  remoteSpending: 'granted' | 'not_granted'
}

const SESSIONS: OAuthLoginSession[] = []

export function AgentSessionsPage() {
  return (
    <div className={styles.wrap}>
      <OrgPage
        eyebrow="Conta"
        title="Sessões OAuth"
        lead="Apps autorizados com a sua conta Portal — CLI, agente Cloud e dashboards locais."
      >
        <section className={pageStyles.panel} aria-labelledby="sessions-heading">
          <h2 id="sessions-heading" className={styles.sessionsTitle}>
            Sessões ativas
          </h2>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">App</th>
                  <th scope="col">Criado</th>
                  <th scope="col">Última atividade</th>
                  <th scope="col">Expira</th>
                  <th scope="col">Sair</th>
                  <th scope="col">Gasto remoto</th>
                </tr>
              </thead>
              <tbody>
                {SESSIONS.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyRow}>
                      Nenhuma sessão listada — ligue o NAS para carregar dados ao vivo.
                    </td>
                  </tr>
                ) : (
                  SESSIONS.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.appCell}>{row.app}</td>
                      <td className={styles.muted}>{row.createdLabel}</td>
                      <td className={styles.muted}>{row.lastActiveLabel}</td>
                      <td className={styles.muted}>{row.expiresLabel}</td>
                      <td>
                        <button type="button" className={styles.signOut} disabled>
                          Sair
                        </button>
                      </td>
                      <td>
                        <span className={styles.spendBadge}>
                          {row.remoteSpending === 'granted'
                            ? 'Concedido'
                            : 'Não concedido'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </OrgPage>
    </div>
  )
}
