import { directoryAppLogoUrl } from '@work4you/shared'
import { createRoot } from 'react-dom/client'

import { McpAvatar } from '@/app/skills/mcp-avatar'

/** The same catalog rows Capabilities → MCP feeds McpAvatar. */
const APPS = [
  { id: 'gmail', name: 'Gmail', source: 'composio' as const },
  { id: 'slack', name: 'Slack', source: 'composio' as const },
  { id: 'hubspot', name: 'HubSpot', source: 'composio' as const },
  { id: 'canva', name: 'Canva', source: 'composio' as const },
  { id: 'n8n', name: 'n8n', source: 'native' as const },
  { id: 'unreal-engine', name: 'Unreal Engine', source: 'native' as const }
]

function App() {
  return (
    <main>
      <p className="kicker">Capabilities · MCP</p>
      <h1>Official marks on file://</h1>
      <p className="origin">
        {window.location.protocol} renderer · McpAvatar + net.fetch data URL · {window.location.href}
      </p>
      <div className="grid">
        {APPS.map(app => (
          <article data-slug={app.id} key={app.id}>
            <McpAvatar logo={directoryAppLogoUrl(app)} name={app.id} status="unknown" />
            <span className="name">{app.name}</span>
            <span className="action">Connect</span>
          </article>
        ))}
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
