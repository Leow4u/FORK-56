import styles from './FinalCta.module.css'

export function FinalCta() {
  return (
    <section className={styles.section}>
      <div className={`shell ${styles.panel}`}>
        <p className="eyebrow">Sign in. Customize. Work.</p>
        <h2 className="section-title">Ready when you are.</h2>
        <p className={styles.lead}>
          The same agent on desktop, browser, and channels — with included usage
          and on-demand in Account.
        </p>
        <a className={styles.button} href="https://portal.work4you.ai">
          Começar agora →
        </a>
      </div>
    </section>
  )
}
