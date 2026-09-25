import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getWork4YouConfigRecord = vi.fn()
const getWork4YouConfigSchema = vi.fn()
const getElevenLabsVoices = vi.fn()
const saveWork4YouConfig = vi.fn()

vi.mock('@/work4you', () => ({
  getWork4YouConfigRecord: () => getWork4YouConfigRecord(),
  getWork4YouConfigSchema: () => getWork4YouConfigSchema(),
  getElevenLabsVoices: () => getElevenLabsVoices(),
  saveWork4YouConfig: (config: unknown) => saveWork4YouConfig(config),
  getApiRequestProfile: () => 'default',
  setApiRequestProfile: () => {}
}))

const schema = {
  fields: {
    'stt.enabled': { type: 'boolean' },
    'stt.echo_transcripts': { type: 'boolean' },
    'stt.provider': { type: 'select', options: ['local', 'openai'] },
    'tts.provider': { type: 'select', options: ['edge', 'openai', 'work4you'] },
    'tts.openai.model': { type: 'string' },
    'tts.openai.voice': { type: 'string' },
    'tts.edge.voice': { type: 'string' },
    'tts.elevenlabs.voice_id': { type: 'string' },
    'voice.auto_tts': { type: 'boolean' },
    'voice.record_key': { type: 'string' },
    'voice.max_recording_seconds': { type: 'number' }
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function renderVoice() {
  getWork4YouConfigRecord.mockResolvedValue({
    stt: { enabled: true, echo_transcripts: true, provider: 'local' },
    tts: {
      provider: 'edge',
      edge: { voice: 'en-US-AriaNeural' },
      openai: { model: 'gpt-4o-mini-tts', voice: 'alloy' }
    },
    voice: { auto_tts: false, record_key: 'ctrl+b', max_recording_seconds: 120 }
  })
  getWork4YouConfigSchema.mockResolvedValue(schema)
  getElevenLabsVoices.mockResolvedValue({ available: false, voices: [] })
  saveWork4YouConfig.mockResolvedValue({ ok: true })

  const { ConfigSettings } = await import('./config-settings')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConfigSettings activeSectionId="voice" importInputRef={{ current: null }} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Voice settings', () => {
  it('shows dictation, echo, read aloud, the subscription voice, and the shortcut', async () => {
    await renderVoice()

    expect(await screen.findByText('Dictation')).toBeTruthy()
    expect(screen.getByText('Echo Transcripts')).toBeTruthy()
    expect(screen.getByText('Read Responses Aloud')).toBeTruthy()
    expect(screen.getByText('The voice Work4You uses when it speaks.')).toBeTruthy()
    expect(screen.getByText('Voice Shortcut')).toBeTruthy()
    expect(screen.getByDisplayValue('alloy')).toBeTruthy()
    expect(screen.queryByText('Text-To-Speech Provider')).toBeNull()
    expect(screen.queryByText('Speech-To-Text Provider')).toBeNull()
    expect(screen.queryByText('OpenAI TTS Model')).toBeNull()
    expect(screen.queryByText('Edge Voice')).toBeNull()
    expect(screen.queryByText('ElevenLabs Voice')).toBeNull()
    expect(screen.queryByText('Max Recording Length')).toBeNull()
    expect(screen.queryByDisplayValue('gpt-4o-mini-tts')).toBeNull()
  })
})
