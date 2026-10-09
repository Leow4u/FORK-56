#!/usr/bin/env node
// Native behavior checks of the exact guarded 7z-direct benchmark candidate.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { applyNsisDirectExtractionPatch, restoreNsisDirectExtractionPatch, verifyNsisBaselineTemplate } from './patch-nsis-direct-extraction.mjs'
import { compileHarness, holdFile, inspectFixture, observeInstaller, pause, pythonHelper, run } from './probe-nsis-unzip.mjs'

const require = createRequire(import.meta.url)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sha256 = value => createHash('sha256').update(value).digest('hex')
const requiredCases = ['unicode-success', 'permanent-lock', 'lock-recovery', 'transient-lock',
  'file-directory-collision', 'corrupt-archive']

export function parseAttemptTrace(text) {
  // FileWrite may be in progress while the native installer runs. Only consume
  // complete ASCII lines; malformed complete records invalidate the evidence.
  return text.split('\n').slice(0, -1).filter(line => line.trim()).map(line => {
    const match = /^(\d+)\|([0-9]+|error|timeout)\r?$/.exec(line)
    assert(match, 'Malformed native extraction attempt trace')
    return { attempt: Number(match[1]), status: match[2] }
  })
}

function attemptsAt(marker) {
  try { return parseAttemptTrace(fs.readFileSync(`${marker}.attempts`, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
}

export function assessDirectResults(cases) {
  const completeSet = cases.length === requiredCases.length &&
    requiredCases.every(name => cases.filter(result => result.name === name).length === 1)
  const natural = result => result.exited && Number.isInteger(result.exitCode) &&
    !result.timedOut && !result.termination && !result.harnessError
  const extracted = result => natural(result) && result.exitCode === 0 &&
    result.sentinel && result.integrity && result.attempts.at(-1)?.status === '0'
  const rejected = result => natural(result) && result.exitCode === 2 &&
    !result.sentinel && !result.integrity && result.faultEstablished &&
    ['1', '2'].includes(result.attempts.at(-1)?.status)
  const checks = Object.fromEntries(cases.map(result => {
    let passed = result.expected === 'success' ? extracted(result) : rejected(result)
    if (result.name === 'permanent-lock') passed &&= result.holderAliveAfterFailure && result.originalBytesUnchanged
    if (result.name === 'transient-lock') passed &&= result.failedWhileHeld &&
      result.releaseDelayMs >= 2000 && result.attempts.length >= 2 &&
      result.attempts.slice(0, -1).some(attempt => ['1', '2'].includes(attempt.status))
    if (result.name === 'corrupt-archive') passed &&= result.archiveRejectedByTool
    return [result.name, Boolean(passed)]
  }))
  const conclusive = completeSet && cases.every(result => result.exited && !result.harnessError)
  return { conclusive, candidatePassed: conclusive && Object.values(checks).every(Boolean), checks }
}

// The candidate invokes this optional macro after the actual extractor exits.
// It records only its attempt number/status and preserves the caller's register.
// The benchmark installer does not define the macro, so it emits no trace code.
const traceScript = String.raw`
!define PRODUCT_NAME "NSIS 7z extraction probe"
!macro work4youNsisExtractionAttempt ATTEMPT STATUS OUTPUT
  Push $0
  FileOpen $0 "$completionMarker.attempts" a
  FileSeek $0 0 END
  FileWrite $0 "${'${ATTEMPT}'}|${'${STATUS}'}$\r$\n"
  FileClose $0
  Pop $0
!macroend
`

export async function probeDirect({ out, python = 'python', timeoutMs = 15_000 }) {
  assert.equal(process.platform, 'win32', 'Direct extraction checks require a native Windows runner')
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 10_000 && timeoutMs <= 30_000, 'Invalid timeout')
  const output = path.resolve(out)
  const relative = path.relative(fs.realpathSync(process.env.RUNNER_TEMP || os.tmpdir()),
    fs.realpathSync(path.dirname(output)))
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), '--out must be a new temporary directory')
  fs.mkdirSync(output)
  const report = { schemaVersion: 1, scope: 'production-afterPack-and-guarded-7z-direct-macro',
    limitations: ['Does not validate the full installer/updater or signed-release UX',
      'Does not exercise denied ACLs or paths exceeding MAX_PATH'],
    productionHookPatchApplied: false, cases: [], conclusive: false, candidatePassed: false }
  let receipt
  try {
    verifyNsisBaselineTemplate()
    const { default: afterPack } = await import('../../apps/desktop/scripts/after-pack.mjs')
    const { Target } = require('app-builder-lib/out/core.js')
    const hookFixture = path.join(output, 'after-pack-fixture')
    fs.mkdirSync(hookFixture)
    console.log('Checking the real production afterPack hook; its cosmetic missing-exe stamp warning is expected for this empty fixture.')
    await afterPack({ electronPlatformName: process.platform, appOutDir: hookFixture,
      targets: [new Target('nsis')], packager: { appInfo: { productFilename: 'NativeHookFixture' } } })
    receipt = await applyNsisDirectExtractionPatch()
    assert.equal(receipt.alreadyApplied, true, 'The production afterPack hook did not apply the required extraction patch')
    report.productionHookPatchApplied = true
    report.patch = receipt
    const windows = require('app-builder-lib/out/toolsets/windows.js')
    const config = JSON.parse(fs.readFileSync(path.join(repo, 'apps/desktop/package.json'), 'utf8')).build
    const compiler = await windows.getMakeNsisPath(config.toolsets?.nsis, config.nsis?.customNsisBinary)
    const plugins = path.join(await windows.getNsisPluginsPath(config.toolsets?.nsis, config.nsis?.customNsisResources), 'x86-unicode')
    const helper = path.join(output, 'native-helper.py')
    fs.writeFileSync(helper, pythonHelper, 'utf8')
    const entries = [
      { name: 'payload/locked.bin', contents: 'Expected extracted bytes\n' },
      { name: 'recursos/ação 工作.txt', contents: 'Unicode 7z bytes: ação 工作\n' },
    ]
    const successDestination = path.join(output, 'unicode-success', 'Instalação 工作')
    let deep = 'resources/runtime/python/Lib/site-packages'
    while (path.join(successDestination, deep, 'package-segment', 'fixture.txt').length < 240) deep += '/package-segment'
    entries.push({ name: `${deep}/fixture.txt`, contents: 'Deep runtime entry\n' })
    assert(path.join(successDestination, entries.at(-1).name).length < 260, 'Use a shorter --out path')
    const source = path.join(output, 'fixture-source'), archive = path.join(output, 'fixture.7z')
    fs.mkdirSync(source)
    for (const entry of entries) {
      const filename = path.join(source, entry.name)
      fs.mkdirSync(path.dirname(filename), { recursive: true })
      fs.writeFileSync(filename, entry.contents, 'utf8')
    }
    const sevenZip = receipt.sevenZip.path
    run(sevenZip, ['a', '-t7z', '-mx=1', archive, '.'], { cwd: source })
    run(sevenZip, ['t', archive])
    const executable = compileHarness({ output, archive, template: receipt.templatePath,
      plugins, compiler, format: '7z', extraScript: traceScript })
    const runCase = async (name, destination, expected, selectedExecutable = executable, faultEstablished = false) => {
      const directory = path.join(output, name)
      fs.mkdirSync(directory, { recursive: true })
      fs.mkdirSync(destination, { recursive: true })
      const marker = path.join(directory, 'completed')
      const observed = await observeInstaller(selectedExecutable, destination, marker, python, helper, timeoutMs)
      return { name, expected, destination, faultEstablished, ...observed,
        maxPathLength: Math.max(...entries.map(entry => path.join(destination, entry.name).length)),
        sentinel: fs.existsSync(marker), attempts: attemptsAt(marker) }
    }
    const record = result => {
      result.files = inspectFixture(result.destination, entries)
      result.integrity = result.files.every(file => file.matches)
      report.cases.push(result)
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    }
    record(await runCase('unicode-success', successDestination, 'success'))

    const lockedDestination = path.join(output, 'permanent-lock', 'destination')
    const lockedFile = path.join(lockedDestination, 'payload/locked.bin')
    fs.mkdirSync(path.dirname(lockedFile), { recursive: true })
    const original = Buffer.from('Pre-existing bytes owned by another process\n')
    fs.writeFileSync(lockedFile, original)
    const holder = await holdFile(python, helper, lockedFile, path.dirname(lockedDestination))
    let permanent
    try {
      permanent = await runCase('permanent-lock', lockedDestination, 'failure', executable, true)
      permanent.holderAliveAfterFailure = holder.stillHeld()
      permanent.lock = holder.evidence
    } finally { await holder.finish() }
    permanent.originalBytesUnchanged = sha256(fs.readFileSync(lockedFile)) === sha256(original)
    record(permanent)
    record(await runCase('lock-recovery', lockedDestination, 'success'))

    const transientDirectory = path.join(output, 'transient-lock')
    const transientDestination = path.join(transientDirectory, 'destination')
    const transientFile = path.join(transientDestination, 'payload/locked.bin')
    fs.mkdirSync(path.dirname(transientFile), { recursive: true })
    fs.writeFileSync(transientFile, original)
    const temporaryHolder = await holdFile(python, helper, transientFile, transientDirectory)
    let transient, observedFailure = null, released = false
    const pending = runCase('transient-lock', transientDestination, 'success')
    try {
      const deadline = performance.now() + 7000
      while (performance.now() < deadline) {
        const failure = attemptsAt(path.join(transientDirectory, 'completed')).find(attempt => ['1', '2'].includes(attempt.status))
        if (failure) { observedFailure = { ...failure, at: performance.now(), held: temporaryHolder.stillHeld() }; break }
        await pause(25)
      }
      if (observedFailure) await pause(2000)
      const releaseDelayMs = observedFailure ? performance.now() - observedFailure.at : 0
      const heldUntilRelease = temporaryHolder.stillHeld()
      await temporaryHolder.finish()
      released = true
      transient = await pending
      transient.failedWhileHeld = Boolean(observedFailure?.held && heldUntilRelease)
      transient.releaseDelayMs = releaseDelayMs
      transient.lock = temporaryHolder.evidence
    } finally {
      if (!released) await temporaryHolder.finish()
      await pending
    }
    record(transient)

    const collisionDestination = path.join(output, 'file-directory-collision', 'destination')
    fs.mkdirSync(collisionDestination, { recursive: true })
    fs.writeFileSync(path.join(collisionDestination, 'payload'), 'Cannot be used as a directory', 'utf8')
    record(await runCase('file-directory-collision', collisionDestination, 'failure', executable, true))

    const corruptDirectory = path.join(output, 'corrupt-build')
    fs.mkdirSync(corruptDirectory)
    const corruptArchive = path.join(corruptDirectory, 'corrupt.7z')
    const healthyBytes = fs.readFileSync(archive)
    fs.writeFileSync(corruptArchive, healthyBytes.subarray(0, Math.floor(healthyBytes.length / 2)))
    const corruptCheck = spawnSync(sevenZip, ['t', corruptArchive], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    assert(!corruptCheck.error && Number.isInteger(corruptCheck.status) && corruptCheck.status !== 0, 'Fixture archive was not rejected as corrupt')
    const corruptExecutable = compileHarness({ output: corruptDirectory, archive: corruptArchive,
      template: receipt.templatePath, plugins, compiler, format: '7z', extraScript: traceScript })
    const corrupt = await runCase('corrupt-archive', path.join(output, 'corrupt-archive', 'destination'), 'failure', corruptExecutable, true)
    corrupt.archiveRejectedByTool = true
    corrupt.archive = { validSha256: sha256(healthyBytes), corruptSha256: sha256(fs.readFileSync(corruptArchive)),
      toolTestExitCode: corruptCheck.status }
    record(corrupt)
    Object.assign(report, assessDirectResults(report.cases))
  } catch (error) {
    report.harnessError = error.stack ?? String(error)
  } finally {
    if (receipt) {
      try { await restoreNsisDirectExtractionPatch(receipt) }
      catch (error) { report.harnessError = error.stack ?? String(error); report.candidatePassed = false }
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { out: { type: 'string' }, python: { type: 'string' } } })
  assert(values.out, 'Usage: probe-nsis-direct-extraction.mjs --out <new temporary directory>')
  const result = await probeDirect({ out: values.out, python: values.python })
  console.log(JSON.stringify({ report: path.join(path.resolve(values.out), 'report.json'), ...result }, null, 2))
  process.exitCode = result.candidatePassed ? 0 : 1
}
