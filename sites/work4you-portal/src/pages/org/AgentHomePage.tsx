import { Link, useParams } from 'react-router-dom'
import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'
import { CLOUD_PERSISTENCE_TAGLINE } from '../../lib/portal-cloud-lifecycle'
import styles from './AgentHomePage.module.css'

/** Vite fork — live agent state comes from NAS `/api/agents` on production Portal. */
export function AgentHomePage() {
  const { orgId = '' } = useParams()
  const cloudPath = `/orgs/${orgId}/agents`
  const billingPath = `/orgs/${orgId}/billing`
  const localPath = `/orgs/${orgId}/local-dashboards`

  return (
    <OrgPage
      eyebrow="Work4You Agent"
      title="Agente"
      lead="Fale com o agente na Cloud (casa persistente), no CLI ou num dashboard local — a conta Portal é o mesmo login."
    >
      <p className={pageStyles.policyCallout}>{CLOUD_PERSISTENCE_TAGLINE}</p>

      <section className={styles.hero} aria-labelledby="agent-cta-heading">
        <h2 id="agent-cta-heading" className={styles.heroTitle}>
          Abrir o chat na Cloud
        </h2>
        <p className={styles.heroLead}>
          No Portal em produção, esta página liga à instância Fly e mostra{' '}
          <strong>Abrir chat</strong> quando a máquina está online. Aqui no fork Vite,
          use Instância Cloud (stub) ou o NAS deploy.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primary} to={cloudPath}>
            Ir para Instância Cloud
          </Link>
          <Link className={styles.secondary} to={localPath}>
            Dashboards locais
          </Link>
        </div>

        <p className={styles.meta}>
          Sem plano pago? <Link to={billingPath}>Ver planos</Link>.
        </p>
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
