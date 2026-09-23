import { FeatureBand } from './FeatureBand'
import { Scene } from './Scene'

export function Bots() {
  return (
    <FeatureBand
      id="bots"
      eyebrow="Times de IA"
      title="Delegue trabalho a colegas de equipe de IA."
      scene={<Scene src="/media/dawn-valley.png" wide position="center 70%" />}
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
