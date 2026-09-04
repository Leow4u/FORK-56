import { describe, expect, it } from 'vitest'

import type { Work4YouConfigRecord } from '@/types/work4you'

import { voiceFieldVisible } from './helpers'

const cfg = (over: Record<string, unknown> = {}): Work4YouConfigRecord =>
  ({
    tts: { provider: 'edge', edge: {}, openai: {} },
    stt: { enabled: true, provider: 'local', local: {}, groq: {} },
    ...over
  }) as unknown as Work4YouConfigRecord

describe('voiceFieldVisible', () => {
  it('always shows top-level + non-provider keys', () => {
    const config = cfg()

    for (const key of ['tts.provider', 'stt.enabled', 'stt.provider', 'voice.auto_tts', 'voice.record_key']) {
      expect(voiceFieldVisible(key, config)).toBe(true)
    }
  })

  it('shows only the selected TTS provider sub-fields', () => {
    const config = cfg()
    expect(voiceFieldVisible('tts.edge.voice', config)).toBe(true)
    expect(voiceFieldVisible('tts.openai.voice', config)).toBe(false)
    expect(voiceFieldVisible('tts.elevenlabs.voice_id', config)).toBe(false)
  })

  it('shows only the selected STT provider sub-fields', () => {
    const config = cfg()
    expect(voiceFieldVisible('stt.local.model', config)).toBe(true)
    expect(voiceFieldVisible('stt.groq.model', config)).toBe(false)
  })

  it('hides every STT provider sub-field when STT is disabled', () => {
    const config = cfg({ stt: { enabled: false, provider: 'local', local: {} } })
    expect(voiceFieldVisible('stt.local.model', config)).toBe(false)
    // ...but the enable/provider toggles themselves stay visible.
    expect(voiceFieldVisible('stt.enabled', config)).toBe(true)
    expect(voiceFieldVisible('stt.provider', config)).toBe(true)
  })

  it('tracks a provider switch', () => {
    expect(voiceFieldVisible('tts.openai.voice', cfg({ tts: { provider: 'openai', openai: {} } }))).toBe(true)
    expect(voiceFieldVisible('tts.edge.voice', cfg({ tts: { provider: 'openai', openai: {} } }))).toBe(false)
  })

  it('shows OpenAI voice and model when TTS is Work4You Subscription', () => {
    const config = cfg({ tts: { provider: 'work4you', openai: { model: 'gpt-4o-mini-tts', voice: 'alloy' } } })
    expect(voiceFieldVisible('tts.openai.model', config)).toBe(true)
    expect(voiceFieldVisible('tts.openai.voice', config)).toBe(true)
    expect(voiceFieldVisible('tts.edge.voice', config)).toBe(false)
    expect(voiceFieldVisible('tts.elevenlabs.voice_id', config)).toBe(false)
  })

  it('shows OpenAI STT model when STT is Work4You Subscription', () => {
    const config = cfg({ stt: { enabled: true, provider: 'work4you', openai: { model: 'whisper-1' } } })
    expect(voiceFieldVisible('stt.openai.model', config)).toBe(true)
    expect(voiceFieldVisible('stt.local.model', config)).toBe(false)
  })
})
