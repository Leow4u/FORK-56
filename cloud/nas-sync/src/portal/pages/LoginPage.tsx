'use client'

import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithPasskey,
  usePrivy,
} from '@privy-io/react-auth'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AuthProviderIcon } from '../components/AuthProviderIcons'
import { EmailCodeBoxes } from '../components/EmailCodeBoxes'
import { safePortalNextPath } from '../lib/device-approve'
import {
  type AuthProviderId,
  readLastUsedProvider,
  saveLastUsedProvider,
} from '../lib/last-used-provider'
import { personalOrgId } from '../lib/org'
import { savePendingProfile } from '../lib/pending-profile'
import {
  isCompleteEmailOtp,
  isDevicePairingNext,
  isLoginEmailCodePreview,
  loginDevicePairingNotice,
  loginEmailCodeCopy,
  normalizeEmailOtp,
  shouldShowLoginAlternatives,
} from '../lib/login-email-code'
import { isValidEmail, parseProfileName } from '../lib/profile-name'
import { syncProfileAfterAuth } from '../lib/sync-profile'
import styles from './LoginPage.module.css'

export type AuthMode = 'login' | 'signup'

type OAuthProviderId = 'github' | 'google' | 'discord'

interface LoginPageProps {
  initialMode?: AuthMode
}

const OAUTH_PROVIDERS: { id: OAuthProviderId; label: string }[] = [
  { id: 'github', label: 'Continuar com GitHub' },
  { id: 'google', label: 'Continuar com Google' },
  { id: 'discord', label: 'Continuar com Discord' },
]

