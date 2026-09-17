import { CloseDownload } from './Ctas'
import { InstallPanel } from './InstallPanel'
import styles from './CloseCta.module.css'

export function CloseCta() {
  return (
    <section className={styles.section} id="download">
      <div className={`shell ${styles.inner}`}>
        <h2 className={styles.title}>Experimente o Work4You agora.</h2>
        <div className={styles.download}>
          <CloseDownload />
        </div>
        <InstallPanel />
      </div>
    </section>
  )
}
