import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'
import styles from './AgentSessionsPage.module.css'

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
          <p className={styles.emptyRow}>
            Dados ao vivo no NAS — esta tabela preenche quando o Portal aponta para a API
            de sessões.
          </p>
        </section>
      </OrgPage>
    </div>
  )
}
