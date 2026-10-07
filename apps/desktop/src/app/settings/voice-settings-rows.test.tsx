import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $capture, endCapture } from '@/store/keybinds'

const speakText = vi.hoisted(() => vi.fn())
const notify = vi.hoisted(() => vi.fn())

vi.mock('@/work4you', () => ({
  speakText: (text: string, profile?: null | string) => speakText(text, profile)
}))

vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args)
}))

import { setDictationLanguage } from '@/store/dictation-language'

import { DictationLanguageSetting, SubscriptionVoiceSetting, VoiceShortcutSetting } from './voice-settings-rows'

let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  speakText.mockReset()
  notify.mockReset()
  setDictationLanguage('app')
  endCapture()
})

describe('dictation language row', () => {
  it('names the app language by default and shows a picked one', () => {
    render(<DictationLanguageSetting />)

    expect(screen.getByRole('combobox').textContent).toBe('Same as the app (English)')

    act(() => setDictationLanguage('pt'))

    expect(screen.getByRole('combobox').textContent).toBe('Português')
  })

  it('names the app language as it is spoken', () => {
    render(
      <I18nProvider configClient={null} initialLocale="pt">
        <DictationLanguageSetting />
      </I18nProvider>
    )

    // Not "Igual ao app (Português (Brasil))": the app's name for its locale.
    expect(screen.getByRole('combobox').textContent).toBe('Igual ao app (Português)')
  })
})

describe('subscription voice row', () => {
  function renderVoice(beforePreview = vi.fn(async () => {})) {
    render(
      <SubscriptionVoiceSetting
        beforePreview={beforePreview}
        label="Voice"
        onChange={() => {}}
        options={['alloy', 'ash', 'marin']}
        profile="worker"
        value="marin"
      />
    )

    return beforePreview
  }

  it('reads voices as names', () => {
    renderVoice()

    expect(screen.getByRole('combobox').textContent).toBe('Marin')
  })

  it('saves a just-picked voice, then speaks a line in it until stopped', async () => {
    const order: string[] = []
    const beforePreview = vi.fn(async () => void order.push('save'))
    speakText.mockImplementation(async () => {
      order.push('speak')

      return { data_url: 'data:audio/mpeg;base64,AA==' }
    })
    renderVoice(beforePreview)

    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))

    await screen.findByRole('button', { name: 'Stop' })
    expect(order).toEqual(['save', 'speak'])
    expect(speakText).toHaveBeenCalledWith("Hi! This is the voice I'll use to read my replies aloud.", 'worker')
    expect(play).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy()
  })

  it('says so when the voice cannot play', async () => {
    speakText.mockRejectedValue(new Error('no TTS'))
    renderVoice()

    fireEvent.click(screen.getByRole('button', { name: 'Listen' }))

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', message: "Couldn't play the voice." })
      )
    })
    expect(screen.getByRole('button', { name: 'Listen' })).toBeTruthy()
  })
})

describe('voice shortcut row', () => {
  it('shows the app shortcut and rebinds it in place', () => {
    render(<VoiceShortcutSetting />)

    const caps = screen.getByRole('button', { name: 'Rebind' })

    expect(caps.textContent).not.toBe('')

    fireEvent.click(caps)

    expect($capture.get()).toBe('composer.voice')
  })
})
