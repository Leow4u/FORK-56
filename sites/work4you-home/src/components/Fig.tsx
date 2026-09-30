import styles from './Fig.module.css'

interface FigProps {
  label: string
  /** Pulsa quando o que a figura mostra está acontecendo agora. */
  live?: boolean
  number: string
  tag?: string
  tone?: 'ink' | 'paper'
}

/** Rótulo de figura no topo de cada seção, como num manual técnico. */
export function Fig({ label, live = false, number, tag, tone = 'paper' }: FigProps) {
  return (
    <div className={`mono-label ${styles.fig} ${tone === 'ink' ? styles.ink : ''}`}>
      <span>
        Fig. {number} — {label}
      </span>
      {tag ? (
        <span className={styles.tag}>
          <i aria-hidden="true" className={live ? `${styles.dot} ${styles.live}` : styles.dot} />
          {tag}
        </span>
      ) : null}
    </div>
  )
}
