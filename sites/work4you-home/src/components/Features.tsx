import { Fig } from './Fig'
import styles from './Features.module.css'

/** Ficha técnica: cada linha é uma capacidade e a especificação que a sustenta. */
const SPECS = [
  {
    n: '01',
    title: 'Conecta onde você fala',
    body: 'Um agente, uma memória, todas as superfícies.',
    spec: 'WhatsApp · Telegram · Slack · Discord · e-mail · CLI',
  },
  {
    n: '02',
    title: 'Lembra de verdade',
    body: 'Aprende seus projetos, gera skills e não esquece como resolveu o problema da última vez.',
    spec: 'Memória entre sessões · skills',
  },
  {
    n: '03',
    title: 'Automatiza com foco',
    body: 'Agendamentos em linguagem natural para relatórios, backups e briefings.',
    spec: 'Cron · gateway',
  },
  {
    n: '04',
    title: 'Delega em paralelo',
    body: 'Subagentes isolados com conversa, terminal e scripts próprios, sem inflar o contexto.',
    spec: 'Subagentes · execução em lote',
  },
  {
    n: '05',
    title: 'Pesquisa e navega',
    body: 'Busca na web, navegador, visão, imagem, voz e raciocínio multi-modelo.',
    spec: 'Web · browser · visão · TTS',
  },
  {
    n: '06',
    title: 'Roda em sandbox',
    body: 'Executa com isolamento, na sua máquina ou na nuvem.',
    spec: 'Local · Docker · SSH · cloud',
  },
] as const

export function Features() {
  return (
    <section aria-labelledby="features-title" className={styles.section} id="features">
      <div className="shell">
        <Fig label="Ficha técnica" number="07" tag={`${SPECS.length} capacidades`} />
        <h2 className={styles.title} id="features-title">
          O mesmo agente, em todo lugar.
        </h2>
        <dl className={styles.sheet}>
          {SPECS.map((item) => (
            <div className={styles.row} key={item.n}>
              <span aria-hidden="true" className={styles.n}>
                {item.n}
              </span>
              <dt className={styles.name}>{item.title}</dt>
              <dd className={styles.body}>{item.body}</dd>
              <dd className={`mono-label ${styles.spec}`}>{item.spec}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
