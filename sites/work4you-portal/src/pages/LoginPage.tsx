import { useLogin, usePrivy } from '@privy-io/react-auth'
import { FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import styles from './LoginPage.module.css'

export type AuthMode = 'login' | 'signup'

type ProviderId = 'github' | 'google' | 'discord' | 'passkey'

interface LoginPageProps {
  initialMode?: AuthMode
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'github', label: 'Continuar com GitHub' },
  { id: 'google', label: 'Continuar com Google' },
  { id: 'discord', label: 'Continuar com Discord' },
  { id: 'passkey', label: 'Continuar com Passkey' },
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

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const [params] = useSearchParams()
  const modeFromQuery = params.get('mode')
  const startMode: AuthMode =
    modeFromQuery === 'signup' || initialMode === 'signup' ? 'signup' : 'login'

  const [mode, setMode] = useState<AuthMode>(startMode)
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { ready, authenticated, user, logout } = usePrivy()
  const { login } = useLogin({
    onError: (error) => {
      const message = String(error)
      if (message.toLowerCase().includes('exited')) {
        setNotice(null)
        return
      }
      setNotice(message || 'Não foi possível entrar. Tente de novo.')
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
  }

  function onProvider(id: ProviderId) {
    setNotice(null)
    login({ loginMethods: [id] })
  }

  function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value || !value.includes('@')) {
      setNotice('Informe um e-mail válido.')
      return
    }
    setNotice(null)
    login({
      loginMethods: ['email'],
      prefill: { type: 'email', value },
    })
  }

  async function onLogout() {
    setNotice(null)
    await logout()
  }

  if (!ready) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.lede}>Carregando…</p>
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
            <p className={styles.lede}>
              Conectado como <strong>{displayName(user)}</strong>.
            </p>
            <p className={styles.sessionHint}>
              O painel completo (billing, API keys, usage) chega em seguida. Por
              enquanto a autenticação Privy já está ativa neste portal.
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
          <p className={styles.lede}>
            Um agente de IA que aprende sua empresa e assume o trabalho.
          </p>

          <div className={styles.providers}>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.provider}
                onClick={() => onProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={styles.divider} role="separator">
            <span>ou</span>
          </div>

          {!showEmail ? (
            <button
              type="button"
              className={styles.emailToggle}
              onClick={() => {
                setShowEmail(true)
                setNotice(null)
              }}
            >
              {copy.emailCta}
            </button>
          ) : (
            <form className={styles.emailForm} onSubmit={onEmailSubmit}>
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
              />
              <button type="submit" className={styles.primary}>
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
