import styles from './Nav.module.css'

export function Nav() {
  return (
    <header className={styles.header}>
      <div className={`shell ${styles.inner}`}>
        <a className={styles.side} href="https://work4you.ai/docs/">
          Docs
        </a>

        <a className={styles.brand} href="#top" aria-label="Work4You">
          <img
            src="/brand/work4you-logo.png"
            alt="Work4You"
            width={160}
            height={16}
          />
        </a>

        <a className={styles.side} href="#install">
          Install →
        </a>
      </div>
    </header>
  )
}
