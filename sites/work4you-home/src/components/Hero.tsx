import { useState } from 'react'
import { HeroCtas } from './Ctas'
import { HeroRace } from './HeroRace'
import styles from './Hero.module.css'

const SPEC = [
  { label: 'Canais', value: '20+ integrações' },
  { label: 'Superfícies', value: 'Desktop, terminal e chat' },
  { label: 'Memória', value: 'Aprende e cria skills' },
  { label: 'Rotinas', value: 'Agenda em linguagem natural' },
] as const

export function Hero() {
  const [workDone, setWorkDone] = useState(false)

  return (
    <section aria-labelledby="hero-title" className={styles.hero} id="top">
      <div className="shell">
        <div className={`mono-label ${styles.fig}`}>
          <span>Fig. 01 — Conversa × Trabalho</span>
          <span className={styles.live}>
            <i aria-hidden="true" className={styles.dot} />
            Demonstração ao vivo
          </span>
        </div>

        <h1 className={styles.thesis} id="hero-title">
          <span className={styles.talk}>
            Chatbots{' '}
            <br />
            conversam.
          </span>{' '}
          <span className={styles.work}>
            O Work4You{' '}
            <br />
            <span className={workDone ? `${styles.underline} ${styles.drawn}` : styles.underline}>trabalha.</span>
          </span>
        </h1>

        <div className={styles.subs}>
          <p className={styles.subTalk}>Respondem com um texto bem escrito. O trabalho continua com você.</p>
          <div className={styles.subWork}>
            <p>
              Atende clientes no WhatsApp, fecha planilhas, cobra, agenda e aprende o seu jeito de trabalhar. No
              desktop, no terminal e nos seus canais.
            </p>
            <HeroCtas />
          </div>
        </div>

        <HeroRace onWorkDone={setWorkDone} />

        <dl className={styles.spec}>
          {SPEC.map((item) => (
            <div key={item.label}>
              <dt className="mono-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
