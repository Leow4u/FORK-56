'use client'

import { usePrivy } from '@privy-io/react-auth'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  canSubmitDeviceUserCode,
  deviceAuthorizedCopy,
  deviceVerificationPath,
  isDeviceAuthorizedPreview,
  normalizeDeviceUserCode,
} from '../lib/device-approve'
import styles from './DeviceApprovePage.module.css'
import page from './LoginPage.module.css'

export function DeviceApprovePage() {
  const [params] = useSearchParams()
  const initial = normalizeDeviceUserCode(params.get('user_code') || '')
  const [userCode, setUserCode] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ready, authenticated, getAccessToken } = usePrivy()

  const canSubmit = useMemo(() => canSubmitDeviceUserCode(userCode), [userCode])
  // Vite and Next.js both set NODE_ENV. import.meta.env.DEV fails the NAS typecheck.
  const layoutPreview =
    process.env.NODE_ENV !== 'production' && params.get('preview') === '1'
  const showDone = done || isDeviceAuthorizedPreview(layoutPreview, params.get('step'))
  const authorizedCopy = deviceAuthorizedCopy()

  useEffect(() => {
    document.title = showDone ? authorizedCopy.title : 'Autorizar dispositivo'
  }, [authorizedCopy.title, showDone])

  if (!layoutPreview && ready && !authenticated) {
    const next = deviceVerificationPath(userCode || initial)
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError('Entre de novo para autorizar este dispositivo.')
        return
      }
      const res = await fetch('/api/oauth/device/approve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_code: userCode.trim().toUpperCase() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error || `Não foi possível autorizar (${res.status}).`)
        return
      }
      setDone(true)
    } catch {
      setError('Falha de rede. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  if (!layoutPreview && !ready) {
    return (
      <div className={page.page}>
        <main className={page.main}>
          <p className={page.status}>Carregando…</p>
        </main>
      </div>
    )
  }

  return (
    <div className={page.page}>
      <header className={page.top}>
        <a className={page.brand} href="https://work4you.ai/" aria-label="Work4You">
          <img src="/brand/work4you-logo.png" alt="Work4You" width={160} height={16} />
        </a>
        <a className={page.homeLink} href="https://work4you.ai/">
          Voltar ao site
        </a>
      </header>

      <main className={page.main}>
        {showDone ? (
          <section className={styles.doneCard} aria-labelledby="device-title">
            <div className={styles.doneIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M8.2 12.25 10.75 14.8 15.85 9.4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 id="device-title" className={styles.doneTitle}>
              {authorizedCopy.title}
            </h1>
            <p className={styles.doneHint}>{authorizedCopy.hint}</p>
          </section>
        ) : (
          <section className={page.card} aria-labelledby="device-title">
            <p className={page.eyebrow}>Desktop</p>
            <h1 id="device-title" className={page.title}>
              Autorizar dispositivo
            </h1>
            <p className={styles.lead}>
              Confirme o código abaixo para ligar o Work4You Desktop à sua conta.
            </p>
            <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
              <label className={page.label} htmlFor="user-code">
                Código do dispositivo
              </label>
              <input
                id="user-code"
                className={`${page.input} ${styles.code}`}
                value={userCode}
                onChange={(e) => setUserCode(normalizeDeviceUserCode(e.target.value))}
                autoComplete="one-time-code"
                spellCheck={false}
                aria-label="Código do dispositivo"
              />
              {error ? <p className={page.notice}>{error}</p> : null}
              <button
                type="submit"
                className={page.primary}
                disabled={busy || !canSubmit}
              >
                {busy ? 'A autorizar…' : 'Autorizar'}
              </button>
            </form>
          </section>
        )}
      </main>

      <footer className={page.footer}>
        <Link to="/login">portal.work4you.ai</Link>
        <span aria-hidden="true">·</span>
        <a href="https://work4you.ai/docs/">Docs</a>
      </footer>
    </div>
  )
}
