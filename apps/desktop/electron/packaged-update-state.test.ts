import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import type { PackagedInstallerApplyPlan } from './packaged-installer-update'
import {
  cancelPackagedUpdate,
  confirmPackagedUpdateHealth,
  createPackagedUpdateAttempt,
  failPackagedUpdate,
  hasLivePackagedUpdateProcess,
  readPackagedUpdateState,
  waitForPackagedHandoffReady,
  writePackagedUpdateState
} from './packaged-update-state'

const currentCommit = 'a'.repeat(40)
const targetCommit = 'b'.repeat(40)

const plan: PackagedInstallerApplyPlan = {
  kind: 'installer',
  assetName: 'Work4You-Setup.exe',
  releaseTag: 'desktop-v1.0.1',
  releaseSha: targetCommit,
  downloadUrl: 'https://example.com/installer.exe',
  size: 10
}

test('postponement is quiet before installation and cannot cancel a file replacement already running', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'ready' })
    assert.equal(cancelPackagedUpdate(f.statePath)?.stage, 'cancelled')
    assert.equal(failPackagedUpdate(f.statePath, 'late handoff failure')?.stage, 'cancelled')
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'installing' })
    assert.equal(cancelPackagedUpdate(f.statePath)?.stage, 'installing')
  } finally {
    f.dispose()
  }
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-update-state-'))
  const statePath = path.join(root, 'user-data', 'packaged-update-result.json')
  const installerPath = path.join(root, 'installer.exe')
  fs.writeFileSync(installerPath, 'installer')
  const state = createPackagedUpdateAttempt({ statePath, plan, currentCommit, installerPath })

  return { root, statePath, installerPath, state, dispose: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('handoff waits for the same attempt acknowledgement, never a stale ready receipt', async () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'ready' })
    await waitForPackagedHandoffReady(f.statePath, f.state.attemptId, 200)
    await assert.rejects(() => waitForPackagedHandoffReady(f.statePath, 'stale-attempt', 1), /did not become ready/)
    failPackagedUpdate(f.statePath, 'PowerShell could not open the installer')
    await assert.rejects(() => waitForPackagedHandoffReady(f.statePath, f.state.attemptId, 200), /could not open/)
  } finally {
    f.dispose()
  }
})

test('success requires both installer exit zero and a matching app plus runtime health receipt in either order', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'installing' })
    confirmPackagedUpdateHealth(f.statePath, targetCommit, {
      runtimeCommit: targetCommit,
      verification: 'backend-ready'
    })
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'installing')
    // Simulates NSIS acknowledging its exit after the new app already became ready.
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'awaiting-health', installerExitCode: 0 })
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'succeeded')
    assert.equal(readPackagedUpdateState(f.statePath)?.verification, 'backend-ready')
    fs.unlinkSync(`${f.statePath}.health.json`)
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'awaiting-health')
    confirmPackagedUpdateHealth(f.statePath, targetCommit, {
      runtimeCommit: targetCommit,
      verification: 'runtime-probe'
    })
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'succeeded')
  } finally {
    f.dispose()
  }
})

test('old shell or wrong runtime never confirms the prepared version', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'installing' })
    assert.equal(
      confirmPackagedUpdateHealth(f.statePath, currentCommit, {
        runtimeCommit: currentCommit,
        verification: 'backend-ready'
      })?.stage,
      'installing'
    )
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'awaiting-health', installerExitCode: 0 })

    const failed = confirmPackagedUpdateHealth(f.statePath, targetCommit, {
      runtimeCommit: currentCommit,
      verification: 'runtime-probe'
    })

    assert.equal(failed?.stage, 'failed')
    assert.match(failed?.error ?? '', /does not match/)
  } finally {
    f.dispose()
  }
})

test('new shell with a wrong runtime fails even if NSIS has not acknowledged its exit yet', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'installing' })
    assert.equal(
      confirmPackagedUpdateHealth(f.statePath, targetCommit, {
        runtimeCommit: currentCommit,
        verification: 'runtime-probe'
      })?.stage,
      'failed'
    )
  } finally {
    f.dispose()
  }
})

