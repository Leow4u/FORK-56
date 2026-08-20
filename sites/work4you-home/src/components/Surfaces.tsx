import styles from './Surfaces.module.css'

const surfaces = [
  {
    title: 'Desktop',
    body: 'From everyday tasks to folders and code — right on your computer.',
    href: '#install',
    cta: 'Download →',
  },
  {
    title: 'CLI',
    body: 'Run the agent in any terminal, script, or editor.',
    href: '#install',
    cta: 'Install →',
  },
  {
    title: 'WhatsApp & channels',
    body: 'Ask on WhatsApp — the agent reads Gmail, runs tools, and replies in structure.',
    href: 'https://work4you.ai/docs/user-guide/messaging/',
    cta: 'See messaging →',
  },
  {
    title: 'Web & mobile',
    body: 'Delegate and follow along from the cloud — in the browser or on your phone.',
    href: 'https://portal.work4you.ai',
    cta: 'Open portal →',
  },
]

export function Surfaces() {
  return (
    <section className={styles.section} id="surfaces">
      <div className="shell">
        <p className="eyebrow">Wherever you work</p>
        <h2 className="section-title">The same agent, on every platform.</h2>
        <p className="section-lead">
          Desktop, CLI, messaging, and cloud — one account, one memory, every surface.
        </p>
        <div className={styles.grid}>
          {surfaces.map((surface) => (
            <a key={surface.title} className={styles.card} href={surface.href}>
              <h3>{surface.title}</h3>
              <p>{surface.body}</p>
              <span>{surface.cta}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
