#!/usr/bin/env node
// Exercise electron-builder's unmodified ZIP extraction macro on disposable files.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const require = createRequire(import.meta.url)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function waitForClose(closed, milliseconds) {
  let timer
  try {
    await Promise.race([closed, new Promise(resolve => { timer = setTimeout(resolve, milliseconds) })])
  } finally { clearTimeout(timer) }
}

export function inspectFixture(destination, entries) {
  return entries.map(({ name, contents }) => {
    const expectedSha256 = sha256(Buffer.from(contents, 'utf8'))
    try {
      const actualSha256 = sha256(fs.readFileSync(path.join(destination, name)))
      return { name, expectedSha256, actualSha256, matches: actualSha256 === expectedSha256 }
    } catch (error) {
      return { name, expectedSha256, actualSha256: null, matches: false, error: error.code ?? error.name }
    }
  })
}

export function assessResults(cases) {
  const complete = result => result.exitCode === 0 && !result.timedOut && result.sentinel && result.integrity
  const positive = cases.filter(result => result.expected === 'success')
  const faults = cases.filter(result => result.expected === 'failure')
  const captured = result => result.exited && !result.harnessError &&
    (Number.isInteger(result.exitCode) || result.timedOut)
  const conclusive = positive.length >= 2 && faults.length >= 2 &&
    positive.every(complete) && faults.every(result => result.faultEstablished && captured(result))
  const readyForProduction = conclusive && faults.every(result =>
    !result.timedOut && result.exitCode !== 0 && !result.sentinel && !result.integrity)
  return { conclusive, readyForProduction }
}

