import type { ReactNode } from 'react'
import styles from './Scene.module.css'

interface SceneProps {
  src: string
  children: ReactNode
  tall?: boolean
}

export function Scene({ src, children, tall = false }: SceneProps) {
  return (
    <div className={`${styles.scene} ${tall ? styles.tall : ''}`} aria-hidden="true">
      <img src={src} alt="" className={styles.bg} />
      <div className={styles.stage}>{children}</div>
    </div>
  )
}
