import styles from './Nav.module.css'

const links = [
  { href: 'https://work4you.ai/docs/', label: 'Docs', external: true },
  { href: '#install', label: 'Install' },
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
      </div>
    </header>
  )
}
