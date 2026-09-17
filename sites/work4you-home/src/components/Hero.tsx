import { useMemo, useState } from 'react'
import {
  DESKTOP_DOWNLOADS,
  INSTALL_COMMANDS,
  type InstallPlatform,
} from '../lib/downloads'
import { Platforms } from './Platforms'
import styles from './Hero.module.css'

type Tab = InstallPlatform

function detectTab(): Tab {
  if (typeof navigator === 'undefined') return 'unix'
  return /windows/i.test(navigator.userAgent) ? 'windows' : 'unix'
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const field = document.createElement('textarea')
      field.value = text
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.left = '-9999px'
      document.body.appendChild(field)
      field.select()
      const ok = document.execCommand('copy')
      field.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function Hero() {
  const initial = useMemo(() => detectTab(), [])
  const [tab, setTab] = useState<Tab>(initial)
  const [copied, setCopied] = useState(false)

  async function copyCommand() {
    const ok = await copyText(INSTALL_COMMANDS[tab])
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className={styles.hero} id="top">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="mono-label">Open source · MIT license</p>
          <h1 className={styles.title}>
            Agente de IA que
            <br />
            cresce com você.
          </h1>
          <p className={styles.lead}>
            Desktop, terminal e os canais que você já usa — um agente, uma
            memória.
          </p>
          <Platforms />

          <div className={styles.block} id="download">
            <p className="mono-label">Baixar aplicativo desktop</p>
            <a
              className={styles.download}
              href={
                tab === 'windows'
                  ? DESKTOP_DOWNLOADS.windows
                  : DESKTOP_DOWNLOADS.mac
              }
            >
              {tab === 'windows'
                ? 'Baixar para Windows'
                : 'Baixar para macOS'}
            </a>
          </div>

          <div className={styles.block} id="install">
            <p className="mono-label">Instalar via terminal</p>
            <div className={styles.tabs} role="tablist" aria-label="Sistema">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'unix'}
                className={tab === 'unix' ? styles.active : undefined}
                onClick={() => setTab('unix')}
              >
                macOS / Linux
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'windows'}
                className={tab === 'windows' ? styles.active : undefined}
                onClick={() => setTab('windows')}
              >
                Windows
              </button>
            </div>
            <div className={styles.code}>
              <code>{INSTALL_COMMANDS[tab]}</code>
              <button
                type="button"
                className={copied ? styles.copied : undefined}
                onClick={() => void copyCommand()}
              >
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.visual} aria-hidden="true">
          <img
            src="/media/hero-hills.jpg"
            alt=""
            className={styles.image}
          />
        </div>
      </div>
    </section>
  )
}
