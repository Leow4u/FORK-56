import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithPasskey,
  usePrivy,
} from '@privy-io/react-auth'
import { FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

function displayName(user: NonNullable<ReturnType<typeof usePrivy>['user']>): string {
  const email = user.email?.address
  if (email) return email
  const google = user.google?.email
  if (google) return google
  const github = user.github?.username || user.github?.email
  if (github) return github
  const discord = user.discord?.username
  if (discord) return discord
  return user.id
}

function errorMessage(error: unknown): string {
  const message = String(error ?? '')
  if (!message || message === 'undefined' || message.toLowerCase().includes('exited')) {
    return ''
  }
  return message
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const [params] = useSearchParams()
  const modeFromQuery = params.get('mode')
  const startMode: AuthMode =
    modeFromQuery === 'signup' || initialMode === 'signup' ? 'signup' : 'login'

  const [mode, setMode] = useState<AuthMode>(startMode)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { ready, authenticated, user, logout } = usePrivy()

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
            emailCta: 'Continuar com e-mail',
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

  function switchMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setNotice(null)
    setShowEmail(false)
    setAwaitingCode(false)
    setCode('')
  }

  async function onOAuth(id: OAuthProviderId) {
    setNotice(null)
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
    const value = email.trim()
    if (!value || !value.includes('@')) {
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

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault()
    const value = code.trim()
    if (!value) {
      setNotice('Informe o código recebido por e-mail.')
      return
    }
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

  async function onLogout() {
    setNotice(null)
    await logout()
  }

  if (!ready) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.status}>Carregando…</p>
        </main>
      </div>
    )
  }

  if (authenticated && user) {
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
          <section className={styles.card} aria-labelledby="session-title">
            <p className={styles.eyebrow}>Sessão</p>
            <h1 id="session-title" className={styles.title}>
              Você entrou
            </h1>
            <p className={styles.status}>
              <strong>{displayName(user)}</strong>
            </p>
            <button type="button" className={styles.primary} onClick={() => void onLogout()}>
              Sair
            </button>
          </section>
        </main>

        <footer className={styles.footer}>
          <Link to="/login">portal.work4you.ai</Link>
          <span aria-hidden="true">·</span>
          <a href="https://work4you.ai/docs/">Docs</a>
        </footer>
      </div>
    )
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
        <section className={styles.card} aria-labelledby="login-title">
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 id="login-title" className={styles.title}>
            {copy.title}
          </h1>

          <div className={styles.providers}>
            {OAUTH_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.provider}
                disabled={busy}
                onClick={() => void onOAuth(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={styles.provider}
              disabled={busy}
              onClick={() => void onPasskey()}
            >
              Continuar com Passkey
            </button>
          </div>

          <div className={styles.divider} role="separator">
            <span>ou</span>
          </div>

          {!showEmail ? (
            <button
              type="button"
              className={styles.emailToggle}
              disabled={busy}
              onClick={() => {
                setShowEmail(true)
                setNotice(null)
              }}
            >
              {copy.emailCta}
            </button>
          ) : awaitingCode ? (
            <form className={styles.emailForm} onSubmit={(e) => void onCodeSubmit(e)}>
              <label className={styles.label} htmlFor="code">
                Código
              </label>
              <input
                id="code"
                className={styles.input}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className={styles.primary} disabled={busy}>
                Entrar
              </button>
            </form>
          ) : (
            <form className={styles.emailForm} onSubmit={(e) => void onEmailSubmit(e)}>
              <label className={styles.label} htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
              <button type="submit" className={styles.primary} disabled={busy}>
                Continuar
              </button>
            </form>
          )}

          {notice ? <p className={styles.notice}>{notice}</p> : null}

          <p className={styles.switch}>
            {copy.switchLabel}{' '}
            <button type="button" className={styles.switchBtn} onClick={switchMode}>
              {copy.switchAction}
            </button>
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link to="/login">portal.work4you.ai</Link>
        <span aria-hidden="true">·</span>
        <a href="https://work4you.ai/docs/">Docs</a>
      </footer>
    </div>
  )
}
