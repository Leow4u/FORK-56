import styles from './Nav.module.css'

const links = [
  { href: '#pillars', label: 'Product' },
  { href: '#surfaces', label: 'Platforms' },
  { href: '#install', label: 'Install' },
  { href: 'https://work4you.ai/docs/', label: 'Docs', external: true },
]

export function Nav() {
  return (
    <header className={styles.header}>
      <div className={`shell ${styles.inner}`}>
        <a className={styles.brand} href="#top" aria-label="Work4You home">
          <span className={styles.mark} aria-hidden="true" />
          Work4You
        </a>
        <nav className={styles.nav} aria-label="Primary">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className={styles.actions}>
          <a className={styles.ghost} href="https://portal.work4you.ai">
            Sign in
          </a>
          <a className={styles.solid} href="#install">
            Get started
          </a>
        </div>
      </div>
    </header>
  )
}
