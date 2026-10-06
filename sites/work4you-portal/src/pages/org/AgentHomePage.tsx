import { OrgPage } from '../../components/OrgPage'
import { OpenCloudChatButton } from '../../components/OpenCloudChatButton'
import styles from './AgentHomePage.module.css'

/** Vite fork — live chat uses NAS `/api/agents` on production Portal. */
export function AgentHomePage() {
  return (
    <OrgPage eyebrow="Work4You" title="Agente">
      <div className={styles.center}>
        <OpenCloudChatButton
          chatUrl={null}
          allowed={false}
          wakeOnOpen={false}
        />
        <p className={styles.hint}>Ligue ao NAS para abrir o chat da Cloud.</p>
      </div>
    </OrgPage>
  )
}
