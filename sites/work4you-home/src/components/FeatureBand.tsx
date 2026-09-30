import type { ReactNode } from 'react'
import { Fig } from './Fig'
import styles from './FeatureBand.module.css'
import { Tight } from './Tight'

interface FeatureBandProps {
  children: ReactNode
  fig: { label: string; number: string; tag?: string }
  flip?: boolean
  id: string
  title: string
  /** O painel em HTML que mostra a funcionalidade trabalhando. */
  visual: ReactNode
}

export function FeatureBand({ children, fig, flip = false, id, title, visual }: FeatureBandProps) {
  return (
    <section aria-labelledby={`${id}-title`} className={styles.section} id={id}>
      <div className="shell">
        <Fig label={fig.label} number={fig.number} tag={fig.tag} />
        <div className={flip ? `${styles.split} ${styles.flip}` : styles.split}>
          <div className={styles.copy}>
            <h2 className={styles.title} id={`${id}-title`}>
              <Tight text={title} />
            </h2>
            <div className={styles.body}>{children}</div>
          </div>
          <div className={styles.visual}>{visual}</div>
        </div>
      </div>
    </section>
  )
}
