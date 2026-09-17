import { useMemo, useState } from 'react'
import { INSTALL_COMMANDS, type InstallPlatform } from '../lib/downloads'
import { copyText } from '../lib/clipboard'
import { detectGuestOS } from '../lib/platform'
import styles from './InstallPanel.module.css'

function detectTab(): InstallPlatform {
  return detectGuestOS() === 'windows' ? 'windows' : 'unix'
}

export function InstallPanel() {
  const initial = useMemo(() => detectTab(), [])
  const [tab, setTab] = useState<InstallPlatform>(initial)
  const [copied, setCopied] = useState(false)

  async function copyCommand() {
    const ok = await copyText(INSTALL_COMMANDS[tab])
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={styles.panel} id="install">
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
  )
}
