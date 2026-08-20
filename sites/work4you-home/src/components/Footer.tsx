import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.inner}`}>
        <p className={styles.brand}>Work4You</p>
        <nav className={styles.links} aria-label="Footer">
          <a href="https://work4you.ai/docs/">Docs</a>
          <a href="#install">Install</a>
          <a href="https://github.com/Leow4u/FORK-56">GitHub</a>
        </nav>
        <p className={styles.copy}>© {new Date().getFullYear()} Work4You · MIT</p>
      </div>
    </footer>
  )
}
