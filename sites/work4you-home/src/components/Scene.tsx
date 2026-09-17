import type { ReactNode } from 'react'
import styles from './Scene.module.css'

interface SceneProps {
  src: string
  children: ReactNode
  tall?: boolean
  position?: string
}

export function Scene({
  src,
  children,
  tall = false,
  position = 'center',
}: SceneProps) {
  return (
    <div
      className={`${styles.scene} ${tall ? styles.tall : ''}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        className={styles.bg}
        style={{ objectPosition: position }}
      />
      <div className={styles.stage}>{children}</div>
    </div>
  )
}
