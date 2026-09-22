import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom, computed } from 'nanostores'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { type SessionView, SessionViewProvider } from '@/app/chat/session-view'
import { createClientSessionState } from '@/lib/chat-runtime'
import {
  $approvalModes,
  $draftSessionApprovalMode,
  approvalModeForProfile,
  reconcileApprovalModeForProfile,
  setDraftSessionApprovalMode
} from '@/store/approval-mode'
import { $notifications } from '@/store/notifications'
import { $activeSessionId } from '@/store/session'
import {
  $sessionStates,
  $sessionTiles,
  publishSessionState,
  type SessionTileDelegate,
  setSessionTileDelegate
} from '@/store/session-states'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { SessionApprovalPill } from './session-approval-pill'

const { requestGateway } = vi.hoisted(() => ({
  requestGateway: vi.fn()
}))

vi.mock('@/app/gateway/hooks/use-gateway-request', () => ({
  useGatewayRequest: () => ({ requestGateway })
}))

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

function installDelegate() {
  setSessionTileDelegate({
    updateSession(runtimeId, updater) {
      const previous = $sessionStates.get()[runtimeId] ?? createClientSessionState()
      const next = updater(previous)

      if (next !== previous) {
        publishSessionState(runtimeId, next)
      }

      return next
    }
  } as SessionTileDelegate)
}

function seedSession(runtimeId: string, storedSessionId: string) {
  publishSessionState(runtimeId, createClientSessionState(storedSessionId))
}

function tileView(runtimeId: string | null): SessionView {
  const $state = computed($sessionStates, states => (runtimeId ? states[runtimeId] : undefined))

  return {
    kind: 'tile',
    $approvalMode: computed($state, state => state?.approvalMode ?? null),
    $awaitingResponse: atom(false),
    $busy: atom(false),
    $cwd: atom(''),
    $fast: atom(false),
    $lastVisibleIsUser: atom(false),
    $messages: atom([]),
    $messagesEmpty: atom(false),
    $model: atom(''),
    $provider: atom(''),
    $reasoningEffort: atom(''),
    $runtimeId: atom(runtimeId),
    $storedId: atom('stored-tile'),
    $turnStartedAt: atom<number | null>(null),
    $yolo: computed($state, state => Boolean(state?.yolo))
  }
}

function choose(mode: RegExp) {
  fireEvent.pointerDown(screen.getByRole('button', { name: /approval mode/i }), { button: 0 })
  fireEvent.click(screen.getByRole('menuitemradio', { name: mode }))
}

afterEach(() => {
  cleanup()
  setSessionTileDelegate(null as unknown as SessionTileDelegate)
  $activeSessionId.set(null)
  $sessionStates.set({})
  $sessionTiles.set([])
  $notifications.set([])
  $approvalModes.set({})
  setDraftSessionApprovalMode(null)
  requestGateway.mockReset()
})

beforeEach(() => {
  requestGateway.mockImplementation(async (_method: string, params?: { value?: string }) => ({
    value: params?.value ?? 'smart'
  }))
})

describe('SessionApprovalPill', () => {
  it('pins a new draft locally and leaves the profile mode alone', () => {
    installDelegate()
    reconcileApprovalModeForProfile('default', 'smart')

    render(<SessionApprovalPill disabled={false} />)

    choose(/off/i)

    expect($draftSessionApprovalMode.get()).toBe('off')
    expect(screen.getByRole('button', { name: 'Approval mode: Off' })).toBeTruthy()
    expect(requestGateway).not.toHaveBeenCalled()
    expect(approvalModeForProfile('default')).toBe('smart')
  })

  it('stores the profile value when the chat picks it explicitly', () => {
    installDelegate()

    render(<SessionApprovalPill disabled={false} />)

    choose(/smart/i)

    expect($draftSessionApprovalMode.get()).toBe('smart')

    reconcileApprovalModeForProfile('default', 'manual')

    expect(screen.getByRole('button', { name: 'Approval mode: Smart' })).toBeTruthy()
    expect(requestGateway).not.toHaveBeenCalled()
  })

  it('writes the live chat and leaves the profile cache alone', async () => {
    installDelegate()
    $activeSessionId.set('runtime-a')
    seedSession('runtime-a', 'stored-a')
    reconcileApprovalModeForProfile('default', 'smart')

    render(<SessionApprovalPill disabled={false} />)

    choose(/off/i)

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.set', {
        key: 'approvals.mode',
        session_id: 'runtime-a',
        value: 'off'
      })
    })

    expect(requestGateway.mock.calls.some(call => call[1]?.scope === 'global')).toBe(false)
    expect($sessionStates.get()['runtime-a']?.approvalMode).toBe('off')
    expect(approvalModeForProfile('default')).toBe('smart')
    expect($draftSessionApprovalMode.get()).toBeNull()
  })

  it('keeps a tile toggle off the primary draft and the profile cache', async () => {
    installDelegate()
    seedSession('tile-runtime', 'stored-tile')
    $sessionTiles.set([{ runtimeId: 'tile-runtime', storedSessionId: 'stored-tile' }])
    setDraftSessionApprovalMode(null)

    render(
      <SessionViewProvider value={tileView('tile-runtime')}>
        <SessionApprovalPill disabled={false} />
      </SessionViewProvider>
    )

    choose(/manual/i)

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.set', {
        key: 'approvals.mode',
        session_id: 'tile-runtime',
        value: 'manual'
      })
    })

    expect($sessionStates.get()['tile-runtime']?.approvalMode).toBe('manual')
    expect($draftSessionApprovalMode.get()).toBeNull()
    expect($approvalModes.get()).toEqual({})
  })

  it('rolls the live session back when the gateway refuses', async () => {
    installDelegate()
    requestGateway.mockRejectedValue(new Error('nope'))
    $activeSessionId.set('runtime-a')
    seedSession('runtime-a', 'stored-a')

    render(<SessionApprovalPill disabled={false} />)

    choose(/off/i)

    await waitFor(() => {
      expect($notifications.get().some(item => item.message === 'Could not change approval mode')).toBe(true)
    })

    expect($sessionStates.get()['runtime-a']?.approvalMode).toBeNull()
    expect(screen.getByRole('button', { name: 'Approval mode: Smart' })).toBeTruthy()
  })

  it('keeps the compact trigger icon-only', () => {
    render(<SessionApprovalPill compact disabled={false} />)

    const trigger = screen.getByRole('button', { name: 'Approval mode: Smart' })

    expect(trigger.getAttribute('data-slot')).toBe('composer-approval-mode')
    expect(trigger.textContent).not.toMatch(/smart|manual|off/i)
  })

  it('disables when the composer is disabled', () => {
    const { rerender } = render(<SessionApprovalPill disabled={false} />)

    expect((screen.getByRole('button', { name: /approval mode/i }) as HTMLButtonElement).disabled).toBe(false)

    rerender(<SessionApprovalPill disabled />)

    expect((screen.getByRole('button', { name: /approval mode/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables a tile that has no runtime yet', () => {
    render(
      <SessionViewProvider value={tileView(null)}>
        <SessionApprovalPill disabled={false} />
      </SessionViewProvider>
    )

    expect((screen.getByRole('button', { name: /approval mode/i }) as HTMLButtonElement).disabled).toBe(true)
  })
})
