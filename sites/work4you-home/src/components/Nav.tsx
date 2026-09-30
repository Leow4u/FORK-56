import { useMemo } from 'react'
import { detectGuestOS } from '../lib/platform'
import { CTA_BY_OS } from './Ctas'
import { Icon } from './Icon'
import styles from './Nav.module.css'

const LOGIN = 'https://portal.work4you.ai/login'

export function Nav() {
  const os = useMemo(() => detectGuestOS(), [])
  const cta = CTA_BY_OS[os]

  return (
    <header className={styles.header}>
      <div className={`shell ${styles.inner}`}>
        <a className={styles.side} href="https://work4you.ai/docs/">
          Docs
        </a>

        <a className={styles.brand} href="/" aria-label="Work4You">
          <img
            src="/brand/work4you-logo.png"
            alt="Work4You"
            width={160}
            height={16}
          />
        </a>

        <div className={styles.actions}>
          <a className={styles.side} href={LOGIN}>
            Fazer login
          </a>
          <a className={styles.download} href={cta.href}>
            <Icon className={styles.downloadIcon} name={cta.icon} />
            {cta.navLabel}
          </a>
        </div>
      </div>
    </header>
  )
}
