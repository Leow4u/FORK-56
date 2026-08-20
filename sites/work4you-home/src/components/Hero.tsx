import { useMemo, useState } from 'react'
import styles from './Hero.module.css'

const COMMANDS = {
  unix: 'curl -fsSL https://storage.googleapis.com/w4y-engine-dist/install.sh | bash',
  windows:
    'irm https://storage.googleapis.com/w4y-engine-dist/install.ps1 | iex',
} as const

type Tab = keyof typeof COMMANDS

function detectTab(): Tab {
  if (typeof navigator === 'undefined') return 'unix'
  return /windows/i.test(navigator.userAgent) ? 'windows' : 'unix'
}

export function Hero() {
  const initial = useMemo(() => detectTab(), [])
  const [tab, setTab] = useState<Tab>(initial)
  const [copied, setCopied] = useState(false)

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(COMMANDS[tab])
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
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

          <div className={styles.block} id="download">
            <p className="mono-label">Baixar aplicativo desktop</p>
            <a
              className={styles.download}
              href={
                tab === 'windows'
                  ? 'https://storage.googleapis.com/w4y-engine-dist/Work4You-Setup.exe'
                  : 'https://storage.googleapis.com/w4y-engine-dist/Work4You.dmg'
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
              <code>{COMMANDS[tab]}</code>
              <button type="button" onClick={() => void copyCommand()}>
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
