import { useEffect, useState } from 'react'
import styles from './DesktopShot.module.css'

interface DesktopShotProps {
  src: string
  alt: string
  video?: string
}

export function DesktopShot({ src, alt, video }: DesktopShotProps) {
  const [motionOk, setMotionOk] = useState(false)

  useEffect(() => {
    if (!video) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setMotionOk(!query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [video])

  return (
    <div className={styles.lift}>
      <figure className={styles.frame}>
        {video && motionOk ? (
          <video
            className={styles.shot}
            src={video}
            poster={src}
            muted
            loop
            playsInline
            autoPlay
            aria-label={alt}
          />
        ) : (
          <img className={styles.shot} src={src} alt={alt} />
        )}
      </figure>
    </div>
  )
}
