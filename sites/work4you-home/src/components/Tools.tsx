import type { GlyphName } from '../lib/glyphs'
import { FeatureBand } from './FeatureBand'
import { Glyph } from './Glyph'
import { Panel } from './Panel'
import styles from './Tools.module.css'

const TOOLS: { action: string; glyph: GlyphName; name: string }[] = [
  { glyph: 'gmail', name: 'Gmail', action: 'Lê, responde e arquiva e-mails' },
  { glyph: 'gcal', name: 'Google Calendar', action: 'Marca, remarca e confirma reuniões' },
  { glyph: 'sheets', name: 'Google Sheets', action: 'Lê e atualiza planilhas' },
  { glyph: 'gdrive', name: 'Google Drive', action: 'Encontra e organiza arquivos' },
  { glyph: 'slack', name: 'Slack', action: 'Posta resumos e responde no canal' },
  { glyph: 'notion', name: 'Notion', action: 'Cria páginas, atas e planos' },
  { glyph: 'hubspot', name: 'HubSpot', action: 'Registra e qualifica leads' },
]

export function Tools() {
  return (
    <FeatureBand
      fig={{ label: 'Ferramentas', number: '05', tag: 'Capabilities / MCP' }}
      id="ferramentas"
      title="Conecta as ferramentas que você já usa."
      visual={
        <Panel footer={<span>+ qualquer servidor MCP do catálogo</span>} meta={`${TOOLS.length} conectadas`} title="Capabilities">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Ferramenta</th>
                <th scope="col">O que o agente faz</th>
                <th scope="col">
                  <span className="sr-only">Estado</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => (
                <tr key={tool.name}>
                  <td>
                    <span className={styles.name}>
                      <Glyph name={tool.glyph} />
                      {tool.name}
                    </span>
                  </td>
                  <td className={styles.action}>{tool.action}</td>
                  <td className={styles.state}>
                    <span className={`mono-label ${styles.pill}`}>Conectado</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      }
    >
      <p>
        O agente lê, agenda e registra nas suas ferramentas sem você sair do Work4You. Conecte uma vez e cada bot usa
        como você usaria.
      </p>
    </FeatureBand>
  )
}
