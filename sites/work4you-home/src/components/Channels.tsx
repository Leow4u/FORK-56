import { FeatureBand } from './FeatureBand'
import { Platforms } from './Platforms'
import { Bubble, ProductWindow, RailItem } from './ProductWindow'
import { Scene } from './Scene'

export function Channels() {
  return (
    <FeatureBand
      id="canais"
      title="O mesmo agente, no WhatsApp e no terminal."
      flip
      scene={
        <Scene src="/media/river-mist.png">
          <ProductWindow
            title="Messaging · WhatsApp ligado"
            sidebar={
              <>
                <RailItem live current>
                  WhatsApp
                </RailItem>
                <RailItem>Telegram</RailItem>
                <RailItem>Slack</RailItem>
                <RailItem>Discord</RailItem>
                <RailItem>E-mail</RailItem>
              </>
            }
          >
            <Bubble kind="bot">
              WhatsApp · Briefing das 9h entregue no grupo Operações.
            </Bubble>
            <Bubble>Parear com QR · sem token extra</Bubble>
          </ProductWindow>
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
