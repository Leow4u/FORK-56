import styles from './DesktopShot.module.css'

interface DesktopShotProps {
  src: string
  alt: string
}

export function DesktopShot({ src, alt }: DesktopShotProps) {
  return (
    <div className={styles.lift}>
      <figure className={styles.frame}>
        <img className={styles.shot} src={src} alt={alt} />
      </figure>
    </div>
  )
}