test('a short matching commit prefix cannot confirm the installed payload', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'awaiting-health', installerExitCode: 0 })
    fs.writeFileSync(
      `${f.statePath}.health.json`,
      JSON.stringify({
        attemptId: f.state.attemptId,
        currentCommit: targetCommit.slice(0, 7),
        runtimeCommit: targetCommit,
        verification: 'backend-ready'
      })
    )
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'awaiting-health')
    assert.throws(
      () =>
        createPackagedUpdateAttempt({
          statePath: f.statePath,
          plan: { ...plan, releaseSha: targetCommit.slice(0, 7) },
          currentCommit,
          installerPath: f.installerPath
        }),
      /no verified commit/
    )
  } finally {
    f.dispose()
  }
})

test('failed installation stays failed even if the app starts and stale health is ignored', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'awaiting-health', installerExitCode: 0 })
    fs.writeFileSync(
      `${f.statePath}.health.json`,
      JSON.stringify({
        attemptId: 'old',
        currentCommit: targetCommit,
        runtimeCommit: targetCommit
      })
    )
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'awaiting-health')
    failPackagedUpdate(f.statePath, 'installer failed')
    confirmPackagedUpdateHealth(f.statePath, targetCommit, {
      runtimeCommit: targetCommit,
      verification: 'backend-ready'
    })
    assert.equal(readPackagedUpdateState(f.statePath)?.stage, 'failed')
  } finally {
    f.dispose()
  }
})

test('retains a known working installer for recovery across failed retries', () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, { ...f.state, stage: 'succeeded', installerExitCode: 0 })

    const next = createPackagedUpdateAttempt({
      statePath: f.statePath,
      plan: { ...plan, releaseSha: 'c'.repeat(40) },
      currentCommit: targetCommit,
      installerPath: path.join(f.root, 'next.exe')
    })

    assert.equal(next.recoveryInstallerPath, f.installerPath)
    writePackagedUpdateState(f.statePath, { ...next, stage: 'ready', updaterPid: process.pid })
    failPackagedUpdate(f.statePath, 'installer failed')

    const retry = createPackagedUpdateAttempt({
      statePath: f.statePath,
      plan: { ...plan, releaseSha: 'c'.repeat(40) },
      currentCommit: targetCommit,
      installerPath: path.join(f.root, 'next.exe')
    })

    assert.equal(retry.recoveryInstallerPath, f.installerPath)
  } finally {
    f.dispose()
  }
})

test('an installer still running after failure blocks retries, but a reused PID does not', async () => {
  const f = fixture()

  try {
    writePackagedUpdateState(f.statePath, {
      ...f.state,
      stage: 'failed',
      installerPid: process.pid,
      installerStartMarker: 'win:123'
    })
    const state = readPackagedUpdateState(f.statePath)
    assert.equal(await hasLivePackagedUpdateProcess(state, async identity => identity.startMarker === 'win:123'), true)
    assert.equal(await hasLivePackagedUpdateProcess(state, async identity => identity.startMarker === 'win:456'), false)
    await assert.rejects(() => hasLivePackagedUpdateProcess(state, async () => undefined), /Could not verify/)
    assert.equal(await hasLivePackagedUpdateProcess({ ...state!, installerExitCode: 1 }, async () => true), false)
  } finally {
    f.dispose()
  }
})

test('a live updater is identified by start marker and does not block after a terminal result', async () => {
  const f = fixture()

  try {
    const state = { ...f.state, updaterPid: process.pid, updaterStartMarker: 'win:123' }
    assert.equal(await hasLivePackagedUpdateProcess(state, async () => true), true)
    assert.equal(await hasLivePackagedUpdateProcess(state, async () => false), false)
    assert.equal(await hasLivePackagedUpdateProcess({ ...state, stage: 'cancelled' }, async () => true), false)
    assert.equal(await hasLivePackagedUpdateProcess(null, async () => true), false)
  } finally {
    f.dispose()
  }
})
