import { CloseDownload } from './Ctas'
import { Fig } from './Fig'
import { InstallPanel } from './InstallPanel'
import styles from './CloseCta.module.css'
import { Tight } from './Tight'

const STEPS = ['Baixe o app', 'Conecte seus canais', 'Mande a primeira tarefa'] as const

export function CloseCta() {
  return (
    <section aria-labelledby="download-title" className={styles.section} id="download">
      <div className="shell">
        <Fig label="Instalação" number="08" tag="Pronto em minutos" tone="ink" />
        <div className={styles.split}>
          <div>
            <h2 className={styles.title} id="download-title">
              <Tight text="Coloque o Work4You para trabalhar." />
            </h2>
            <ol className={styles.steps}>
              {STEPS.map((step, index) => (
                <li key={step}>
                  <span className="mono-label">{String(index + 1).padStart(2, '0')}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.card}>
            <div className={styles.download}>
              <CloseDownload />
            </div>
            <InstallPanel />
          </div>
        </div>
      </div>
    </section>
  )
}
