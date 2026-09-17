import type { ReactNode } from 'react'
import styles from './Scene.module.css'

interface SceneProps {
  src: string
  children: ReactNode
  tall?: boolean
  wide?: boolean
  bleed?: boolean
  position?: string
  className?: string
}

export function Scene({
  src,
  children,
  tall = false,
  wide = false,
  bleed = false,
  position = 'center',
  className,
}: SceneProps) {
  const sceneClass = [
    styles.scene,
    tall ? styles.tall : '',
    wide ? styles.wide : '',
    bleed ? styles.bleed : styles.frame,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={sceneClass}>
      <img
        src={src}
        alt=""
        className={styles.bg}
        style={{ objectPosition: position }}
        aria-hidden="true"
      />
      <div className={styles.stage}>{children}</div>
    </div>
  )
}
