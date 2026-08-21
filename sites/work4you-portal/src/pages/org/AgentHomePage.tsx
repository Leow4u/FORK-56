import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'
import styles from './AgentHomePage.module.css'

/**
 * Fork mirror of Nous Portal «Hermes Agent» (`/orgs/:orgId/hermes-agent`):
 * product blurb + OAuth login Sessions table (not chat history).
 *
 * Rows come from NAS when wired; until then the chrome matches the source
 * UI with an empty state. Sign out / Remote Spending act on NAS sessionId.
 */
export interface OAuthLoginSession {
  id: string
  /** OAuth client_id — e.g. `work4you-cli`, `agent:{id}`. */
  app: string
  createdLabel: string
  lastActiveLabel: string
  expiresLabel: string
  /** NAS Remote Spending grant for this terminal. */
  remoteSpending: 'granted' | 'not_granted'
}

/** Empty until work4you-account-service lists OAuth sessions for the org. */
const SESSIONS: OAuthLoginSession[] = []

export function AgentHomePage() {
  return (
    <div className={styles.wrap}>
      <OrgPage
        eyebrow="Work4You Agent"
        title="Work4You Agent"
        lead="An intelligent AI assistant by Work4You. Helpful, knowledgeable, and direct — for coding, research, creative work, and more."
      >
        <div className={styles.intro}>
          <a
            className={styles.visit}
            href="https://work4you.ai/"
            target="_blank"
            rel="noreferrer"
          >
            Visit Work4You Agent →
          </a>
        </div>

        <section className={pageStyles.panel} aria-labelledby="sessions-heading">
          <div className={styles.sessionsHead}>
            <h2 id="sessions-heading" className={styles.sessionsTitle}>
              Sessions
            </h2>
            <p className={styles.sessionsLead}>
              Active OAuth sessions for connected apps. Revoking a session will
              sign you out of that app.
            </p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">App</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last active</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Sign out</th>
                  <th scope="col">Remote spending</th>
                </tr>
              </thead>
              <tbody>
                {SESSIONS.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={6}>
                      No active OAuth sessions yet. Logins from the CLI (
                      <code>work4you-cli</code>), Desktop, and registered local
                      dashboards (<code>agent:…</code>) appear here when the
                      account service is connected.
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
                          Sign out
                        </button>
                      </td>
                      <td>
                        <span className={styles.spendBadge}>
                          {row.remoteSpending === 'granted'
                            ? 'Granted'
                            : 'Not granted'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className={styles.footnote}>
            Sign out and Remote Spending are managed by the Portal account
            service (NAS). The CLI already reacts to{' '}
            <code>session_revoked</code> and <code>remote_spending_revoked</code>
            .
          </p>
        </section>
      </OrgPage>
    </div>
  )
}
