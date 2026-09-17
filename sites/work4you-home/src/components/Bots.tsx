import { DesktopShot } from './DesktopShot'
import { FeatureBand } from './FeatureBand'
import { Scene } from './Scene'

export function Bots() {
  return (
    <FeatureBand
      id="bots"
      eyebrow="Times de IA"
      title="Delegue trabalho a colegas de equipe de IA."
      wideVisual
      scene={
        <Scene src="/media/dawn-valley.png" wide position="center 70%">
          <DesktopShot
            src="/media/product/bots-loop.jpg"
            video="/media/product/bots-loop.mp4"
            alt="Work4You: um time de bots no group chat, dividindo o trabalho e decidindo juntos."
          />
        </Scene>
      }
    >
      <p>
        Os bots acessam suas ferramentas, usam como você e voltam com o
        trabalho concluído.
      </p>
      <p>
        Crie times de IA que trabalham pra você. Tomam decisões. Perguntam
        quando precisam perguntar.
      </p>
    </FeatureBand>
  )
}
