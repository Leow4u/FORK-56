'use client'

import { useCallback, useState } from 'react'
import { openCloudChat } from '../lib/open-cloud-chat'
import styles from './OpenCloudChatButton.module.css'

interface OpenCloudChatButtonProps {
  chatUrl: string | null
  allowed: boolean
  wakeOnOpen: boolean
  agentId?: string
  orgId?: string
  getAccessToken?: () => Promise<string | null | undefined>
  /** Matches CloudPage card primary button styling when set. */
  variant?: 'hero' | 'card'
}

export function OpenCloudChatButton({
  chatUrl,
  allowed,
  wakeOnOpen,
  agentId,
  orgId,
  getAccessToken,
  variant = 'hero',
}: OpenCloudChatButtonProps) {
  const [opening, setOpening] = useState(false)
  const className = variant === 'card' ? styles.cardPrimary : styles.heroPrimary

  const onClick = useCallback(() => {
    if (!allowed || !chatUrl || opening) return
    setOpening(true)
    void openCloudChat({
      chatUrl,
      wakeOnOpen,
      agentId,
      orgId,
      getAccessToken,
    }).finally(() => {
      window.setTimeout(() => setOpening(false), 800)
    })
  }, [allowed, chatUrl, opening, wakeOnOpen, agentId, orgId, getAccessToken])

  if (!allowed || !chatUrl) {
    return (
      <button type="button" className={className} disabled>
        Abrir chat
      </button>
    )
  }

  return (
    <button
      type="button"
      className={className}
      disabled={opening}
      onClick={onClick}
    >
      {opening ? 'A abrir…' : 'Abrir chat'}
    </button>
  )
}
