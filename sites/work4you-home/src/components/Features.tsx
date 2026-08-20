import styles from './Features.module.css'

const features = [
  {
    n: '01',
    title: 'Conecta onde você fala',
    body: 'WhatsApp, Telegram, Slack, Discord, e-mail, CLI — um agente, uma memória, todas as superfícies.',
  },
  {
    n: '02',
    title: 'Lembra de verdade',
    body: 'Aprende seus projetos, gera skills e não esquece como resolveu o problema da última vez.',
  },
  {
    n: '03',
    title: 'Automatiza com foco',
    body: 'Agendamentos em linguagem natural para relatórios, backups e briefings — via gateway.',
  },
  {
    n: '04',
    title: 'Delega em paralelo',
    body: 'Subagentes isolados com conversa, terminal e scripts próprios, sem inflar o contexto.',
  },
  {
    n: '05',
    title: 'Pesquisa e navega',
    body: 'Busca na web, browser, visão, imagem, TTS e raciocínio multi-modelo.',
  },
  {
    n: '06',
    title: 'Roda em sandbox',
    body: 'Backends local, Docker, SSH e cloud — com isolamento para executar com segurança.',
  },
]

export function Features() {
  return (
    <section className={styles.section} id="features">
      <div className="shell">
        <p className="mono-label">O que ele faz</p>
        <h2 className={styles.title}>O mesmo agente, em todo lugar.</h2>
        <div className={styles.grid}>
          {features.map((feature) => (
            <article key={feature.n} className={styles.card}>
              <span className={styles.n}>{feature.n}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
