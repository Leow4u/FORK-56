import { DesktopShot } from './DesktopShot'
import { FeatureBand } from './FeatureBand'
import { Scene } from './Scene'

export function Bots() {
  return (
    <FeatureBand
      id="bots"
      stack
      eyebrow="No mesmo app"
      title="Bots que trabalham juntos. Sem outro download."
      scene={
        <Scene src="/media/dawn-valley.png" position="center 70%">
          <DesktopShot
            src="/media/product/bots.jpg"
            alt="Work4You desktop — Bots em group chat"
          />
        </Scene>
      }
    >
      <p>
        No Cursor, o Grok Bot é um produto à parte — “Baixe o Grok Bot”. No
        Work4You os bots já estão na aba <em>Bots</em>: criam-se, falam entre si
        e viram cron.
      </p>
      <p>Uma instalação. Uma memória.</p>
    </FeatureBand>
  )
}
