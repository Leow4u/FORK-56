import { DesktopShot } from './DesktopShot'
import { FeatureBand } from './FeatureBand'
import { Scene } from './Scene'

export function Tools() {
  return (
    <FeatureBand
      id="ferramentas"
      title="Conecta as ferramentas que você já usa."
      scene={
        <Scene src="/media/pine-fog.png" position="center 80%">
          <DesktopShot
            src="/media/product/capabilities.jpg"
            alt="Work4You desktop — Capabilities / MCP"
          />
        </Scene>
      }
    >
      <p>
        Capabilities / MCP: Gmail, Calendar, Slack, Notion, GitHub. O agente lê,
        agenda e registra sem sair do Work4You.
      </p>
    </FeatureBand>
  )
}
