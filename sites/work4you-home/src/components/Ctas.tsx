import { useMemo } from 'react'
import { DESKTOP_DOWNLOADS } from '../lib/downloads'
import { detectGuestOS } from '../lib/platform'
import styles from './Ctas.module.css'

export function HeroCtas() {
  const os = useMemo(() => detectGuestOS(), [])

  if (os === 'linux') {
    return (
      <div className={styles.pills}>
        <a className={styles.primary} href="#install">
          Instalar via terminal
        </a>
        <a className={styles.ghost} href={DESKTOP_DOWNLOADS.windows}>
          Baixar para Windows
        </a>
      </div>
    )
  }

  return (
    <div className={styles.pills}>
      <a
        className={styles.primary}
        href={os === 'windows' ? DESKTOP_DOWNLOADS.windows : DESKTOP_DOWNLOADS.mac}
      >
        {os === 'windows' ? 'Baixar para Windows' : 'Baixar para macOS'}
      </a>
      <a className={styles.ghost} href="#install">
        Instalar via terminal
      </a>
    </div>
  )
}

export function CloseDownload() {
  const os = useMemo(() => detectGuestOS(), [])
  if (os === 'linux') return null
  return (
    <a
      className={styles.primary}
      href={os === 'windows' ? DESKTOP_DOWNLOADS.windows : DESKTOP_DOWNLOADS.mac}
    >
      {os === 'windows' ? 'Baixar para Windows' : 'Baixar para macOS'}
    </a>
  )
}
