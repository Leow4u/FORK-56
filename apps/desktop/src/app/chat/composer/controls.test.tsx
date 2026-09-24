import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChatBarState } from '@/app/chat/composer/types'
import { I18nProvider } from '@/i18n'
import { $hudMode } from '@/store/hud'
import { applyWakeStartResult, applyWakeStatus, resetWakeWordState } from '@/store/wake-word'

import { ComposerControls } from './controls'

vi.mock('./model-pill', () => ({ ModelPill: () => null }))

const state: ChatBarState = {
  model: { canSwitch: false, model: '', provider: '' },
  tools: { enabled: false, label: '' },
  voice: { active: false, enabled: false }
}

function renderControls(overrides: Partial<React.ComponentProps<typeof ComposerControls>> = {}) {
  return render(
    <I18nProvider configClient={null} initialLocale="en">
      <ComposerControls
        autoSpeak={false}
        busy={false}
        busyAction="stop"
        canSubmit={true}
        conversation={{
          active: false,
          level: 0,
          muted: false,
          onEnd: vi.fn(),
          onStart: vi.fn(),
          onStopTurn: vi.fn(),
          onToggleMute: vi.fn(),
          status: 'idle'
        }}
        disabled={false}
        hasComposerPayload={true}
        onDictate={vi.fn()}
        onQueue={vi.fn()}
        onToggleAutoSpeak={vi.fn()}
        state={state}
        voiceStatus="idle"
        {...overrides}
      />
    </I18nProvider>
  )
}

async function expectShortcutTooltip(label: string, shortcut: string) {
  fireEvent.pointerMove(screen.getByLabelText(label), { pointerType: 'mouse' })

  const tooltip = await screen.findByRole('tooltip')

  expect(tooltip.textContent).toContain(label)
  expect(tooltip.textContent).toContain(shortcut)
}

afterEach(() => {
  cleanup()
  $hudMode.set(false)
})

describe('composer control row', () => {
  it('does not keep the context meter inside the surface', () => {
    renderControls()

    expect(screen.queryByLabelText('Context usage')).toBeNull()
  })

  it('keeps the session approval menu beside the model control once a chat has messages', () => {
    renderControls()

    const trigger = screen.getByRole('button', { name: /approval mode: smart/i })

    expect(trigger.getAttribute('data-slot')).toBe('composer-approval-mode')
  })

  it('leaves the session approval menu out of the model cluster on a new session', () => {
    renderControls({ showSessionApproval: false })

    expect(screen.queryByRole('button', { name: /approval mode/i })).toBeNull()
  })

  it('hides the session approval menu during a voice conversation', () => {
    renderControls({
      conversation: {
        active: true,
        level: 0,
        muted: false,
        onEnd: vi.fn(),
        onStart: vi.fn(),
        onStopTurn: vi.fn(),
        onToggleMute: vi.fn(),
        status: 'listening'
      }
    })

    expect(screen.queryByRole('button', { name: /approval mode/i })).toBeNull()
  })
})

function openVoiceOptions() {
  const trigger = screen.getByLabelText('Voice')

  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.click(trigger)
}

// The HUD folds every voice control into one menu. The docked row keeps
// dictation one click away and tucks read-replies plus the wake word behind
// the chevron beside the primary button.
describe('HUD mode', () => {
  it('keeps dictation on the row and tucks the other voice toggles behind the chevron', () => {
    renderControls()

    expect(screen.queryByLabelText('Context usage')).toBeNull()
    expect(screen.getByLabelText('Voice dictation')).toBeTruthy()
    expect(screen.getByLabelText('Voice')).toBeTruthy()
    expect(screen.queryByLabelText('Read replies aloud')).toBeNull()
    expect(screen.queryByLabelText('Exit HUD mode')).toBeNull()

    openVoiceOptions()

    const replies = screen.getByLabelText('Read replies aloud')
    const anchor = screen.getByLabelText('Voice dictation').closest('[data-slot="voice-dictation-anchor"]')
    const popover = replies.closest('[data-slot="popover-content"]')

    expect(anchor).toBeTruthy()
    expect(popover?.getAttribute('data-side')).toBe('top')
  })

  it('folds them into one menu and offers the way out in the HUD', () => {
    $hudMode.set(true)
    renderControls()

    expect(screen.getByLabelText('Voice')).toBeTruthy()
    expect(screen.getByLabelText('Exit HUD mode')).toBeTruthy()

    // Folded away, not duplicated — the whole point is the row's width back.
    expect(screen.queryByLabelText('Voice dictation')).toBeNull()
    expect(screen.queryByLabelText('Read replies aloud')).toBeNull()
  })

  // A collapsed menu that looked idle while the mic was open would be a worse
  // trade than the space it saves, so the trigger reports the live state.
  it('reports a live voice state on the collapsed trigger', () => {
    $hudMode.set(true)
    renderControls({ voiceStatus: 'recording' })

    expect(screen.getByLabelText('Stop dictation')).toBeTruthy()
    expect(screen.queryByLabelText('Voice')).toBeNull()
  })
})

