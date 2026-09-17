import type { ReactNode } from 'react'
import styles from './ProductWindow.module.css'

interface ProductWindowProps {
  title: string
  sidebar?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export function ProductWindow({
  title,
  sidebar,
  footer,
  children,
}: ProductWindowProps) {
  return (
    <div className={styles.window}>
      <div className={styles.bar}>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={sidebar ? styles.body : styles.bodySolo}>
        {sidebar ? <aside className={styles.sidebar}>{sidebar}</aside> : null}
        <div className={styles.main}>
          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}

export function RailLabel({ children }: { children: ReactNode }) {
  return <p className={styles.railLabel}>{children}</p>
}

export function RailItem({
  children,
  live = false,
  current = false,
}: {
  children: ReactNode
  live?: boolean
  current?: boolean
}) {
  return (
    <span
      className={`${styles.railItem} ${live ? styles.live : ''} ${current ? styles.current : ''}`}
    >
      {live ? <i className={styles.dot} /> : null}
      {children}
    </span>
  )
}

export function Bubble({
  author,
  kind = 'user',
  children,
}: {
  author?: string
  kind?: 'user' | 'bot'
  children: ReactNode
}) {
  return (
    <p className={`${styles.bubble} ${kind === 'bot' ? styles.bot : ''}`}>
      {author ? <strong>{author}</strong> : null}
      {children}
    </p>
  )
}

export function Mention({ children }: { children: string }) {
  return <span className={styles.mention}>{children}</span>
}

export function Field({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: string
  tone?: 'plain' | 'ok'
}) {
  return (
    <div className={`${styles.field} ${tone === 'ok' ? styles.fieldOk : ''}`}>
      <span className={styles.fieldLabel}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function ConnectCard({
  icon,
  name,
}: {
  icon: string
  name: string
}) {
  return (
    <div className={styles.connect}>
      <img src={icon} alt="" width={18} height={18} />
      <span>{name}</span>
      <em>Conectar</em>
    </div>
  )
}
