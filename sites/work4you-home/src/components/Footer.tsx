import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.inner}`}>
        <div>
          <strong>Work4You</strong>
          <p>An AI agent that grows with you.</p>
        </div>
        <div className={styles.links}>
          <a href="https://work4you.ai/docs/">Docs</a>
          <a href="https://github.com/Leow4u/FORK-56">GitHub</a>
        </div>
        <p className={styles.copy}>© {new Date().getFullYear()} Work4You</p>
      </div>
    </footer>
  )
}