describe('ComposerControls shortcut tooltips', () => {
  it('shows Enter for Send', async () => {
    renderControls()

    await expectShortcutTooltip('Send', '↵')
  })

  it('keeps Send (not Steer) while a turn is running if there is a payload', async () => {
    renderControls({ busy: true, busyAction: 'steer' })

    await expectShortcutTooltip('Send', '↵')
  })

  it('shows Stop only when the composer is empty mid-turn', async () => {
    renderControls({ busy: true, busyAction: 'stop', canSubmit: true, hasComposerPayload: false })

    await expectShortcutTooltip('Stop', '↵')
  })

  it('shows Ctrl+Enter for Queue as the secondary mid-turn action', async () => {
    renderControls({ busy: true, busyAction: 'queue' })

    await expectShortcutTooltip('Queue message', 'Ctrl+↵')
  })
})

describe('wake-word ear visibility', () => {
  afterEach(() => {
    resetWakeWordState()
  })

  it('stays mounted during a busy agent turn', () => {
    applyWakeStatus({ available: true, enabled: true, listening: true, phrase: 'hey work4you' })
    renderControls({ busy: true, busyAction: 'stop' })
    openVoiceOptions()

    expect(screen.getByLabelText('Wake word: "hey work4you" — listening')).toBeTruthy()
  })

  it('stays mounted (enabled in config) even when a start was refused', () => {
    applyWakeStatus({ available: true, enabled: true, listening: false, phrase: 'hey work4you' })
    // Transient refusal marks available false but enabled keeps it mounted.
    applyWakeStartResult({ hint: 'mic busy', reason: 'unavailable', started: false })
    renderControls()
    openVoiceOptions()

    expect(screen.getByLabelText('Wake word: "hey work4you" — off')).toBeTruthy()
  })

  it('stays visible (never hides) even when unavailable and not enabled', () => {
    applyWakeStatus({ available: false, enabled: false, listening: false, phrase: 'hey work4you' })
    renderControls()
    openVoiceOptions()

    // The ear always stays in the voice menu so the user can click to enable;
    // a failed start surfaces its reason in the tooltip.
    expect(screen.getByLabelText('Wake word: "hey work4you" — off')).toBeTruthy()
  })

  it('surfaces the backend refusal reason in the tooltip, still visible', () => {
    applyWakeStatus({ available: false, enabled: false, listening: false, phrase: 'hey work4you' })
    applyWakeStartResult({ hint: 'run `work4you tools` (Voice section)', reason: 'unavailable', started: false })
    renderControls()
    openVoiceOptions()

    const ear = screen.getByLabelText('Wake word: "hey work4you" — off')
    expect(ear).toBeTruthy()
  })

  it('shows a disabled paused ear inside the voice-conversation pill', () => {
    applyWakeStatus({ available: true, enabled: true, listening: true, phrase: 'hey work4you' })
    renderControls({
      conversation: {
        active: true,
        level: 0,
        muted: false,
        onEnd: vi.fn(),
        onStart: vi.fn(),
        onStopTurn: vi.fn(),
        onToggleMute: vi.fn(),
        status: 'listening'
      }
    })

    const ear = screen.getByLabelText('Wake word: "hey work4you" — paused during voice chat')
    expect((ear as HTMLButtonElement).disabled).toBe(true)
  })
})
