import type { ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps {
  children: ReactNode
  footer?: ReactNode
  meta?: ReactNode
  /** ink: o Work4You trabalhando (como a raia do hero). paper: documentos e tabelas. */
  tone?: 'ink' | 'paper'
  title: ReactNode
}

/** Janela com cabeçalho em mono, a mesma linguagem das raias do hero. */
export function Panel({ children, footer, meta, tone = 'paper', title }: PanelProps) {
  return (
    <div className={tone === 'ink' ? `${styles.panel} ${styles.ink}` : styles.panel}>
      <div className={`mono-label ${styles.head}`}>
        <span className={styles.title}>{title}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
      <div className={styles.body}>{children}</div>
      {footer ? <div className={`mono-label ${styles.foot}`}>{footer}</div> : null}
    </div>
  )
}
