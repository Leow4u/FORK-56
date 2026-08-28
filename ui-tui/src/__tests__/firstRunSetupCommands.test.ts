import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSlashHandler } from '../app/createSlashHandler.js'
import { getOverlayState, resetOverlayState } from '../app/overlayStore.js'
import { runExternalSetup } from '../app/setupHandoff.js'
import { patchUiState, resetUiState } from '../app/uiStore.js'
import { FIRST_RUN_PORTAL_ARGS, SETUP_REQUIRED_STATUS } from '../content/setup.js'

vi.mock('../app/setupHandoff.js', () => ({
  runExternalSetup: vi.fn()
}))

describe('first-run slash commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetOverlayState()
    resetUiState()
  })

  it('sends /setup to Portal one-shot while setup is required', () => {
    patchUiState({ status: SETUP_REQUIRED_STATUS })
    const ctx = buildCtx()

    expect(createSlashHandler(ctx)('/setup')).toBe(true)
    expect(runExternalSetup).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runExternalSetup).mock.calls[0]?.[0]?.args).toEqual([...FIRST_RUN_PORTAL_ARGS])
    expect(getOverlayState().modelPicker).toBeFalsy()
  })

  it('ignores /setup section args on first-run so labs stay closed', () => {
    patchUiState({ status: SETUP_REQUIRED_STATUS })
    const ctx = buildCtx()

    expect(createSlashHandler(ctx)('/setup model')).toBe(true)
    expect(vi.mocked(runExternalSetup).mock.calls[0]?.[0]?.args).toEqual([...FIRST_RUN_PORTAL_ARGS])
  })

  it('keeps /setup section args after first-run', () => {
    patchUiState({ status: 'ready' })
    const ctx = buildCtx()

    expect(createSlashHandler(ctx)('/setup model')).toBe(true)
    expect(vi.mocked(runExternalSetup).mock.calls[0]?.[0]?.args).toEqual(['setup', 'model'])
  })

  it('routes /model to Portal on first-run instead of the lab picker', () => {
    patchUiState({ status: SETUP_REQUIRED_STATUS, sid: 'sid-abc' })
    const ctx = buildCtx()

    expect(createSlashHandler(ctx)('/model')).toBe(true)
    expect(runExternalSetup).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runExternalSetup).mock.calls[0]?.[0]?.args).toEqual([...FIRST_RUN_PORTAL_ARGS])
    expect(getOverlayState().modelPicker).toBeFalsy()
    expect(ctx.gateway.rpc).not.toHaveBeenCalled()
  })

  it('blocks typed /model provider switches on first-run', () => {
    patchUiState({ status: SETUP_REQUIRED_STATUS, sid: 'sid-abc' })
    const ctx = buildCtx()

    expect(createSlashHandler(ctx)('/model gpt-4 --provider openrouter')).toBe(true)
    expect(runExternalSetup).toHaveBeenCalledTimes(1)
    expect(ctx.gateway.rpc).not.toHaveBeenCalled()
    expect(getOverlayState().modelPicker).toBeFalsy()
  })
})

const buildCtx = () => ({
  slashFlightRef: { current: 0 },
  composer: {
    enqueue: vi.fn(),
    hasSelection: false,
    openEditor: vi.fn(async () => {}),
    paste: vi.fn(),
    queueRef: { current: [] as string[] },
    selection: { copySelection: vi.fn(async () => '') },
    setInput: vi.fn()
  },
  gateway: {
    gw: {
      getLogTail: vi.fn(() => ''),
      kill: vi.fn(),
      request: vi.fn(() => Promise.resolve({}))
    },
    rpc: vi.fn(() => Promise.resolve({}))
  },
  local: {
    catalog: null,
    getHistoryItems: vi.fn(() => []),
    getLastUserMsg: vi.fn(() => ''),
    maybeWarn: vi.fn(),
    setCatalog: vi.fn()
  },
  session: {
    closeSession: vi.fn(() => Promise.resolve(null)),
    die: vi.fn(),
    dieWithCode: vi.fn(),
    guardBusySessionSwitch: vi.fn(() => false),
    newLiveSession: vi.fn(),
    newSession: vi.fn(),
    resetVisibleHistory: vi.fn(),
    resumeById: vi.fn(),
    setSessionStartedAt: vi.fn()
  },
  transcript: {
    page: vi.fn(),
    panel: vi.fn(),
    send: vi.fn(),
    setHistoryItems: vi.fn(),
    sys: vi.fn(),
    trimLastExchange: vi.fn((items: unknown) => items)
  },
  voice: {
    setVoiceEnabled: vi.fn(),
    setVoiceRecordKey: vi.fn(),
    setVoiceTts: vi.fn()
  }
})
