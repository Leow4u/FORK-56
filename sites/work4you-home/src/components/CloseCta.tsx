import { CloseDownload } from './Ctas'
import { InstallPanel } from './InstallPanel'
import { Scene } from './Scene'
import styles from './CloseCta.module.css'

export function CloseCta() {
  return (
    <section className={styles.section} id="download">
      <Scene
        src="/media/studio-mist.jpg"
        tall
        bleed
        position="center 32%"
        className={styles.scene}
      >
        <div className={styles.card}>
          <h2 className={styles.title}>Experimente o Work4You agora.</h2>
          <div className={styles.download}>
            <CloseDownload />
          </div>
          <InstallPanel />
        </div>
      </Scene>
    </section>
  )
}
