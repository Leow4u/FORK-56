import { DesktopShot } from './DesktopShot'
import { FeatureBand } from './FeatureBand'
import { Platforms } from './Platforms'
import { Scene } from './Scene'

export function Channels() {
  return (
    <FeatureBand
      id="canais"
      flip
      title="O mesmo agente, no WhatsApp e no terminal."
      scene={
        <Scene src="/media/river-mist.png" position="center 55%">
          <DesktopShot
            src="/media/product/messaging.jpg"
            alt="Work4You desktop — Messaging, WhatsApp"
          />
        </Scene>
      }
    >
      <p>
        Uma memória. Várias superfícies. O gateway já é o produto — não um
        add-on.
      </p>
      <Platforms />
    </FeatureBand>
  )
}
