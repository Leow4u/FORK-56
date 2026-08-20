import styles from './Hero.module.css'

const prompts = [
  'Map this repo’s structure…',
  'Fix the failing tests',
  'Refactor the module I point at',
  'Prepare a PR with the last change…',
]

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">work4you.ai — your agent</p>
          <h1 className={styles.title}>
            An AI agent that
            <span> grows with you.</span>
          </h1>
          <p className={styles.lead}>
            One default agent — desktop, terminal, WhatsApp, and cloud. It reads
            context, runs real work, and hands back finished artifacts.
          </p>
          <div className={styles.ctas}>
            <a className={styles.primary} href="#install">
              Download desktop app
            </a>
            <a className={styles.secondary} href="#install">
              Install via terminal
            </a>
          </div>
        </div>

        <div className={styles.stage} aria-hidden="true">
          <div className={styles.panel}>
            <div className={styles.panelTop}>
              <span className={styles.liveDot} />
              <span>live</span>
            </div>
            <p className={styles.panelLabel}>What are we working on?</p>
            <p className={styles.panelHint}>
              Bring the code, the question, or where you’re stuck. I read the
              context before changing anything.
            </p>
            <ul className={styles.prompts}>
              {prompts.map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
            <div className={styles.composer}>
              <span>Ask anything</span>
              <span className={styles.send}>↑</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
