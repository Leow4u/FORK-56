/**
 * Native Electron proof that a file:// renderer can paint Composio marks
 * through the privileged work4you-logo scheme + net.fetch — the same path
 * packaged Desktop uses. Not a unit mock.
 *
 *   SHOW=1 node scripts/run-composio-logo-native.mjs
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { app, BrowserWindow, net as electronNet, protocol } from 'electron'

import {
  bindComposioLogoNetFetch,
  COMPOSIO_LOGO_PROTOCOL,
  handleComposioLogoProtocol
} from './composio-logo'

const SHOW = process.env.SHOW === '1'
const runtimeDir = mkdtempSync(join(tmpdir(), 'work4you-composio-logo-'))

app.setPath('userData', runtimeDir)
app.setPath('sessionData', runtimeDir)

protocol.registerSchemesAsPrivileged([
  {
    scheme: COMPOSIO_LOGO_PROTOCOL,
    privileges: {
      corsEnabled: true,
      secure: true,
      standard: true,
      supportFetchAPI: true
    }
  }
])

const APPS = [
  { slug: 'gmail', name: 'Gmail' },
  { slug: 'slack', name: 'Slack' },
  { slug: 'hubspot', name: 'HubSpot' },
  { slug: 'canva', name: 'Canva' },
  { slug: 'n8n', name: 'n8n' },
  { slug: 'unreal-engine', name: 'Unreal Engine' }
]

const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Work4You MCP logos (file://)</title></head>
<body style="margin:0;background:#faf9f5;font-family:ui-sans-serif,system-ui,sans-serif">
  <main style="max-width:720px;margin:0 auto;padding:28px 24px">
    <p style="font:600 11px/1.2 ui-sans-serif,system-ui;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin:0 0 6px">Capabilities · MCP</p>
    <h1 style="font:600 18px/1.3 ui-sans-serif,system-ui;margin:0 0 8px">Official marks on file://</h1>
    <p id="origin" style="font:400 12px/1.45 ui-sans-serif,system-ui;color:#52525b;margin:0 0 18px"></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${APPS.map(
        app => `<article data-slug="${app.slug}" style="margin:0;padding:14px 16px;background:#fff;border-radius:12px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 2px rgba(0,0,0,.06);ring:1px solid #e4e4e7">
        <span style="display:grid;place-items:center;width:32px;height:32px;background:#fff;border-radius:8px;flex:none">
          <img alt="${app.slug}" src="${COMPOSIO_LOGO_PROTOCOL}://mark/${app.slug}" width="20" height="20" style="object-fit:contain">
        </span>
        <span style="font:600 13px/1.3 ui-sans-serif,system-ui;flex:1">${app.name}</span>
        <span style="font:500 12px/1 ui-sans-serif,system-ui;color:#3f3f46">Connect</span>
      </article>`
      ).join('')}
    </div>
  </main>
  <script>
    document.getElementById('origin').textContent =
      location.protocol + ' renderer · work4you-logo protocol · ' + location.href
  </script>
</body>
</html>`

async function measureImages(window) {
  return await window.webContents.executeJavaScript(`
    Promise.all([...document.querySelectorAll('img')].map(img => {
      const wait = img.complete
        ? Promise.resolve()
        : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }) })
      return wait.then(() => ({
        slug: img.alt,
        ok: img.naturalWidth > 0,
        src: img.currentSrc || img.src,
        w: img.naturalWidth,
        h: img.naturalHeight
      }))
    }))
  `)
}

async function run() {
  protocol.handle(
    COMPOSIO_LOGO_PROTOCOL,
    request => handleComposioLogoProtocol(request, bindComposioLogoNetFetch(electronNet.fetch.bind(electronNet)))
  )

  const window = new BrowserWindow({
    show: SHOW,
    x: 40,
    y: 40,
    width: 780,
    height: 520,
    backgroundColor: '#f4f4f5',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  const fixturePath = join(runtimeDir, 'fixture.html')
  writeFileSync(fixturePath, html)
  await window.loadFile(fixturePath)
  const results = await measureImages(window)
  const failed = results.filter(row => !row.ok)

  process.stdout.write(`${JSON.stringify({ origin: window.webContents.getURL(), results }, null, 2)}\n`)

  if (failed.length) {
    throw new Error(`logos failed to paint: ${failed.map(row => row.slug).join(', ')}`)
  }

  if (SHOW) {
    const holdMs = Number.parseInt(process.env.SHOW_MS || '40000', 10)
    await new Promise(resolve => setTimeout(resolve, Number.isFinite(holdMs) ? holdMs : 40_000))
  }

  window.close()
}

app.whenReady().then(() =>
  run()
    .then(() => app.exit(0))
    .catch(error => {
      console.error(error)
      app.exit(1)
    })
)
