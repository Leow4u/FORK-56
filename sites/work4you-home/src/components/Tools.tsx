import { DesktopShot } from './DesktopShot'
import { FeatureBand } from './FeatureBand'
import { Scene } from './Scene'

export function Tools() {
  return (
    <FeatureBand
      id="ferramentas"
      stack
      title="Conecta as ferramentas que você já usa."
      scene={
        <Scene src="/media/pine-fog.png" position="center 80%">
          <DesktopShot src="/media/product/capabilities.jpg" />
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
