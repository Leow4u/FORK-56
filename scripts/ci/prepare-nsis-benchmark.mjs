/** Repackage one verified release payload for an unpublished Windows NSIS comparison. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DESKTOP = path.join(REPO, 'apps/desktop')
const HOOKS = ['beforeBuild', 'beforePack', 'afterExtract', 'afterPack', 'afterSign', 'afterAllArtifactBuild',
  'artifactBuildStarted', 'artifactBuildCompleted', 'appxManifestCreated', 'msiProjectCreated']
const SOURCE_CONFIG_PATHS = ['package-lock.json', 'apps/desktop/package.json',
  'apps/desktop/electron/installer.nsh', 'apps/desktop/assets']
const PRECOMPRESSED = ['.avi', '.mov', '.m4v', '.mp4', '.m4p', '.qt', '.mkv', '.webm', '.vmdk']

export function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '')
    assert(['installer', 'sha256', 'commit', 'out'].includes(key) && argv[index] === `--${key}` &&
      argv[index + 1] && !argv[index + 1].startsWith('--') && !(key in result), 'Expected unique --installer, --sha256, --commit and --out arguments')
    result[key] = argv[index + 1]
  }
  assert(/^[a-f0-9]{64}$/i.test(result.sha256 ?? ''), '--sha256 must be a complete SHA-256')
  assert(/^[a-f0-9]{40}$/i.test(result.commit ?? ''), '--commit must be a complete source commit')
  assert(result.installer && result.out, '--installer and --out are required')
  return { installer: path.resolve(result.installer), sha256: result.sha256.toLowerCase(),
    commit: result.commit.toLowerCase(), out: path.resolve(result.out) }
}

export async function hashFile(filename) {
  const digest = createHash('sha256')
  for await (const chunk of fs.createReadStream(filename)) digest.update(chunk)
  return digest.digest('hex')
}

export async function inventoryTree(root) {
  assert(fs.lstatSync(root).isDirectory(), 'Payload root must be an ordinary directory')
  const files = []
  async function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name)
      const stat = fs.lstatSync(filename)
      assert(!stat.isSymbolicLink(), `Payload links are not supported: ${filename}`)
      if (stat.isDirectory()) await walk(filename)
      else {
        assert(stat.isFile(), `Unsupported payload entry: ${filename}`)
        files.push({ path: path.relative(root, filename).split(path.sep).join('/'),
          sha256: await hashFile(filename), bytes: stat.size })
      }
    }
  }
  await walk(root)
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  return { files, fingerprintSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    totalBytes: files.reduce((total, file) => total + file.bytes, 0) }
}

export function extractionToolVersion(info) {
  assert(/\bNsis\b/i.test(info), 'The extraction tool must include the NSIS archive reader')
  const version = info.split(/\r?\n/).find(line => /^7-Zip\b/.test(line))?.trim()
  assert(version, 'The extraction tool did not report its 7-Zip version')
  return version
}

export function cleanupScratch(root) {
  assert(fs.lstatSync(root).isDirectory(), 'Scratch parent must be an ordinary directory')
  const removedRelativePaths = []
  let freedScratchBytes = 0
  function bytes(filename) {
    const stat = fs.lstatSync(filename)
    if (stat.isSymbolicLink()) return 0
    if (stat.isDirectory()) return fs.readdirSync(filename).reduce((total, name) => total + bytes(path.join(filename, name)), 0)
    return stat.size
  }
  // Only directories created by this preparator. rm does not follow nested links.
  for (const relative of ['app', 'archives', 'builder-cache', 'tmp']) {
    const filename = path.join(root, relative)
    if (!fs.existsSync(filename)) continue
    freedScratchBytes += bytes(filename)
    fs.rmSync(filename, { recursive: true })
    removedRelativePaths.push(relative)
  }
  return { removedRelativePaths, freedScratchBytes }
}

function freeDiskSpace(paths) {
  const volumes = new Map()
  for (const filename of paths.filter(Boolean)) {
    const root = path.parse(fs.realpathSync.native(filename)).root
    if (volumes.has(root.toLowerCase())) continue
    const stat = fs.statfsSync(filename, { bigint: true })
    volumes.set(root.toLowerCase(), { volume: root, availableBytes: Number(stat.bavail * stat.bsize) })
  }
  return [...volumes.values()]
}

export function archiveEntries(listing) {
  const entries = []
  for (const record of listing.split(/\r?\n\r?\n/)) {
    const name = /^Path = (.+)$/m.exec(record)?.[1]?.trimEnd().replace(/\\/g, '/')
    if (!name) continue
    assert(!/^(?:\/|[a-z]:)/i.test(name) && !name.includes(':') &&
      !name.split('/').includes('..'), `Unsafe archive path: ${name}`)
    assert(!/^(?:Symbolic Link|Hard Link) = .+/m.test(record), `Archive link is not supported: ${name}`)
    entries.push(name)
  }
  assert(entries.length, 'Archive listing contains no entries')
  return entries
}

export function benchmarkConfig(original, { variant, output, version }) {
  assert(variant === '7z' || variant === 'zip', 'Unknown benchmark variant')
  assert(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version), 'Packaged application version is invalid')
  const config = structuredClone(original)
  for (const hook of HOOKS) config[hook] = null
  config.extends = null
  config.publish = null
  config.forceCodeSigning = false
  config.npmRebuild = false
  config.nodeGypRebuild = false
  config.directories = { ...config.directories, output: path.resolve(output) }
  config.extraMetadata = { ...config.extraMetadata, version }
  config.artifactName = `Work4You-Benchmark-${variant}.exe`
  config.win = { ...config.win, target: ['nsis'], signAndEditExecutable: false, signExecutable: false,
    azureSignOptions: null, signtoolOptions: { publisherName: null } }
  config.nsis = { ...config.nsis, useZip: variant === 'zip', differentialPackage: variant === '7z' }
  return config
}

export function validatePayload(root, commit) {
  const resources = path.join(root, 'resources')
  const stamp = JSON.parse(fs.readFileSync(path.join(resources, 'install-stamp.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(resources, 'runtime/manifest.json'), 'utf8'))
  assert.equal(stamp.commit, commit, 'Installer shell differs from selected source commit')
  assert.equal(manifest.commit, commit, 'Installer runtime differs from selected source commit')
  assert.equal(manifest.present, true)
  assert.equal(manifest.layout, 'app-owned')
  const python = manifest.pythonExecutable
  assert(typeof python === 'string' && python && !path.win32.isAbsolute(python) &&
    !python.split(/[\\/]/).includes('..'), 'Bundled Python must remain inside the payload')
  for (const filename of ['Work4You.exe', 'resources/app.asar', 'resources/elevate.exe',
    path.join('resources/runtime', python)]) {
    assert(fs.lstatSync(path.join(root, filename)).isFile(), `Missing packaged file: ${filename}`)
  }
  const fd = fs.openSync(path.join(root, 'Work4You.exe'), 'r')
  try {
    const magic = Buffer.alloc(2)
    fs.readSync(fd, magic, 0, 2, 0)
    assert.equal(magic.toString('ascii'), 'MZ', 'Packaged executable is not a Windows PE')
  } finally { fs.closeSync(fd) }
}

function run7zip(tool, args) {
  return execFileSync(tool, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    timeout: 30 * 60 * 1000, windowsHide: true })
}

async function extractPayload(tool, installer, out, precompressed) {
  const members = archiveEntries(run7zip(tool, ['l', '-slt', '-ba', installer]))
  const packages = members.filter(name => path.posix.basename(name) === 'app-64.7z')
  assert.equal(packages.length, 1, 'Expected exactly one x64 app-64.7z payload in the release NSIS')
  const archives = path.join(out, 'archives')
  const app = path.join(out, 'app')
  fs.mkdirSync(archives)
  fs.mkdirSync(app)
  run7zip(tool, ['e', '-y', installer, packages[0], `-o${archives}`])
  const payload = path.join(archives, 'app-64.7z')
  archiveEntries(run7zip(tool, ['l', '-slt', '-ba', payload]))
  run7zip(tool, ['x', '-y', payload, `-o${app}`])
  // NSIS may store precompressed resources outside app-64.7z. Preserve them too.
  const loose = members.filter(name => precompressed.some(ext => name.endsWith(ext)))
  for (const [index, member] of loose.entries()) {
    const relative = member.replace(/^\$INSTDIR\//, '')
    assert(relative.startsWith('resources/'), `Unrecognized loose NSIS resource: ${member}`)
    const scratch = path.join(archives, `loose-${index}`)
    fs.mkdirSync(scratch)
    run7zip(tool, ['e', '-y', installer, member, `-o${scratch}`])
    const source = path.join(scratch, path.posix.basename(member))
    const destination = path.join(app, relative)
    if (fs.existsSync(destination)) assert.equal(await hashFile(source), await hashFile(destination), 'Conflicting duplicate resource')
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
    }
  }
  return app
}

export async function prepareBenchmark(options) {
  assert.equal(process.platform, 'win32', 'Prepare this benchmark on a native Windows runner')
  assert.equal(await hashFile(options.installer), options.sha256, 'Release installer SHA-256 mismatch')
  execFileSync('git', ['diff', '--quiet', options.commit, '--', ...SOURCE_CONFIG_PATHS], { cwd: REPO })
  // Refuse an existing output directory: no stale payloads and no deleting user files.
  fs.mkdirSync(options.out)
  const cache = path.join(options.out, 'builder-cache')
  const temporary = path.join(options.out, 'tmp')
  const hostTemp = process.env.TEMP
  fs.mkdirSync(cache)
  fs.mkdirSync(temporary)
  // These settings belong only to this short-lived builder process, not the host.
  process.env.ELECTRON_BUILDER_CACHE = cache
  process.env.TMP = temporary
  process.env.TEMP = temporary
  process.env.TMPDIR = temporary
  for (const key of Object.keys(process.env)) {
    if (/^(?:WIN_)?CSC_/.test(key) || /^ELECTRON_BUILDER_(?:7ZIP_PATH|COMPRESSION_LEVEL|7Z_FILTER)$/.test(key)) delete process.env[key]
  }
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  const { getPath7za } = await import('app-builder-lib/out/toolsets/7zip.js')
  const { build, Platform, Arch } = await import('electron-builder')
  const { extractFile } = await import('@electron/asar')
  const { UUID } = await import('builder-util-runtime')
  // The pinned Windows 7za compresses packages but omits the NSIS reader.
  // Extract with the full 7-Zip supplied by the Windows runner, never a PATH lookup.
  const packagingTool = await getPath7za()
  assert(process.env.ProgramFiles && path.win32.isAbsolute(process.env.ProgramFiles), 'ProgramFiles is unavailable')
  const tool = path.join(process.env.ProgramFiles, '7-Zip', '7z.exe')
  const toolInfo = run7zip(tool, ['i'])
  const extractionTool = { path: tool, version: extractionToolVersion(toolInfo), sha256: await hashFile(tool) }
  const original = JSON.parse(fs.readFileSync(path.join(DESKTOP, 'package.json'), 'utf8')).build
  const app = await extractPayload(tool, options.installer, options.out, original.nsis?.preCompressedFileExtensions ?? PRECOMPRESSED)
  validatePayload(app, options.commit)
  const metadata = JSON.parse(extractFile(path.join(app, 'resources/app.asar'), 'package.json').toString('utf8'))
  const before = await inventoryTree(app)
  const inventoryPath = path.join(options.out, 'payload-inventory.json')
  fs.writeFileSync(inventoryPath, JSON.stringify(before.files, null, 2) + '\n')
  const guid = original.nsis?.guid || UUID.v5(original.appId, UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'))
  const result = { schemaVersion: 1, source: { commit: options.commit, installerPath: options.installer,
    installerSha256: options.sha256, installerBytes: fs.statSync(options.installer).size },
    product: { appId: original.appId, productName: original.productName, version: metadata.version,
      uninstallRegistryKey: `Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${guid.replace(/\\/g, ' - ')}` },
    payload: { root: app, inventoryPath, inventoryRelativePath: 'payload-inventory.json',
      fingerprintSha256: before.fingerprintSha256, files: before.files.length, totalBytes: before.totalBytes },
    tools: { extraction: extractionTool, packaging: { path: packagingTool, sha256: await hashFile(packagingTool) } },
    variants: {} }
  for (const variant of ['7z', 'zip']) {
    const output = path.join(options.out, variant)
    const config = benchmarkConfig(original, { variant, output, version: metadata.version })
    const started = performance.now()
    console.log(`Packaging ${variant} from verified release ${options.commit} (${metadata.version})`)
    await build({ projectDir: DESKTOP, prepackaged: app, publish: 'never',
      targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), config })
    const packagingMs = Math.round(performance.now() - started)
    // Includes elevate.exe: even prepackaged builds may recopy that helper.
    // Fail if its bytes, any other file, or the set of files changed.
    assert.equal((await inventoryTree(app)).fingerprintSha256, before.fingerprintSha256,
      `The ${variant} builder altered the release payload`)
    const filename = path.join(output, config.artifactName)
    result.variants[variant] = { path: filename, relativePath: path.relative(options.out, filename).split(path.sep).join('/'),
      sha256: await hashFile(filename), bytes: fs.statSync(filename).size, packagingMs,
      useZip: config.nsis.useZip, differentialPackage: config.nsis.differentialPackage }
    console.log(JSON.stringify({ variant, ...result.variants[variant] }))
  }
  assert.equal(await hashFile(options.installer), options.sha256, 'Source installer changed during preparation')
  // Both awaited builds and fingerprints have completed; no builder child is pending.
  // electron-builder's AppPackageHelper also removes its intermediate .nsis.7z/.zip.
  result.cleanup = cleanupScratch(options.out)
  result.payload.retained = false
  result.availableDiskSpace = freeDiskSpace([options.out, path.dirname(options.installer), hostTemp])
  fs.writeFileSync(path.join(options.out, 'benchmark-manifest.json'), JSON.stringify(result, null, 2) + '\n')
  return result
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await prepareBenchmark(parseArgs(process.argv.slice(2))) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
