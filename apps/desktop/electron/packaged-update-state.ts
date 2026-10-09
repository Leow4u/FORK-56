import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { type PackagedInstallerApplyPlan, sameGitCommit } from './packaged-installer-update'

export type PackagedUpdateStage =
  'pending' | 'ready' | 'installing' | 'awaiting-health' | 'succeeded' | 'failed' | 'cancelled'

export interface PackagedUpdateState {
  schemaVersion: 1
  attemptId: string
  stage: PackagedUpdateStage
  releaseTag: string
  expectedCommit: string
  previousCommit: string | null
  installerPath: string
  recoveryInstallerPath: string | null
  startedAt: string
  updatedAt: string
  installerExitCode?: number
  installerPid?: number
  installerStartMarker?: string
  updaterPid?: number
  updaterStartMarker?: string
  verification?: 'backend-ready' | 'runtime-probe'
  error?: string | null
}

const stages: readonly string[] = [
  'pending',
  'ready',
  'installing',
  'awaiting-health',
  'succeeded',
  'failed',
  'cancelled'
]

function isFullCommit(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value)
}

function matchesExpectedCommit(expected: string, actual: unknown): boolean {
  return isFullCommit(actual) && actual.toLowerCase() === expected.toLowerCase()
}

export function readPackagedUpdateState(statePath: string): PackagedUpdateState | null {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''))

    if (
      state.schemaVersion !== 1 ||
      typeof state.attemptId !== 'string' ||
      !stages.includes(state.stage) ||
      !isFullCommit(state.expectedCommit) ||
      typeof state.installerPath !== 'string'
    ) {
      return null
    }

    if (state.stage === 'awaiting-health' && state.installerExitCode === 0) {
      try {
        const health = JSON.parse(fs.readFileSync(`${statePath}.health.json`, 'utf8'))

        if (
          health.attemptId === state.attemptId &&
          matchesExpectedCommit(state.expectedCommit, health.currentCommit) &&
          matchesExpectedCommit(state.expectedCommit, health.runtimeCommit) &&
          ['backend-ready', 'runtime-probe'].includes(health.verification)
        ) {
          return { ...state, stage: 'succeeded', verification: health.verification, error: null }
        }
      } catch {
        /* The restarted app has not reported healthy yet. */
      }
    }

    return state
  } catch {
    return null
  }
}

