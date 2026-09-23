import type { ReactNode } from 'react'
import styles from './FeatureBand.module.css'

interface FeatureBandProps {
  id: string
  eyebrow?: string
  title: string
  children: ReactNode
  scene: ReactNode
  flip?: boolean
}

export function FeatureBand({
  id,
  eyebrow,
  title,
  children,
  scene,
  flip = false,
}: FeatureBandProps) {
  return (
    <section className={styles.section} id={id}>
      <div className={`shell ${styles.split} ${flip ? styles.flip : ''}`}>
        <div className={styles.copy}>
          {eyebrow ? <p className="mono-label">{eyebrow}</p> : null}
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.body}>{children}</div>
        </div>
        <div className={styles.visual}>{scene}</div>
      </div>
    </section>
  )
}
