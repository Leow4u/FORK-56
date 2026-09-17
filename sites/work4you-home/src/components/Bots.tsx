import { FeatureBand } from './FeatureBand'
import {
  Bubble,
  Mention,
  ProductWindow,
  RailItem,
  RailLabel,
} from './ProductWindow'
import { Scene } from './Scene'

export function Bots() {
  return (
    <FeatureBand
      id="bots"
      eyebrow="No mesmo app"
      title="Bots que trabalham juntos. Sem outro download."
      scene={
        <Scene src="/media/dawn-valley.png" position="center 70%">
          <ProductWindow
            title="Bots · Fechamento da semana"
            sidebar={
              <>
                <RailLabel>Ativos agora</RailLabel>
                <RailItem live current>
                  Analista Financeiro
                </RailItem>
                <RailItem live>Relatórios</RailItem>
                <RailItem>Triagem de inbox</RailItem>
                <RailItem>Pesquisa</RailItem>
                <RailItem>Work4You</RailItem>
              </>
            }
          >
            <Bubble author="Você">
              Fechem a semana e agendem o briefing de segunda.
            </Bubble>
            <Bubble author="Analista" kind="bot">
              <Mention>@Relatórios</Mention>, os números fecharam. Preciso do
              PDF.
            </Bubble>
            <Bubble author="Relatórios" kind="bot">
              Planilha pronta. Envio no grupo.
            </Bubble>
            <Bubble author="Work4You" kind="bot">
              Cron das 9h criado neste chat.
            </Bubble>
          </ProductWindow>
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