function errorMessage(error: unknown): string {
  const message = String(error ?? '')
  if (!message || message === 'undefined' || message.toLowerCase().includes('exited')) {
    return ''
  }
  const lower = message.toLowerCase()
  if (lower.includes('disallowed_login_method')) {
    if (lower.includes('github')) {
      return 'GitHub ainda não está liberado no Privy. Ative o método Login → GitHub no dashboard e salve.'
    }
    if (lower.includes('google')) {
      return 'Google ainda não está liberado no Privy. Ative o método Login → Google no dashboard e salve.'
    }
    if (lower.includes('discord')) {
      return 'Discord ainda não está liberado no Privy. Ative o método Login → Discord no dashboard e salve.'
    }
    return 'Este método de login não está liberado no Privy. Confira Login methods no dashboard.'
  }
  if (lower.includes('invalid_origin') || lower.includes('origin')) {
    return 'Origem não autorizada. Inclua https://portal.work4you.ai em Allowed origins no Privy.'
  }
  return message
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const [params] = useSearchParams()
  const modeFromQuery = params.get('mode')
  // Vite and Next.js both set NODE_ENV. import.meta.env.DEV fails the NAS typecheck.
  const layoutPreview =
    process.env.NODE_ENV !== 'production' && params.get('preview') === '1'
  const previewEmailCode = isLoginEmailCodePreview(layoutPreview, params.get('step'))
  const startMode: AuthMode =
    modeFromQuery === 'signup' || initialMode === 'signup' ? 'signup' : 'login'
  const devicePairing = isDevicePairingNext(params.get('next'))

  const [mode, setMode] = useState<AuthMode>(startMode)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(() =>
    previewEmailCode ? (params.get('email') || '').trim() : '',
  )
  const [code, setCode] = useState('')
  const [awaitingCode, setAwaitingCode] = useState(previewEmailCode)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastUsed, setLastUsed] = useState<AuthProviderId | null>(null)
  const [profileReady, setProfileReady] = useState(false)

  const { ready, authenticated, user, getAccessToken } = usePrivy()

  const { initOAuth } = useLoginWithOAuth({
    onError: (error) => {
      const message = errorMessage(error)
      if (message) setNotice(message)
    },
  })

  const { loginWithPasskey } = useLoginWithPasskey({
    onError: (error) => {
      const message = errorMessage(error)
      if (message) setNotice(message)
    },
  })

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onError: (error) => {
      const message = errorMessage(error)
      if (message) setNotice(message)
    },
  })

  const copy = useMemo(
    () =>
      mode === 'signup'
        ? {
            eyebrow: 'Criar conta',
            title: 'Comece na Work4You',
            switchLabel: 'Já tem conta?',
            switchAction: 'Fazer login',
            emailCta: 'Continuar',
          }
        : {
            eyebrow: 'Entrar',
            title: 'Bem-vindo de volta',
            switchLabel: 'Ainda não tem conta?',
            switchAction: 'Criar conta',
            emailCta: 'Continuar com e-mail',
          },
    [mode],
  )

  const codeCopy = useMemo(
    () => loginEmailCodeCopy(email, devicePairing),
    [devicePairing, email],
  )
  const pairingNotice = loginDevicePairingNotice(devicePairing)
  const showAlternatives = shouldShowLoginAlternatives(awaitingCode)

  useEffect(() => {
    setLastUsed(readLastUsedProvider())
  }, [])

  useEffect(() => {
    if (!authenticated || !user) {
      setProfileReady(false)
      return
    }
    let cancelled = false
    void syncProfileAfterAuth(user, getAccessToken).finally(() => {
      if (!cancelled) setProfileReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [authenticated, user, getAccessToken])

  function rememberSignupName() {
    const profile = parseProfileName({ firstName, lastName })
    if (profile) savePendingProfile(profile)
  }

  function switchMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setNotice(null)
    setAwaitingCode(false)
    setCode('')
  }

  function onUseOtherEmail() {
    setAwaitingCode(false)
    setCode('')
    setNotice(null)
  }

  async function onResendCode() {
    const value = email.trim()
    if (!isValidEmail(value)) {
      setNotice('Informe um e-mail válido.')
      return
    }
    setNotice(null)
    setBusy(true)
    try {
      await sendCode({ email: value })
      setNotice('Enviámos um novo código para o seu e-mail.')
    } catch (error) {
      const message = errorMessage(error)
      setNotice(message || 'Não foi possível reenviar o código.')
    } finally {
      setBusy(false)
    }
  }

  async function onOAuth(id: OAuthProviderId) {
    setNotice(null)
    if (mode === 'signup') rememberSignupName()
    saveLastUsedProvider(id)
    setLastUsed(id)
    setBusy(true)
    try {
      await initOAuth({ provider: id })
    } catch (error) {
      const message = errorMessage(error)
      setNotice(message || 'Não foi possível entrar. Tente de novo.')
      setBusy(false)
    }
  }

  async function onPasskey() {
    setNotice(null)
    if (mode === 'signup') rememberSignupName()
    saveLastUsedProvider('passkey')
    setLastUsed('passkey')
    setBusy(true)
    try {
      await loginWithPasskey()
    } catch (error) {
      const message = errorMessage(error)
      if (message) setNotice(message)
    } finally {
      setBusy(false)
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'signup') {
      const profile = parseProfileName({ firstName, lastName })
      if (!profile) {
        setNotice('Informe o nome e o sobrenome.')
        return
      }
      savePendingProfile(profile)
    }
    const value = email.trim()
    if (!isValidEmail(value)) {
      setNotice('Informe um e-mail válido.')
      return
    }
    setNotice(null)
    setBusy(true)
    try {
      await sendCode({ email: value })
      setAwaitingCode(true)
    } catch (error) {
      const message = errorMessage(error)
      setNotice(message || 'Não foi possível enviar o código.')
    } finally {
      setBusy(false)
    }
  }

  async function submitEmailCode(raw: string) {
    const value = normalizeEmailOtp(raw)
    if (!isCompleteEmailOtp(value) || busy || layoutPreview) {
      if (!layoutPreview && !isCompleteEmailOtp(value)) {
        setNotice('Informe o código de 6 dígitos recebido por e-mail.')
      }
      return
    }
    setCode(value)
    setNotice(null)
    setBusy(true)
    try {
      await loginWithCode({ code: value })
    } catch (error) {
      const message = errorMessage(error)
      setNotice(message || 'Código inválido. Tente de novo.')
      setBusy(false)
    }
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault()
    await submitEmailCode(code)
  }

  if (!layoutPreview && !ready) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.status}>Carregando…</p>
        </main>
      </div>
    )
  }

  if (!layoutPreview && authenticated && user && profileReady) {
    const next = safePortalNextPath(params.get('next'))
    if (next) {
      return <Navigate to={next} replace />
    }
    return <Navigate to={`/orgs/${personalOrgId(user.id)}`} replace />
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <a className={styles.brand} href="https://work4you.ai/" aria-label="Work4You">
          <img
            src="/brand/work4you-logo.png"
            alt="Work4You"
            width={160}
            height={16}
          />
        </a>
        <a className={styles.homeLink} href="https://work4you.ai/">
          Voltar ao site
        </a>
      </header>

      <main className={styles.main}>
        {awaitingCode ? (
          <section className={styles.codeCard} aria-labelledby="login-title">
            <button
              type="button"
              className={styles.backBtn}
              disabled={busy}
              onClick={onUseOtherEmail}
              aria-label={codeCopy.useOtherEmail}
            >
              ←
            </button>
            <div className={styles.mailIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M4 8.2 12 13l8-4.8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 id="login-title" className={styles.codeTitle}>
              {codeCopy.title}
            </h1>
            <p className={styles.codeLead}>
              {codeCopy.leadBefore}{' '}
              <strong className={styles.leadEmail}>{codeCopy.email || 'o seu e-mail'}</strong>{' '}
              {codeCopy.leadAfter}
            </p>
            {codeCopy.deviceHint ? <p className={styles.hint}>{codeCopy.deviceHint}</p> : null}
            <form className={styles.codeForm} onSubmit={(e) => void onCodeSubmit(e)}>
              <EmailCodeBoxes
                value={code}
                disabled={busy}
                labelledBy="login-title"
                onChange={setCode}
                onComplete={(value) => void submitEmailCode(value)}
              />
              <button type="submit" className={styles.srOnly}>
                {codeCopy.title}
              </button>
            </form>
            {notice ? <p className={styles.notice}>{notice}</p> : null}
            <p className={styles.resendLine}>
              {codeCopy.resendLead}{' '}
              <button
                type="button"
                className={styles.switchBtn}
                disabled={busy}
                onClick={() => void onResendCode()}
              >
                {codeCopy.resend}
              </button>
            </p>
          </section>
        ) : (
        <section className={styles.stack} aria-labelledby="login-title">
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 id="login-title" className={styles.title}>
            {copy.title}
          </h1>

          {pairingNotice ? <p className={styles.lead}>{pairingNotice}</p> : null}

          {showAlternatives ? (
            <div className={styles.providers} role="group" aria-label="Entrar com um provedor">
              {OAUTH_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.provider}
                  disabled={busy}
                  aria-label={p.label}
                  onClick={() => void onOAuth(p.id)}
                >
                  {lastUsed === p.id ? (
                    <span className={styles.lastUsed}>Usado por último</span>
                  ) : null}
                  <AuthProviderIcon id={p.id} />
                </button>
              ))}
              <button
                type="button"
                className={styles.provider}
                disabled={busy}
                aria-label="Continuar com passkey"
                onClick={() => void onPasskey()}
              >
                {lastUsed === 'passkey' ? (
                  <span className={styles.lastUsed}>Usado por último</span>
                ) : null}
                <AuthProviderIcon id="passkey" />
              </button>
            </div>
          ) : null}

            <form className={styles.emailForm} onSubmit={(e) => void onEmailSubmit(e)}>
              {mode === 'signup' ? (
                <div className={styles.nameRow}>
                  <div>
                    <label className={styles.label} htmlFor="firstName">
                      Nome
                    </label>
                    <input
                      id="firstName"
                      className={styles.input}
                      type="text"
                      autoComplete="given-name"
                      placeholder="O seu nome"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className={styles.label} htmlFor="lastName">
                      Sobrenome
                    </label>
                    <input
                      id="lastName"
                      className={styles.input}
                      type="text"
                      autoComplete="family-name"
                      placeholder="O seu sobrenome"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>
              ) : null}
              <label className={styles.label} htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="Seu endereço de e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className={styles.primary} disabled={busy}>
                {copy.emailCta}
              </button>
            </form>

          {notice ? <p className={styles.notice}>{notice}</p> : null}

          {showAlternatives ? (
            <p className={styles.switch}>
              {copy.switchLabel}{' '}
              <button type="button" className={styles.switchBtn} onClick={switchMode}>
                {copy.switchAction}
              </button>
            </p>
          ) : null}
        </section>
        )}
      </main>

      <footer className={styles.footer}>
        <Link to="/login">portal.work4you.ai</Link>
        <span aria-hidden="true">·</span>
        <a href="https://work4you.ai/docs/">Docs</a>
      </footer>
    </div>
  )
}