export function nsisString(value) {
  assert(!/[\r\n\0]/.test(value), 'NSIS paths cannot contain line breaks')
  return value.replaceAll('$', () => '$$').replaceAll('"', () => '$\\"')
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true,
    timeout: 120_000, maxBuffer: 1024 * 1024, ...options })
  if (result.error || result.status !== 0) {
    throw new Error(`${path.basename(command)} failed: ${result.error?.message ?? result.status}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  }
  return result
}

// Python's standard library supplies ZIP, Win32 exclusive handles and window
// metadata. It never installs packages or changes an ACL/registry setting.
export const pythonHelper = String.raw`
import ctypes, json, os, pathlib, sys, time, zipfile
from ctypes import wintypes

command = sys.argv[1]
if command == 'zip':
    entries = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
    with zipfile.ZipFile(sys.argv[3], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for entry in entries:
            archive.writestr(entry['name'], entry['contents'].encode('utf-8'))
elif command == 'lock':
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
        wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    handle = kernel.CreateFileW(sys.argv[2], 0xC0000000, 0, None, 3, 0x80, None)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        pathlib.Path(sys.argv[3]).write_text(json.dumps({'pid': os.getpid(), 'exclusive': True}), encoding='utf-8')
        deadline = time.monotonic() + 120
        while not pathlib.Path(sys.argv[4]).exists():
            if time.monotonic() >= deadline:
                raise TimeoutError('lock owner was not released')
            time.sleep(0.05)
    finally:
        kernel.CloseHandle(handle)
elif command == 'dialogs':
    user = ctypes.WinDLL('user32', use_last_error=True)
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user.IsWindowVisible.argtypes = [wintypes.HWND]
    user.EnumChildWindows.argtypes = [wintypes.HWND, callback_type, wintypes.LPARAM]
    windows = []
    def label(hwnd, method):
        buffer = ctypes.create_unicode_buffer(512)
        method(hwnd, buffer, len(buffer))
        return buffer.value
    def visit(hwnd, unused):
        owner = wintypes.DWORD()
        user.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value == int(sys.argv[2]):
            children = []
            def child(window, ignored):
                text = label(window, user.GetWindowTextW)
                if text:
                    children.append(text)
                return True
            user.EnumChildWindows(hwnd, callback_type(child), 0)
            windows.append({'className': label(hwnd, user.GetClassNameW),
                'title': label(hwnd, user.GetWindowTextW),
                'visible': bool(user.IsWindowVisible(hwnd)), 'text': children[:12]})
        return True
    user.EnumWindows(callback_type(visit), 0)
    print(json.dumps(windows))
else:
    raise ValueError(command)
`

export function compileHarness({ output, archive, template, plugins, compiler, format = 'zip', extraScript = '' }) {
  assert(format === 'zip' || format === '7z', 'Unknown probe archive format')
  const executable = path.join(output, 'probe.exe')
  const source = path.join(output, 'probe.nsi')
  fs.writeFileSync(source, `Unicode true
SilentInstall silent
RequestExecutionLevel user
Name "NSIS ${format === 'zip' ? 'ZIP' : format} extraction probe"
OutFile "${nsisString(executable)}"
LoadLanguageFile "\${NSISDIR}\\Contrib\\Language files\\English.nlf"
!include "LogicLib.nsh"
!addplugindir /x86-unicode "${nsisString(plugins)}"
${format === 'zip' ? '!define ZIP_COMPRESSION' : ''}
${extraScript}
!include "${nsisString(template)}"
LangString decompressionFailed 1033 "NSIS ${format === 'zip' ? 'ZIP' : format} probe extraction failed:"
Var packageArch
Var completionMarker
Section
  InitPluginsDir
  ReadEnvStr $INSTDIR WORK4YOU_NSIS_PROBE_DEST
  ReadEnvStr $completionMarker WORK4YOU_NSIS_PROBE_MARKER
  SetOutPath $INSTDIR
  File /oname=$PLUGINSDIR\\app-64.${format} "${nsisString(archive)}"
  StrCpy $packageArch "64"
  !insertmacro decompress
  FileOpen $0 "$completionMarker" w
  FileWrite $0 "complete"
  FileClose $0
  SetErrorLevel 0
SectionEnd
`, 'utf8')
  const args = ['-WX', '-INPUTCHARSET', 'UTF8', source]
  const options = { env: { ...process.env, ...compiler.env }, cwd: output }
  let result
  try {
    if (/\.cmd$/i.test(compiler.path)) {
      // Modern official bundles expose a cmd shim that sets NSISDIR. Do not
      // interpolate shell metacharacters into that wrapper invocation.
      assert([compiler.path, ...args].every(value => !/["%!^&|<>\r\n]/.test(value)), 'Unsafe cmd wrapper argument')
      const commandLine = `"${[compiler.path, ...args].map(value => `"${value}"`).join(' ')}"`
      result = run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], { ...options, windowsVerbatimArguments: true })
    } else {
      result = run(compiler.path, args, options)
    }
  } catch (error) {
    fs.writeFileSync(path.join(output, 'compile.log'), error.stack ?? String(error), 'utf8')
    throw error
  }
  fs.writeFileSync(path.join(output, 'compile.log'), result.stdout + result.stderr, 'utf8')
  return executable
}

export async function observeInstaller(executable, destination, marker, python, helper, timeoutMs) {
  const started = performance.now()
  const child = spawn(executable, ['/S'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WORK4YOU_NSIS_PROBE_DEST: destination, WORK4YOU_NSIS_PROBE_MARKER: marker } })
  let exitCode = null
  let exited = false
  let harnessError = null
  let stdout = '', stderr = ''
  child.stdout.on('data', data => { stdout = (stdout + data.toString()).slice(-16_384) })
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-16_384) })
  const closed = new Promise(resolve => {
    child.once('error', error => { harnessError = error.message; exited = true; resolve() })
    child.once('close', code => { exitCode = code; exited = true; resolve() })
  })
  await waitForClose(closed, timeoutMs)
  const timedOut = !exited
  let dialogs = [], dialogError = null, termination = null
  if (timedOut) {
    try {
      dialogs = JSON.parse(run(python, ['-X', 'utf8', helper, 'dialogs', String(child.pid)], { timeout: 5000 }).stdout)
    } catch (error) { dialogError = error.message }
    const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      encoding: 'utf8', windowsHide: true, timeout: 5000,
    })
    termination = { exitCode: killed.status, error: killed.error?.message ?? null }
    await waitForClose(closed, 5000)
    if (!exited) {
      child.kill()
      await waitForClose(closed, 2000)
      harnessError = 'Installer process tree did not terminate within the deadline'
    }
  }
  return { exitCode, exited, timedOut, durationMs: Math.round(performance.now() - started),
    dialogs, dialogError, termination, stdout, stderr, harnessError }
}

export async function holdFile(python, helper, file, directory) {
  const ready = path.join(directory, 'lock-ready.json'), release = path.join(directory, 'release-lock')
  const child = spawn(python, ['-X', 'utf8', helper, 'lock', file, ready, release], {
    windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = '', exited = false, spawnError = null
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4096) })
  const closed = new Promise(resolve => {
    child.once('error', error => { spawnError = error.message; exited = true; resolve() })
    child.once('close', () => { exited = true; resolve() })
  })
  const finish = async () => {
    fs.writeFileSync(release, 'release', 'utf8')
    await waitForClose(closed, 5000)
    if (!exited) { child.kill(); await waitForClose(closed, 2000) }
    assert(exited, 'Exclusive lock helper did not stop')
  }
  try {
    const deadline = performance.now() + 5000
    while (!fs.existsSync(ready) && !exited && performance.now() < deadline) await pause(50)
    assert(fs.existsSync(ready) && !exited, `Exclusive lock was not acquired: ${spawnError ?? stderr}`)
    return { finish, stillHeld: () => !exited,
      evidence: JSON.parse(fs.readFileSync(ready, 'utf8')) }
  } catch (error) { await finish(); throw error }
}

export async function probe({ out, python = 'python', timeoutMs = 15_000 }) {
  assert.equal(process.platform, 'win32', 'The NSIS extraction probe requires a native Windows runner')
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 30_000, 'Invalid timeout')
  const output = path.resolve(out)
  const temporary = fs.realpathSync(process.env.RUNNER_TEMP || os.tmpdir())
  const parent = fs.realpathSync(path.dirname(output))
  const relative = path.relative(temporary, parent)
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), '--out must be a new child directory under RUNNER_TEMP/TEMP')
  fs.mkdirSync(output) // Deliberately fails if it exists; no existing content is deleted.
  const report = { schemaVersion: 1, platform: process.platform, scope: 'unmodified-upstream-decompression-macro',
    limitations: ['Does not validate the full installer or updater',
      'Does not exercise transient locks, denied ACLs or paths exceeding MAX_PATH'],
    cases: [], conclusive: false, readyForProduction: false }
  try {
    const windows = require('app-builder-lib/out/toolsets/windows.js')
    const packageFile = require.resolve('app-builder-lib/package.json')
    const builder = JSON.parse(fs.readFileSync(packageFile, 'utf8'))
    const config = JSON.parse(fs.readFileSync(path.join(repo, 'apps/desktop/package.json'), 'utf8')).build
    const compiler = await windows.getMakeNsisPath(config.toolsets?.nsis, config.nsis?.customNsisBinary)
    const plugins = path.join(await windows.getNsisPluginsPath(config.toolsets?.nsis, config.nsis?.customNsisResources), 'x86-unicode')
    const plugin = path.join(plugins, fs.readdirSync(plugins).find(name => name.toLowerCase() === 'nsisunz.dll') ?? 'nsisunz.dll')
    const template = path.join(path.dirname(packageFile), 'templates/nsis/include/extractAppPackage.nsh')
    report.toolchain = { builderVersion: builder.version, nsisToolset: config.toolsets?.nsis ?? 'legacy-default',
      compiler: compiler.path, plugin, pluginSha256: sha256(fs.readFileSync(plugin)),
      template, templateSha256: sha256(fs.readFileSync(template)) }
    const helper = path.join(output, 'native-helper.py')
    fs.writeFileSync(helper, pythonHelper, 'utf8')
    const entries = [
      { name: 'payload/locked.bin', contents: 'NSIS extraction expected payload\n' },
      { name: 'recursos/ação 工作.txt', contents: 'Unicode ZIP entry: ação 工作\n' },
    ]
    // Stay within MAX_PATH for the positive compatibility case, but exercise
    // a realistically deep runtime path and record its actual UTF-16 length.
    const successDestination = path.join(output, 'unicode-success', 'Instalação 工作')
    let deep = 'resources/runtime/python/Lib/site-packages'
    while (path.join(successDestination, deep, 'package-segment', 'fixture.txt').length < 240) deep += '/package-segment'
    entries.push({ name: `${deep}/fixture.txt`, contents: 'Deep runtime entry\n' })
    assert(path.join(successDestination, entries.at(-1).name).length < 260, 'Choose a shorter --out path for the MAX_PATH compatibility probe')
    const fixture = path.join(output, 'fixture.json'), archive = path.join(output, 'fixture.zip')
    fs.writeFileSync(fixture, JSON.stringify(entries, null, 2), 'utf8')
    run(python, ['-X', 'utf8', helper, 'zip', fixture, archive])
    const executable = compileHarness({ output, archive, template, plugins, compiler })
    const runCase = async (name, destination, expected, faultEstablished = false) => {
      const directory = path.join(output, name)
      fs.mkdirSync(directory, { recursive: true })
      fs.mkdirSync(destination, { recursive: true })
      const marker = path.join(directory, 'completed')
      const observed = await observeInstaller(executable, destination, marker, python, helper, timeoutMs)
      return { name, expected, destination, maxPathLength: Math.max(...entries.map(entry => path.join(destination, entry.name).length)),
        faultEstablished, ...observed, sentinel: fs.existsSync(marker) }
    }
    const inventory = result => {
      result.files = inspectFixture(result.destination, entries)
      result.integrity = result.files.every(file => file.matches)
      report.cases.push(result)
    }
    inventory(await runCase('unicode-success', successDestination, 'success'))
    const lockDirectory = path.join(output, 'permanent-lock'), lockDestination = path.join(lockDirectory, 'destination')
    const lockedFile = path.join(lockDestination, 'payload/locked.bin')
    fs.mkdirSync(path.dirname(lockedFile), { recursive: true })
    fs.writeFileSync(lockedFile, 'pre-existing locked bytes', 'utf8')
    const holder = await holdFile(python, helper, lockedFile, lockDirectory)
    let locked
    try {
      locked = await runCase('permanent-lock', lockDestination, 'failure', true)
      locked.faultEstablished = holder.stillHeld()
      locked.lock = holder.evidence
    } finally { await holder.finish() }
    inventory(locked)
    inventory(await runCase('lock-recovery', lockDestination, 'success'))
    const collisionDestination = path.join(output, 'file-directory-collision', 'destination')
    fs.mkdirSync(collisionDestination, { recursive: true })
    fs.writeFileSync(path.join(collisionDestination, 'payload'), 'directory is a file', 'utf8')
    inventory(await runCase('file-directory-collision', collisionDestination, 'failure', true))
    Object.assign(report, assessResults(report.cases))
  } catch (error) {
    report.harnessError = error.stack ?? String(error)
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { out: { type: 'string' }, python: { type: 'string' }, 'timeout-ms': { type: 'string' } } })
  assert(values.out, 'Usage: probe-nsis-unzip.mjs --out <new temporary directory> [--python python.exe]')
  const result = await probe({ out: values.out, python: values.python, timeoutMs: Number(values['timeout-ms'] ?? 15_000) })
  console.log(JSON.stringify({ report: path.join(path.resolve(values.out), 'report.json'), ...result }, null, 2))
  process.exitCode = result.conclusive ? 0 : 1
}
