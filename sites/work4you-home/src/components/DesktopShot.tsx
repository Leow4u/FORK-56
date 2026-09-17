import styles from './DesktopShot.module.css'

interface DesktopShotProps {
  src: string
  alt: string
}

export function DesktopShot({ src, alt }: DesktopShotProps) {
  return <img className={styles.shot} src={src} alt={alt} />
}
