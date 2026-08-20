import { useState } from 'react'
import styles from './Install.module.css'

const commands = {
  unix: 'curl -fsSL https://storage.googleapis.com/w4y-engine-dist/install.sh | bash',
  windows: 'irm https://storage.googleapis.com/w4y-engine-dist/install.ps1 | iex',
} as const

type Tab = keyof typeof commands

export function Install() {
  const [tab, setTab] = useState<Tab>('unix')
  const [copied, setCopied] = useState(false)

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(commands[tab])
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={styles.section} id="install">
      <div className="shell">
        <p className="eyebrow">Install or open</p>
        <h2 className="section-title">Where you work, one account.</h2>
        <p className="section-lead">
          Native desktop app, a light CLI, or the same product in the browser.
        </p>

        <div className={styles.grid}>
          <article className={styles.block}>
            <h3>Install desktop app</h3>
            <p>
              Windows &amp; macOS (Apple Silicon). First install may ask for an
              extra confirmation while the publisher is unsigned.
            </p>
            <div className={styles.row}>
              <a
                className={styles.button}
                href="https://portal.work4you.ai"
              >
                Download for your system
              </a>
            </div>
          </article>

          <article className={styles.block}>
            <h3>Install via terminal</h3>
            <div className={styles.tabs} role="tablist" aria-label="Install OS">
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
              <code>{commands[tab]}</code>
              <button type="button" onClick={() => void copyCommand()}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
