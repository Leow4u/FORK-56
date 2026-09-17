import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.brandBlock}>
          <p className={styles.brand}>Work4You</p>
          <p className={styles.tag}>O agente que cresce com você.</p>
        </div>
        <nav className={styles.links} aria-label="Rodapé">
          <a href="https://work4you.ai/docs/">Docs</a>
          <a href="/#install">Instalar</a>
          <a href="/contact/">Contato</a>
          <a href="https://portal.work4you.ai/login">Fazer login</a>
          <a href="https://github.com/Leow4u/FORK-56">GitHub</a>
        </nav>
        <p className={styles.copy}>© {new Date().getFullYear()} Work4You · MIT</p>
      </div>
    </footer>
  )
}
