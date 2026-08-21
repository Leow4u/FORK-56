import { OrgPage } from '../../components/OrgPage'
import pageStyles from '../../components/OrgPage.module.css'

export function AgentHomePage() {
  return (
    <OrgPage
      eyebrow="Work4You Agent"
      title="O seu espaço na Work4You"
      lead="Conta autenticada. Daqui gere créditos, chaves, uso e a sua instância Cloud."
    >
      <section className={pageStyles.panel}>
        <h2 className={pageStyles.panelTitle}>Próximo passo</h2>
        <p className={pageStyles.panelText}>
          Abra Work4You Cloud para ver ou criar a sua instância. O chat do
          dashboard fica em <code>/chat</code> na VM, depois de provisionada.
        </p>
      </section>
    </OrgPage>
  )
}
