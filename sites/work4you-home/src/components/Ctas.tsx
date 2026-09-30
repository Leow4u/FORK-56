import { Fragment, useMemo } from 'react'
import { DESKTOP_DOWNLOADS } from '../lib/downloads'
import type { IconName } from '../lib/glyphs'
import { detectGuestOS } from '../lib/platform'
import type { GuestOS } from '../lib/platform'
import { Icon } from './Icon'
import styles from './Ctas.module.css'

interface CtaLink {
  href: string
  icon: IconName
  label: string
}

interface PlatformLink {
  href: string
  label: string
}

interface CtaSpec extends CtaLink {
  alt: CtaLink
  /** Os outros sistemas, sempre alcançáveis (o instalador do macOS inclusive). */
  also: PlatformLink[]
  arrow: IconName
  /** Tipo de arquivo ou forma de instalar, na segunda linha do botão. */
  detail: string
  /** Rótulo curto do botão da navegação. */
  navLabel: string
}

const INSTALL = '#install'
const MAC: PlatformLink = { href: DESKTOP_DOWNLOADS.mac, label: 'macOS' }
const WINDOWS: PlatformLink = { href: DESKTOP_DOWNLOADS.windows, label: 'Windows' }
const LINUX: PlatformLink = { href: INSTALL, label: 'Linux' }

/** Download direto no Windows e no macOS; no Linux o caminho principal é o terminal. */
export const CTA_BY_OS: Record<GuestOS, CtaSpec> = {
  windows: {
    href: DESKTOP_DOWNLOADS.windows,
    icon: 'windows',
    arrow: 'download',
    label: 'Baixar para Windows',
    detail: 'Instalador .exe',
    navLabel: 'Baixar',
    alt: { href: INSTALL, icon: 'terminal', label: 'Instalar via terminal' },
    also: [MAC, LINUX],
  },
  mac: {
    href: DESKTOP_DOWNLOADS.mac,
    icon: 'laptop',
    arrow: 'download',
    label: 'Baixar para macOS',
    detail: 'Arquivo .dmg',
    navLabel: 'Baixar',
    alt: { href: INSTALL, icon: 'terminal', label: 'Instalar via terminal' },
    also: [WINDOWS, LINUX],
  },
  linux: {
    href: INSTALL,
    icon: 'terminal',
    arrow: 'go',
    label: 'Instalar via terminal',
    detail: 'Um comando · Linux e macOS',
    navLabel: 'Instalar',
    alt: { href: DESKTOP_DOWNLOADS.windows, icon: 'windows', label: 'Baixar para Windows' },
    also: [MAC],
  },
}

function DownloadButton({ cta }: { cta: CtaSpec }) {
  return (
    <a className={styles.download} href={cta.href}>
      <Icon className={styles.os} name={cta.icon} />
      <span className={styles.text}>
        <b>{cta.label}</b>
        <small>{cta.detail}</small>
      </span>
      <Icon className={styles.arrow} name={cta.arrow} />
    </a>
  )
}

/** "Também para macOS e Linux", com cada sistema como link. */
function AlsoFor({ links }: { links: PlatformLink[] }) {
  return (
    <p className={styles.note}>
      Também para{' '}
      {links.map((link, index) => (
        <Fragment key={link.label}>
          {index > 0 ? (index === links.length - 1 ? ' e ' : ', ') : null}
          <a href={link.href}>{link.label}</a>
        </Fragment>
      ))}
    </p>
  )
}

export function HeroCtas() {
  const os = useMemo(() => detectGuestOS(), [])
  const cta = CTA_BY_OS[os]

  return (
    <div className={styles.group}>
      <DownloadButton cta={cta} />
      <a className={styles.alt} href={cta.alt.href}>
        <Icon className={styles.altIcon} name={cta.alt.icon} />
        {cta.alt.label}
      </a>
      <AlsoFor links={cta.also} />
    </div>
  )
}

export function CloseDownload() {
  const os = useMemo(() => detectGuestOS(), [])

  if (os === 'linux') {
    return null
  }

  const cta = CTA_BY_OS[os]

  return (
    <div className={styles.closeGroup}>
      <DownloadButton cta={cta} />
      <AlsoFor links={cta.also} />
    </div>
  )
}
