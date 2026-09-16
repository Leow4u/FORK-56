import styles from './ContactSoon.module.css'

export function ContactSoon() {
  return (
    <section className={styles.page} aria-labelledby="contact-title">
      <div className={`shell ${styles.inner}`}>
        <p className="mono-label">Contato</p>
        <h1 id="contact-title" className={styles.title}>
          Fale conosco
        </h1>
        <p className={styles.soon}>Em breve.</p>
        <p className={styles.lead}>
          Esta página ainda está sendo construída. Volte em breve.
        </p>
      </div>
    </section>
  )
}
