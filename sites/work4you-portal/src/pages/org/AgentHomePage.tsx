import { Link, useParams } from 'react-router-dom'
import { OpenCloudChatButton } from '../../components/OpenCloudChatButton'
import { OrgPage } from '../../components/OrgPage'
import styles from './AgentHomePage.module.css'

/** Vite fork — production uses NAS entitlement (paid-only cloud chat). */
export function AgentHomePage() {
  const { orgId = '' } = useParams()
  const billingPath = `/orgs/${orgId}/billing`

  return (
    <OrgPage eyebrow="Work4You" title="Agente">
      <div className={styles.center}>
        <OpenCloudChatButton chatUrl={null} allowed={false} wakeOnOpen={false} />
        <Link className={styles.upgrade} to={billingPath}>
          Ver planos
        </Link>
      </div>
    </OrgPage>
  )
}
