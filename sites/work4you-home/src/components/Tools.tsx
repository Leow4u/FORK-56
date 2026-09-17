import { FeatureBand } from './FeatureBand'
import { ConnectCard, ProductWindow, Bubble } from './ProductWindow'
import { Scene } from './Scene'
import styles from './Tools.module.css'

const APPS = [
  { name: 'Gmail', icon: '/brand/apps/gmail.svg' },
  { name: 'Slack', icon: '/brand/apps/slack.svg' },
  { name: 'Notion', icon: '/brand/apps/notion.svg' },
  { name: 'Calendar', icon: '/brand/apps/googlecalendar.svg' },
] as const

export function Tools() {
  return (
    <FeatureBand
      id="ferramentas"
      title="Conecta as ferramentas que você já usa."
      scene={
        <Scene src="/media/pine-fog.png">
          <ProductWindow title="Capabilities · MCP">
            <div className={styles.grid}>
              {APPS.map((app) => (
                <ConnectCard key={app.name} icon={app.icon} name={app.name} />
              ))}
            </div>
            <Bubble kind="bot">
              “Li a caixa de entrada e marquei o briefing no Calendar.”
            </Bubble>
          </ProductWindow>
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
