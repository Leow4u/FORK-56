import { HeroCtas } from './Ctas'
import {
  ProductWindow,
  RailItem,
  RailLabel,
} from './ProductWindow'
import { Scene } from './Scene'
import styles from './Hero.module.css'

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <div className={`shell ${styles.intro}`}>
        <p className="mono-label">Open source · MIT license</p>
        <h1 className={styles.title}>Agente de IA que cresce com você.</h1>
        <HeroCtas />
      </div>

      <div className={`shell ${styles.visual}`}>
        <Scene src="/media/hero-hills.jpg" tall>
          <ProductWindow
            title="Sessions · Nova sessão"
            sidebar={
              <>
                <RailLabel>Projetos</RailLabel>
                <RailItem>Home</RailItem>
                <RailItem current>Briefing das 9h</RailItem>
                <RailItem>Relatório semanal</RailItem>
              </>
            }
            footer={
              <div className={styles.composer}>
                <span>Comece com uma meta…</span>
                <em>Operis 4.0 Médio</em>
              </div>
            }
          >
            <p className={styles.empty}>Pronto quando você estiver.</p>
          </ProductWindow>
        </Scene>
      </div>
    </section>
  )
}
