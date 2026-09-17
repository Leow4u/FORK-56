import { DesktopShot } from './DesktopShot'
import { HeroCtas } from './Ctas'
import { Scene } from './Scene'
import styles from './Hero.module.css'

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <div className={`shell ${styles.intro}`}>
        <h1 className={styles.title}>Agente de IA que cresce com você.</h1>
        <HeroCtas />
      </div>

      <div className={styles.visual}>
        <Scene src="/media/hero-hills.jpg" tall position="center 42%">
          <DesktopShot
            src="/media/product/sessions.jpg"
            alt="Work4You desktop — Sessions"
          />
        </Scene>
      </div>
    </section>
  )
}
