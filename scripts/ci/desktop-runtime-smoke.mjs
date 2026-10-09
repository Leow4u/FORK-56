/** Real packaged Electron -> HTTP -> WebSocket smoke. No model/API credentials. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SESSION_ID = 'desktop-install-smoke-preserved-session'
const SENTINEL = 'desktop-install-smoke-preserved-data'
const preservedFiles = {
  '.env': `# ${SENTINEL}\n`,
  'skills/install-smoke/SKILL.md': `# Install smoke\n${SENTINEL}\n`,
  'memories/MEMORY.md': `${SENTINEL}\n`
}

export function samePath(actual, expected) {
  const normalize = value => {
    const resolved = path.resolve(value)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return typeof actual === 'string' && normalize(actual) === normalize(expected)
}

export function validateRuntime(runtime, { bundle, home, commit }) {
  assert.equal(runtime?.layout, 'app-owned', 'backend must use the app-owned runtime')
  assert(samePath(runtime.root, path.join(bundle, 'work4you')), 'runtime code root differs from installed resources/runtime/work4you')
  assert(samePath(runtime.work4youHome, home), 'effective data home changed')
  const relative = path.relative(bundle, runtime.pythonExecutable)
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Python escaped app runtime')
  assert.equal(runtime.commit, commit, 'running runtime and packaged commit differ')
}

export function verifyPreservedFiles(home) {
  for (const [relative, contents] of Object.entries(preservedFiles)) {
    assert.equal(fs.readFileSync(path.join(home, relative), 'utf8'), contents, `${relative} changed`)
  }
  assert(fs.readFileSync(path.join(home, 'config.yaml'), 'utf8').includes(SENTINEL), 'config sentinel disappeared')
}

function cleanEnvironment(home, userData) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/(?:_API_KEY|_TOKEN|_SECRET|_PASSWORD|_CREDENTIALS|_ACCESS_KEY|_PRIVATE_KEY)$/.test(key)))
  for (const key of ['PYTHONPATH', 'PYTHONHOME', 'VIRTUAL_ENV', 'UV_PROJECT_ENVIRONMENT',
    'WORK4YOU_DESKTOP_WORK4YOU_ROOT', 'WORK4YOU_DESKTOP_WORK4YOU', 'WORK4YOU_DESKTOP_IGNORE_EXISTING',
    'WORK4YOU_BUNDLED_RUNTIME', 'WORK4YOU_DESKTOP_TEST_MODE', 'WORK4YOU_DESKTOP_DEV_SERVER']) delete env[key]
  return { ...env, WORK4YOU_HOME: home, WORK4YOU_DESKTOP_USER_DATA_DIR: userData,
    PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1' }
}

export function seedData(home) {
  fs.mkdirSync(home, { recursive: true })
  for (const [relative, contents] of Object.entries(preservedFiles)) {
    const dest = path.join(home, relative)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, contents)
  }
  fs.writeFileSync(path.join(home, 'config.yaml'), `model: ${SENTINEL}\ndisplay:\n  theme: dark\n`)
}

function rpc(ws, method, params = {}) {
  const id = Math.random().toString(36).slice(2)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`RPC ${method} timed out`)), 30_000)
    const receive = event => {
      for (const line of String(event.data).split('\n').filter(Boolean)) {
        const response = JSON.parse(line)
        if (response.id === id) finish(response.error ? new Error(`RPC ${method}: ${response.error.message}`) : null, response.result)
      }
    }
    const closed = () => finish(new Error(`WebSocket closed during ${method}`))
    const finish = (error, value) => {
      clearTimeout(timeout)
      ws.removeEventListener('message', receive)
      ws.removeEventListener('close', closed)
      error ? reject(error) : resolve(value)
    }
    ws.addEventListener('message', receive)
    ws.addEventListener('close', closed)
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
  })
}

export async function probe({ executable, home, userData, expectedCommit, seedSession = false }) {
  const { _electron } = await import('playwright')
  const resources = process.platform === 'darwin'
    ? path.resolve(executable, '..', '..', 'Resources') : path.join(path.dirname(executable), 'resources')
  const bundle = path.join(resources, 'runtime')
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8'))
  const stamp = JSON.parse(fs.readFileSync(path.join(resources, 'install-stamp.json'), 'utf8'))
  assert.equal(manifest.present, true)
  assert.equal(manifest.layout, 'app-owned')
  assert.equal(manifest.commit, stamp.commit, 'shell/runtime package commit mismatch')
  if (expectedCommit) assert.equal(stamp.commit, expectedCommit, 'artifact differs from selected release commit')
  const env = cleanEnvironment(home, userData)
  if (seedSession) {
    const python = path.join(bundle, manifest.pythonExecutable)
    execFileSync(python, ['-c', [
      'from work4you_state import SessionDB',
      'db = SessionDB()',
      `db.create_session(${JSON.stringify(SESSION_ID)}, "desktop")`,
      `db.set_session_title(${JSON.stringify(SESSION_ID)}, ${JSON.stringify(SENTINEL)})`,
      `db.append_message(${JSON.stringify(SESSION_ID)}, "user", ${JSON.stringify(SENTINEL)})`,
      'db.close()'
    ].join('\n')], { env: { ...env, WORK4YOU_BUNDLED_RUNTIME: bundle,
      PYTHONPATH: path.join(bundle, 'work4you') }, cwd: home, timeout: 60_000, stdio: 'pipe' })
  }
  const started = performance.now()
  let app
  let ws
  try {
    app = await _electron.launch({ executablePath: executable, env, cwd: home, timeout: 180_000 })
    const page = await app.firstWindow({ timeout: 180_000 })
    await page.waitForFunction(() => Boolean(window.work4youDesktop), null, { timeout: 180_000 })
    const windowReadyMs = Math.round(performance.now() - started)
    // Connection readiness uses the same Electron resolver as the renderer.
    // Keep tokens in memory only; never serialize the connection descriptor.
    const connection = await Promise.race([
      page.evaluate(() => window.work4youDesktop.getConnection()),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Backend readiness timed out')), 180_000); timer.unref() })
    ])
    const health = await fetch(`${connection.baseUrl}/api/health`, { signal: AbortSignal.timeout(15_000) }).then(r => r.json())
    assert.equal(health.ok, true, 'packaged backend health failed')
    const version = await page.evaluate(() => window.work4youDesktop.getVersion())
    validateRuntime(version.runtime, { bundle, home, commit: stamp.commit })
    // Cross-check provenance against Electron's persisted *spawn* record, not
    // only the runtime advertised by getVersion(). The sandbox has no prior
    // ownership records, and the parent must be the app launched by this probe.
    const ownership = JSON.parse(fs.readFileSync(path.join(userData, 'backend-ownership.json'), 'utf8'))
    const backend = ownership.backends.find(entry => entry.parentPid === app.process().pid &&
      typeof entry.command === 'string' && entry.command.startsWith(`${version.runtime.pythonExecutable} `) &&
      entry.command.includes(' -m work4you_cli.main '))
    assert(backend && Number.isInteger(backend.pid) && backend.pid > 0, 'spawned backend does not use the packaged Python')
    process.kill(backend.pid, 0)
    const fresh = await page.evaluate(() => window.work4youDesktop.getGatewayWsUrl())
    const wsUrl = typeof fresh === 'string' ? fresh : fresh.wsUrl
    assert(wsUrl, 'Electron did not return a usable WebSocket URL')
    ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); reject(new Error('Gateway WebSocket open timed out')) }, 30_000)
      ws.addEventListener('open', () => { clearTimeout(timeout); resolve() }, { once: true })
      ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Gateway WebSocket failed')) }, { once: true })
    })
    const profile = await rpc(ws, 'config.get', { key: 'profile' })
    assert(samePath(profile.home, home), 'actual backend reads a different data home')
    const sessions = await rpc(ws, 'session.list', { limit: 200 })
    assert(sessions.sessions.some(row => row.id === SESSION_ID && row.title === SENTINEL), 'persisted conversation missing from actual gateway')
    verifyPreservedFiles(home)
    assert(!fs.existsSync(path.join(home, 'work4you', 'venv')), 'installation copied a second runtime into the data home')
    return { success: true, commit: stamp.commit, runtime: version.runtime, backendPid: backend.pid,
      timingsMs: { windowReady: windowReadyMs, backendUsable: Math.round(performance.now() - started) },
      checks: ['packaged-electron', 'spawned-bundled-python', 'http-health', 'websocket-rpc', 'effective-data-home',
        'persisted-session', 'config-skills-memory-env-preserved'],
      machine: { platform: process.platform, arch: process.arch, cpus: os.cpus().length, memoryBytes: os.totalmem() } }
  } finally {
    ws?.close()
    if (app) await app.close()
  }
}

async function main() {
  const [mode, ...argv] = process.argv.slice(2)
  const args = Object.fromEntries(argv.map((value, index) => index % 2 === 0 ? [value.replace(/^--/, ''), argv[index + 1]] : null).filter(Boolean))
  assert(args.home, '--home is required')
  if (mode === 'seed') { seedData(args.home); return }
  assert.equal(mode, 'probe')
  let result
  try {
    result = await probe({ executable: args.exe, home: args.home, userData: args['user-data'],
      expectedCommit: args.commit, seedSession: args['seed-session'] === 'true' })
  } catch (error) {
    // Errors deliberately exclude captured child stdout / connection tokens.
    result = { success: false, error: error.message }
    process.exitCode = 1
  }
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
