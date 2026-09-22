import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { atom, computed } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type SessionView, SessionViewProvider } from '@/app/chat/session-view'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $notifications } from '@/store/notifications'
import { $activeSessionId, $yoloActive, setYoloActive } from '@/store/session'
import {
  $sessionStates,
  $sessionTiles,
  publishSessionState,
  type SessionTileDelegate,
  setSessionTileDelegate
} from '@/store/session-states'

import { SessionYoloPill } from './session-yolo-pill'

const { requestGateway } = vi.hoisted(() => ({
  requestGateway: vi.fn()
}))

vi.mock('@/app/gateway/hooks/use-gateway-request', () => ({
  useGatewayRequest: () => ({ requestGateway })
}))

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

function seedSession(runtimeId: string, storedSessionId: string, yolo = false) {
  publishSessionState(runtimeId, { ...createClientSessionState(storedSessionId), yolo })
}

function tileView(runtimeId: string): SessionView {
  const $state = computed($sessionStates, states => states[runtimeId])

  return {
    kind: 'tile',
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

function yoloPayloads() {
  return requestGateway.mock.calls.filter(call => call[0] === 'config.set').map(call => call[1])
}

afterEach(() => {
  cleanup()
  setSessionTileDelegate(null as unknown as SessionTileDelegate)
  $activeSessionId.set(null)
  $sessionStates.set({})
  $sessionTiles.set([])
  $notifications.set([])
  setYoloActive(false)
  requestGateway.mockReset()
})

beforeEach(() => {
  requestGateway.mockImplementation(async (_method: string, params?: { value?: string }) => ({
    value: params?.value ?? '0'
  }))
})

describe('SessionYoloPill', () => {
  it('arms a new draft locally and leaves the gateway alone', () => {
    installDelegate()
    setYoloActive(false)

    render(<SessionYoloPill disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'YOLO off' }))

    expect($yoloActive.get()).toBe(true)
    expect(screen.getByRole('button', { name: 'YOLO armed for this chat' }).getAttribute('aria-pressed')).toBe('true')
    expect(requestGateway).not.toHaveBeenCalled()
  })

  it('writes session YOLO for the live chat and leaves approval mode alone', async () => {
    installDelegate()
    $activeSessionId.set('runtime-a')
    seedSession('runtime-a', 'stored-a')

    render(<SessionYoloPill disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'YOLO off' }))

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.set', {
        key: 'yolo',
        session_id: 'runtime-a',
        value: '1'
      })
    })

    expect(yoloPayloads().some(payload => payload?.key === 'approvals.mode' || payload?.scope === 'global')).toBe(false)
    expect($sessionStates.get()['runtime-a']?.yolo).toBe(true)
    expect($yoloActive.get()).toBe(true)
  })

  it('turns session YOLO off with value 0', async () => {
    installDelegate()
    requestGateway.mockResolvedValue({ value: '0' })
    $activeSessionId.set('runtime-a')
    seedSession('runtime-a', 'stored-a', true)
    setYoloActive(true)

    render(<SessionYoloPill disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'YOLO armed for this chat' }))

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.set', {
        key: 'yolo',
        session_id: 'runtime-a',
        value: '0'
      })
    })

    expect($sessionStates.get()['runtime-a']?.yolo).toBe(false)
  })

  it('keeps a tile toggle off the foreground atom', async () => {
    installDelegate()
    requestGateway.mockResolvedValue({ value: '1' })
    seedSession('tile-runtime', 'stored-tile')
    $sessionTiles.set([{ runtimeId: 'tile-runtime', storedSessionId: 'stored-tile' }])
    setYoloActive(false)

    render(
      <SessionViewProvider value={tileView('tile-runtime')}>
        <SessionYoloPill disabled={false} />
      </SessionViewProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'YOLO off' }))

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.set', {
        key: 'yolo',
        session_id: 'tile-runtime',
        value: '1'
      })
      expect(screen.getByRole('button', { name: 'YOLO armed for this chat' })).toBeTruthy()
    })

    expect($yoloActive.get()).toBe(false)
    expect($sessionStates.get()['tile-runtime']?.yolo).toBe(true)
  })

  it('rolls the live session back when the gateway refuses', async () => {
    installDelegate()
    requestGateway.mockRejectedValue(new Error('nope'))
    $activeSessionId.set('runtime-a')
    seedSession('runtime-a', 'stored-a')

    render(<SessionYoloPill disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'YOLO off' }))

    await waitFor(() => {
      expect($notifications.get().some(item => item.message === 'Could not toggle YOLO')).toBe(true)
    })

    expect($sessionStates.get()['runtime-a']?.yolo).toBe(false)
    expect($yoloActive.get()).toBe(false)
    expect(screen.getByRole('button', { name: 'YOLO off' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps the compact trigger icon-only', () => {
    render(<SessionYoloPill compact disabled={false} />)

    const trigger = screen.getByRole('button', { name: 'YOLO off' })

    expect(trigger.getAttribute('data-slot')).toBe('composer-session-yolo')
    expect(trigger.textContent).not.toMatch(/YOLO/)
  })

  it('disables only when the composer is disabled', () => {
    const { rerender } = render(<SessionYoloPill disabled={false} />)

    expect((screen.getByRole('button', { name: 'YOLO off' }) as HTMLButtonElement).disabled).toBe(false)

    rerender(<SessionYoloPill disabled />)

    expect((screen.getByRole('button', { name: 'YOLO off' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
