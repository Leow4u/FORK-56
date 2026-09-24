'use client'

import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  oauthAuthorizeQuery,
  oauthAuthorizeQueryValid,
  shouldAutoApproveAgentLink,
  type OAuthAuthorizeQuery
} from '../lib/oauth-authorize'
import { PRIVY_PUBLIC_APP_ID } from '../lib/privy-public-app-id'
import styles from './OAuthAuthorizePage.module.css'

interface ApproveBody {
  error?: string
  error_description?: string
  ok?: boolean
  redirect?: string
}

function privyAppId(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || '').trim()

  return fromEnv || PRIVY_PUBLIC_APP_ID.trim()
}

async function approveAgentLink(query: OAuthAuthorizeQuery): Promise<string> {
  const response = await fetch('/api/oauth/authorize/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(query)
  })
  const body = (await response.json()) as ApproveBody

  if (!response.ok || body.ok !== true || !body.redirect) {
    throw new Error(body.error_description || body.error || 'authorization_failed')
  }

  return body.redirect
}

function OAuthAuthorizeScreen() {
  const search = useSearchParams()
  const { ready, authenticated, login } = usePrivy()
  const query = useMemo(() => oauthAuthorizeQuery(search), [search])
  const valid = oauthAuthorizeQueryValid(query)
  const returnPath = useMemo(() => {
    const raw = search.toString()

    return raw ? `/oauth/authorize?${raw}` : '/oauth/authorize'
  }, [search])
  const attempted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !authenticated) {
      window.location.replace(`/login?next=${encodeURIComponent(returnPath)}`)
    }
  }, [authenticated, ready, returnPath])

  async function approve() {
    if (!valid || busy) return

    setBusy(true)
    setError(null)

    try {
      window.location.replace(await approveAgentLink(query))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''

      setError(message && !(cause instanceof TypeError) ? message : 'Não foi possível contactar o Portal.')
      setBusy(false)
    }
  }

  useEffect(() => {
    if (
      !shouldAutoApproveAgentLink({
        attempted: attempted.current,
        authenticated,
        ready,
        valid
      })
    ) {
      return
    }

    attempted.current = true
    void approve()
    // approve closes over the current query; the guard runs once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, ready, valid])

  if (!ready || !authenticated || (valid && busy && !error)) {
    return (
      <div className={styles.shell}>
        <p className={styles.muted}>{valid && busy ? 'A ligar ao agente…' : 'A verificar sessão…'}</p>
      </div>
    )
  }

  const instance = query.client_id.replace(/^agent:/, '')

  function deny() {
    if (!query.redirect_uri) return

    const join = query.redirect_uri.includes('?') ? '&' : '?'

    window.location.replace(
      `${query.redirect_uri}${join}error=access_denied&state=${encodeURIComponent(query.state)}`
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.title}>Ligar ao agente</h1>
        <p className={styles.lead}>
          O dashboard do agente pede acesso à sua conta Work4You para iniciar sessão com OAuth.
        </p>
        {!valid ? (
          <p className={styles.error} role="alert">
            Pedido OAuth inválido ou incompleto.
          </p>
        ) : null}
        <dl className={styles.meta}>
          <div>
            <dt>Instância</dt>
            <dd>{instance}</dd>
          </div>
          <div>
            <dt>Permissão</dt>
            <dd>Acesso ao dashboard do agente</dd>
          </div>
        </dl>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <form
          className={styles.actions}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void approve()
          }}
        >
          <button type="button" className={styles.secondary} onClick={deny} disabled={busy || !valid}>
            Cancelar
          </button>
          <button type="submit" className={styles.primary} disabled={busy || !valid}>
            {busy ? 'A autorizar…' : 'Autorizar'}
          </button>
        </form>
        <p className={styles.muted}>
          Não reconhece este pedido?{' '}
          <button type="button" className={styles.link} onClick={() => login()}>
            Inicie sessão com outra conta
          </button>
          .
        </p>
      </div>
    </div>
  )
}

export function OAuthAuthorizePage() {
  const appId = privyAppId()

  if (!appId) {
    return (
      <div className={styles.shell}>
        <p className={styles.muted}>PRIVY_APP_ID em falta</p>
      </div>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google', 'github', 'discord', 'passkey'],
        appearance: {
          theme: '#F5F4EE',
          accentColor: '#4D5943',
          logo: '/brand/work4you-logo.png',
          landingHeader: 'Entrar na Work4You',
          showWalletLoginFirst: false
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' }
        }
      }}
    >
      <OAuthAuthorizeScreen />
    </PrivyProvider>
  )
}
