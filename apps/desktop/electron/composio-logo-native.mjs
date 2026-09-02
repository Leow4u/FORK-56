/**
 * Native Electron proof that Capabilities → MCP avatars paint Composio marks
 * on a file:// renderer. Uses the real `McpAvatar` + `directoryAppLogoUrl`
 * path and Chromium `net.fetch` → data URL IPC — not a hardcoded <img>.
 *
 *   SHOW=1 node scripts/run-composio-logo-native.mjs
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, ipcMain, net as electronNet } from 'electron'

import { bindComposioLogoNetFetch, fetchComposioLogoDataUrl } from './composio-logo'

app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')

const SHOW = process.env.SHOW === '1'
const runtimeDir = mkdtempSync(join(tmpdir(), 'work4you-composio-logo-'))
const here = dirname(fileURLToPath(import.meta.url))

app.setPath('userData', runtimeDir)
app.setPath('sessionData', runtimeDir)

const PRELOAD = join(runtimeDir, 'preload.cjs')
writeFileSync(
  PRELOAD,
  `'use strict'
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('work4youDesktop', {
  fetchComposioLogo: url => ipcRenderer.invoke('work4you:composio-logo', url)
})
`
)

const rendererJs = readFileSync(join(here, 'mcp-avatar-native-renderer.js'), 'utf8')
writeFileSync(join(runtimeDir, 'renderer.js'), rendererJs)

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Work4You MCP logos (file://)</title>
  <style>
    html, body { margin: 0; background: #faf9f5; color: #18181b;
      font-family: ui-sans-serif, system-ui, sans-serif; }
    main { max-width: 720px; margin: 0 auto; padding: 28px 24px; }
    .kicker { font: 600 11px/1.2 ui-sans-serif, system-ui; letter-spacing: .08em;
      text-transform: uppercase; color: #71717a; margin: 0 0 6px; }
    h1 { font: 600 18px/1.3 ui-sans-serif, system-ui; margin: 0 0 8px; }
    .origin { font: 400 12px/1.45 ui-sans-serif, system-ui; color: #52525b; margin: 0 0 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    article { margin: 0; padding: 14px 16px; background: #fff; border-radius: 12px;
      display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    .name { font: 600 13px/1.3 ui-sans-serif, system-ui; flex: 1; }
    .action { font: 500 12px/1 ui-sans-serif, system-ui; color: #3f3f46; }
    .size-8 { width: 32px; height: 32px; }
    .size-5 { width: 20px; height: 20px; }
    .size-4 { width: 16px; height: 16px; }
    .inline-grid { display: inline-grid; }
    .place-items-center { place-items: center; }
    .rounded-md { border-radius: 8px; }
    .object-contain { object-fit: contain; }
    .shrink-0 { flex-shrink: 0; }
    .relative { position: relative; }
    .bg-white { background: #fff; }
    .absolute { position: absolute; }
    .-bottom-0\\.5 { bottom: -2px; }
    .-right-0\\.5 { right: -2px; }
    .size-2 { width: 8px; height: 8px; }
    .rounded-full { border-radius: 999px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="./renderer.js"></script>
</body>
</html>`

async function measureImages(window) {
  return await window.webContents.executeJavaScript(`
    (async () => {
      const deadline = Date.now() + 20000
      const poll = () => [...document.querySelectorAll('[data-mcp-avatar]')].map(img => ({
        slug: img.getAttribute('data-mcp-avatar'),
        ok: img.naturalWidth > 0,
        srcKind: (img.currentSrc || img.src).startsWith('data:image/') ? 'data' : (img.currentSrc || img.src).slice(0, 24),
        w: img.naturalWidth,
        h: img.naturalHeight
      }))
      while (Date.now() < deadline) {
        const rows = poll()
        if (rows.length >= 6 && rows.every(row => row.ok && row.srcKind === 'data')) return rows
        await new Promise(r => setTimeout(r, 150))
      }
      return poll()
    })()
  `)
}

async function run() {
  ipcMain.handle('work4you:composio-logo', async (_event, url) => {
    try {
      return await fetchComposioLogoDataUrl(
        String(url || ''),
        bindComposioLogoNetFetch(electronNet.fetch.bind(electronNet))
      )
    } catch {
      return null
    }
  })

  const window = new BrowserWindow({
    show: SHOW,
    x: 40,
    y: 40,
    width: 780,
    height: 560,
    backgroundColor: '#f4f4f5',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD,
      sandbox: true,
      webSecurity: true
    }
  })

  const fixturePath = join(runtimeDir, 'index.html')
  writeFileSync(fixturePath, html)
  await window.loadFile(fixturePath)
  const origin = window.webContents.getURL()
  const results = await measureImages(window)
  const failed = results.filter(row => !row.ok || row.srcKind !== 'data')

  process.stdout.write(`${JSON.stringify({ origin, results }, null, 2)}\n`)

  if (!origin.startsWith('file:')) {
    throw new Error(`expected file:// origin, got ${origin}`)
  }

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
