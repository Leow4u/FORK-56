import { FeatureBand } from './FeatureBand'
import { Panel } from './Panel'
import styles from './Bots.module.css'

/** Conversa de exemplo do group chat de bots (dados fictícios, espelhando o app). */
const THREAD = [
  {
    who: 'Você',
    initials: 'VC',
    tone: 'person',
    text: 'Olá! Preciso de ajuda pra criar a campanha de marketing do produto novo.',
  },
  {
    who: 'Análise de Resultados',
    initials: 'AR',
    tone: 'a',
    text: 'Cuido da mensuração: KPIs, metas, funil, atribuição e testes A/B. @ana, me passa canais, orçamento e período.',
  },
  {
    who: 'Geração de Leads',
    initials: 'GL',
    tone: 'b',
    text: 'Assumo a captação: oferta, isca, critérios de qualificação e a landing page com formulário.',
  },
  {
    who: 'Pesquisa de Mercado',
    initials: 'PM',
    tone: 'c',
    text: 'Mapeio público, concorrentes e tendências e devolvo um diagnóstico com as oportunidades de posicionamento.',
  },
  {
    who: 'Mídias Sociais',
    initials: 'MS',
    tone: 'd',
    text: 'Transformo o posicionamento em conceito criativo, calendário de posts e roteiros para cada canal.',
  },
] as const

export function Bots() {
  return (
    <FeatureBand
      fig={{ label: 'Times de IA', number: '03', tag: '4 bots no mesmo chat' }}
      id="bots"
      title="Delegue trabalho a colegas de equipe de IA."
      visual={
        <Panel
          footer={
            <>
              <span>Cada bot assumiu uma frente</span>
              <span className={styles.typing}>Ana está digitando…</span>
            </>
          }
          meta="Time Marketing"
          tone="ink"
          title="#campanha-lançamento"
        >
          <ol className={styles.thread}>
            {THREAD.map((message, index) => (
              <li className={styles.message} key={message.who} style={{ animationDelay: `${index * 0.12}s` }}>
                <span aria-hidden="true" className={`${styles.avatar} ${styles[message.tone]}`}>
                  {message.initials}
                </span>
                <div>
                  <p className={styles.who}>
                    {message.who}
                    {message.tone === 'person' ? null : <span className={styles.badge}>bot</span>}
                  </p>
                  <p className={styles.text}>{message.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      }
    >
      <p>Os bots acessam suas ferramentas, usam como você e voltam com o trabalho concluído.</p>
      <p>Crie times de IA que trabalham pra você. Tomam decisões. Perguntam quando precisam perguntar.</p>
    </FeatureBand>
  )
}
