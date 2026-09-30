import { useState } from 'react'
import { nextShape, WORKBOT_COLORS, type WorkbotShape } from '../lib/workbot'
import { FeatureBand } from './FeatureBand'
import { Panel } from './Panel'
import { WorkBot } from './WorkBot'
import styles from './Bots.module.css'

interface Message {
  bot?: { color: string; shape: WorkbotShape }
  text: string
  who: string
}

/** Conversa de exemplo do group chat de bots (dados fictícios, espelhando o app). */
const THREAD: readonly Message[] = [
  { who: 'Você', text: 'Olá! Preciso de ajuda pra criar a campanha de marketing do produto novo.' },
  {
    who: 'Análise de Resultados',
    bot: { color: WORKBOT_COLORS.blue, shape: 'blob' },
    text: 'Cuido da mensuração: KPIs, metas, funil, atribuição e testes A/B. @ana, me passa canais, orçamento e período.',
  },
  {
    who: 'Geração de Leads',
    bot: { color: WORKBOT_COLORS.orange, shape: 'squircle' },
    text: 'Assumo a captação: oferta, isca, critérios de qualificação e a landing page com formulário.',
  },
  {
    who: 'Pesquisa de Mercado',
    bot: { color: WORKBOT_COLORS.teal, shape: 'hexagon' },
    text: 'Mapeio público, concorrentes e tendências e devolvo um diagnóstico com as oportunidades de posicionamento.',
  },
  {
    who: 'Mídias Sociais',
    bot: { color: WORKBOT_COLORS.violet, shape: 'drop' },
    text: 'Transformo o posicionamento em conceito criativo, calendário de posts e roteiros para cada canal.',
  },
]

/** Um bot da conversa: olha o cursor, trabalha quando você passa por cima, troca de forma no clique. */
function BotAvatar({ bot, busy, who }: { bot: NonNullable<Message['bot']>; busy: boolean; who: string }) {
  const [shape, setShape] = useState<WorkbotShape>(bot.shape)
  const [hops, setHops] = useState(0)

  return (
    <button
      aria-label={`Trocar a forma de ${who}`}
      className={styles.bot}
      data-hop={hops > 0 ? hops % 2 : undefined}
      onClick={() => {
        setShape(nextShape)
        setHops((count) => count + 1)
      }}
      type="button"
    >
      <WorkBot color={bot.color} mood={busy ? 'work' : 'idle'} shape={shape} size={34} />
    </button>
  )
}

function YouAvatar() {
  return (
    <span aria-hidden="true" className={styles.you}>
      <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M5 20c1.2-3.6 3.9-5.4 7-5.4s5.8 1.8 7 5.4" />
      </svg>
    </span>
  )
}

export function Bots() {
  const [busy, setBusy] = useState<string | null>(null)

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
              <span className={styles.typing}>Clique num bot para trocar a forma</span>
            </>
          }
          meta="Time Marketing"
          tone="ink"
          title="#campanha-lançamento"
        >
          <ol className={styles.thread}>
            {THREAD.map((message, index) => (
              <li
                className={styles.message}
                key={message.who}
                onBlur={() => setBusy(null)}
                onFocus={() => setBusy(message.who)}
                onPointerEnter={() => setBusy(message.who)}
                onPointerLeave={() => setBusy(null)}
                style={{ animationDelay: `${index * 0.12}s` }}
              >
                {message.bot ? (
                  <BotAvatar bot={message.bot} busy={busy === message.who} who={message.who} />
                ) : (
                  <YouAvatar />
                )}
                <div>
                  <p className={styles.who}>
                    {message.who}
                    {message.bot ? <span className={styles.badge}>bot</span> : null}
                    {message.bot && busy === message.who ? <span className={styles.working}>trabalhando…</span> : null}
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
