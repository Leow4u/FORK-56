import styles from './Nav.module.css'

const LOGIN = 'https://portal.work4you.ai/login'

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

        <a className={styles.login} href={LOGIN}>
          Fazer login
        </a>
      </div>
    </header>
  )
}
