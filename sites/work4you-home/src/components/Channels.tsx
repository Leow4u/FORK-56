import { FeatureBand } from './FeatureBand'
import { Glyph } from './Glyph'
import { Icon } from './Icon'
import { Platforms } from './Platforms'
import styles from './Channels.module.css'

/** Um pedido feito no WhatsApp, lembrado no terminal e cumprido no Slack. */
export function Channels() {
  return (
    <FeatureBand
      fig={{ label: 'Canais', number: '04', tag: 'Uma memória' }}
      flip
      id="canais"
      title="O mesmo agente, no WhatsApp e no terminal."
      visual={
        <ol className={styles.surfaces}>
          <li className={styles.surface}>
            <p className={`mono-label ${styles.where}`}>
              <Glyph name="whatsapp" /> WhatsApp · 09:12
            </p>
            <div className={styles.chat}>
              <p className={`${styles.bubble} ${styles.mine}`}>Me lembra de cobrar a Atlas na sexta às 10h</p>
              <p className={styles.bubble}>Combinado: sexta, 10:00. Eu aviso no #financeiro.</p>
            </div>
          </li>

          <li className={`${styles.surface} ${styles.terminal}`}>
            <p className={`mono-label ${styles.where}`}>
              <Icon className={styles.whereIcon} name="terminal" /> Terminal · 14:30
            </p>
            <pre className={styles.code}>
              <span className={styles.prompt}>$</span> work4you{'\n'}
              <span className={styles.prompt}>›</span> o que eu combinei com a Atlas?{'\n'}
              <span className={styles.answer}>
                Cobrar a NF 2231 na sexta, 10:00. Você pediu pelo WhatsApp hoje às 09:12.
              </span>
            </pre>
          </li>

          <li className={styles.surface}>
            <p className={`mono-label ${styles.where}`}>
              <Glyph name="slack" /> Slack · #financeiro · sexta 10:00
            </p>
            <p className={styles.post}>
              <b>Work4You</b> <span className={styles.app}>APP</span>
              <br />
              Lembrete: cobrar a Atlas (NF 2231) hoje. Mandei a 2ª via por e-mail às 10:00.
            </p>
          </li>
        </ol>
      }
    >
      <p>Uma memória, várias superfícies. O que você pede em um canal, o agente lembra em todos os outros.</p>
      <Platforms />
    </FeatureBand>
  )
}
