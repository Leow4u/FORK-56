import { useMemo } from 'react'
import type { DownloadCta } from '../lib/download-ctas'
import { closeDownloadCtas, heroDownloadCtas } from '../lib/download-ctas'
import { detectGuestOS } from '../lib/platform'
import styles from './Ctas.module.css'

function CtaLink({ cta }: { cta: DownloadCta }) {
  return (
    <a className={cta.tone === 'primary' ? styles.primary : styles.ghost} href={cta.href}>
      {cta.label}
    </a>
  )
}

export function HeroCtas() {
  const ctas = useMemo(() => heroDownloadCtas(detectGuestOS()), [])
  return (
    <div className={styles.pills}>
      {ctas.map((cta) => (
        <CtaLink key={cta.href + cta.label} cta={cta} />
      ))}
    </div>
  )
}

export function CloseDownload() {
  const ctas = useMemo(() => closeDownloadCtas(detectGuestOS()), [])
  return (
    <div className={`${styles.pills} ${styles.center}`}>
      {ctas.map((cta) => (
        <CtaLink key={cta.href + cta.label} cta={cta} />
      ))}
    </div>
  )
}
