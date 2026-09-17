import { Scene } from './Scene'
import styles from './ContactSoon.module.css'

export function ContactSoon() {
  return (
    <section className={styles.page} aria-labelledby="contact-title">
      <Scene
        src="/media/night-forest.jpg"
        tall
        bleed
        position="center 42%"
        className={styles.scene}
      >
        <div className={styles.card}>
          <p className="mono-label">Contato</p>
          <h1 id="contact-title" className={styles.title}>
            Fale conosco
          </h1>
          <p className={styles.soon}>Em breve</p>
          <p className={styles.lead}>
            Esta página ainda está sendo construída. Enquanto isso, o GitHub e o
            portal continuam abertos.
          </p>
          <div className={styles.links}>
            <a href="https://github.com/Leow4u/FORK-56">GitHub</a>
            <a href="https://portal.work4you.ai/login">Fazer login</a>
          </div>
        </div>
      </Scene>
    </section>
  )
}
