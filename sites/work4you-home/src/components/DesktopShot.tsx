import styles from './DesktopShot.module.css'

export function DesktopShot({ src }: { src: string }) {
  return <img className={styles.shot} src={src} alt="" />
}