export function writePackagedUpdateState(statePath: string, state: PackagedUpdateState): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  const temporary = `${statePath}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(temporary, statePath)
}

export function createPackagedUpdateAttempt(options: {
  statePath: string
  plan: PackagedInstallerApplyPlan
  currentCommit: string | null
  installerPath: string
}): PackagedUpdateState {
  if (!isFullCommit(options.plan.releaseSha)) {
    throw new Error('The installer release has no verified commit.')
  }

  const previous = readPackagedUpdateState(options.statePath)

  const previousInstaller =
    previous?.stage === 'succeeded' &&
    sameGitCommit(previous.expectedCommit, options.currentCommit) &&
    fs.existsSync(previous.installerPath)
      ? previous.installerPath
      : previous?.recoveryInstallerPath &&
          sameGitCommit(previous.previousCommit, options.currentCommit) &&
          fs.existsSync(previous.recoveryInstallerPath)
        ? previous.recoveryInstallerPath
        : null

  const now = new Date().toISOString()

  const state: PackagedUpdateState = {
    schemaVersion: 1,
    attemptId: randomUUID(),
    stage: 'pending',
    releaseTag: options.plan.releaseTag,
    expectedCommit: options.plan.releaseSha.toLowerCase(),
    previousCommit: options.currentCommit,
    installerPath: options.installerPath,
    recoveryInstallerPath: previousInstaller,
    startedAt: now,
    updatedAt: now
  }

  writePackagedUpdateState(options.statePath, state)

  return state
}

/** Durable PIDs must be paired with a start marker: Windows can reuse them after a restart. */
export async function hasLivePackagedUpdateProcess(
  state: PackagedUpdateState | null,
  matchesIdentity: (identity: { pid: number; startMarker: string }) => Promise<boolean | undefined>
): Promise<boolean> {
  if (!state) {
    return false
  }

  const candidates = [
    state.installerExitCode === undefined ? { pid: state.installerPid, startMarker: state.installerStartMarker } : null,
    !['succeeded', 'failed', 'cancelled'].includes(state.stage)
      ? { pid: state.updaterPid, startMarker: state.updaterStartMarker }
      : null
  ]

  for (const candidate of candidates) {
    if (!candidate?.pid || !candidate.startMarker) {
      continue
    }

    try {
      process.kill(candidate.pid, 0)
    } catch {
      continue
    }

    const matches = await matchesIdentity({ pid: candidate.pid, startMarker: candidate.startMarker })

    if (matches === undefined) {
      throw new Error('Could not verify whether the previous update installer is still running. Try again shortly.')
    }

    if (matches) {
      return true
    }
  }

  return false
}

/** The wrapper exiting zero is not evidence that PowerShell executed the handoff. */
export async function waitForPackagedHandoffReady(
  statePath: string,
  attemptId: string,
  timeoutMs = 30_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  do {
    const state = readPackagedUpdateState(statePath)

    if (state?.attemptId === attemptId) {
      if (state.stage === 'cancelled') {
        throw new Error('The update was postponed.')
      }

      if (state.stage === 'failed') {
        throw new Error(state.error || 'The update installer could not start.')
      }

      if (state.stage === 'ready') {
        return
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  } while (Date.now() < deadline)

  throw new Error('The update installer did not become ready. Work4You is still running; try again.')
}

/** Call after local backend readiness or the explicit bundled-runtime probe in remote mode. */
export function confirmPackagedUpdateHealth(
  statePath: string,
  currentCommit: string | null,
  health: { runtimeCommit: string | null; verification: 'backend-ready' | 'runtime-probe' }
): PackagedUpdateState | null {
  const state = readPackagedUpdateState(statePath)

  if (!state || ['succeeded', 'failed', 'cancelled'].includes(state.stage)) {
    return state
  }

  // A manual reopen while the previous process waits must not confirm an update.
  if (state.stage !== 'installing' && state.stage !== 'awaiting-health') {
    return state
  }

  const shellMatches = matchesExpectedCommit(state.expectedCommit, currentCommit)
  const matches = shellMatches && matchesExpectedCommit(state.expectedCommit, health.runtimeCommit)

  if (state.stage === 'installing' && !shellMatches) {
    return state
  }

  if (matches) {
    // Separate writers: NSIS owns its result, the new app owns readiness. A fast
    // startup must not be overwritten by a late installer-exit acknowledgement.
    const receiptPath = `${statePath}.health.json`
    const temporary = `${receiptPath}.${process.pid}.tmp`
    fs.writeFileSync(
      temporary,
      JSON.stringify({
        attemptId: state.attemptId,
        currentCommit,
        ...health,
        verifiedAt: new Date().toISOString()
      }),
      'utf8'
    )
    fs.renameSync(temporary, receiptPath)

    return readPackagedUpdateState(statePath)
  }

  const next: PackagedUpdateState = {
    ...state,
    stage: 'failed',
    verification: health.verification,
    error: 'Work4You reopened, but the installed version does not match the prepared update. Run the installer again.',
    updatedAt: new Date().toISOString()
  }

  writePackagedUpdateState(statePath, next)

  return next
}

export function failPackagedUpdate(statePath: string, error: string): PackagedUpdateState | null {
  const state = readPackagedUpdateState(statePath)

  if (!state || ['succeeded', 'failed', 'cancelled'].includes(state.stage)) {
    return state
  }

  const next: PackagedUpdateState = { ...state, stage: 'failed', error, updatedAt: new Date().toISOString() }
  writePackagedUpdateState(statePath, next)

  return next
}

/** Cancelling is safe only before the installer has started replacing files. */
export function cancelPackagedUpdate(statePath: string): PackagedUpdateState | null {
  const state = readPackagedUpdateState(statePath)

  if (!state || (state.stage !== 'pending' && state.stage !== 'ready')) {
    return state
  }

  const next: PackagedUpdateState = { ...state, stage: 'cancelled', error: null, updatedAt: new Date().toISOString() }
  writePackagedUpdateState(statePath, next)

  return next
}
