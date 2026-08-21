import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'
import styles from './AgentHomePage.module.css'

/**
 * Espelho do Hermes Agent (Nous): produto + tabela de logins OAuth.
 * Linhas vêm do NAS quando ligado.
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

export function AgentHomePage() {
  return (
    <div className={styles.wrap}>
      <OrgPage eyebrow="Work4You Agent" title="Work4You Agent">
        <div className={styles.intro}>
          <a
            className={styles.visit}
            href="https://work4you.ai/"
            target="_blank"
            rel="noreferrer"
          >
            Visitar Work4You Agent →
          </a>
        </div>

        <section className={pageStyles.panel} aria-labelledby="sessions-heading">
          <h2 id="sessions-heading" className={styles.sessionsTitle}>
            Sessões
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
                {SESSIONS.map((row) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </OrgPage>
    </div>
  )
}
