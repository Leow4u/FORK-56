import { type ToolCallMessagePartProps } from '@assistant-ui/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'

import { AgentDeliveryNotice, deliveryTargetFromCommand, replyTextFromResult } from './agent-delivery'

// Sender-side inter-agent deliveries render as "Messaged X" / "Message from
// X" notices instead of terminal transcript rows. This pins the detection
// (the canonical Bot Mode command shape) and the reply extraction.
describe('delivery command detection', () => {
  it('matches the canonical delivery command', () => {
    const cmd = 'work4you -p turqoise chat --in ~ -c "Bot Chat" -Q -q "Message from 🤖 Work4You (@work4you): hi there"'

    expect(deliveryTargetFromCommand(cmd)).toBe('turqoise')
  })

  it('matches with a cd prefix and timeout wrapper', () => {
    const cmd = 'cd ~ && timeout 240 work4you -p mr-tester chat --in "~" -Q -q "Message from 🤖 Work4You: hello"'

    expect(deliveryTargetFromCommand(cmd)).toBe('mr-tester')
  })

  it('ignores ordinary terminal commands', () => {
    expect(deliveryTargetFromCommand('ls -la')).toBeNull()
    expect(deliveryTargetFromCommand('work4you -p turqoise chat -q "plain question"')).toBeNull()
    expect(deliveryTargetFromCommand('work4you sessions list')).toBeNull()
  })
})

describe('reply extraction', () => {
  it('strips session_id bookkeeping and keeps the reply', () => {
    const output = 'session_id: 20260813_220347_f69ac6\nHi Work4You! Good to hear from you.'

    expect(replyTextFromResult({ output })).toBe('Hi Work4You! Good to hear from you.')
  })

  it('unwraps JSON-shaped terminal results', () => {
    const result = JSON.stringify({ exit_code: 0, output: 'session_id: abc\nack' })

    expect(replyTextFromResult(result)).toBe('ack')
  })

  it('returns empty for empty results', () => {
    expect(replyTextFromResult(undefined)).toBe('')
    expect(replyTextFromResult({ output: '' })).toBe('')
  })
})

describe('delivery notice', () => {
  afterEach(cleanup)

  const command = 'work4you -p coder chat --in ~ -Q -q "Message from 🤖 Work4You (@work4you): ping"'

  const notice = (result?: unknown) => {
    const props = {
      args: { command },
      isError: false,
      result,
      toolCallId: 'd1',
      toolName: 'terminal'
    } as unknown as ToolCallMessagePartProps

    return (
      <I18nProvider configClient={null} initialLocale="pt">
        <AgentDeliveryNotice {...props} />
      </I18nProvider>
    )
  }

  it('reads in the app language, while sending and once the reply lands', () => {
    const sending = render(notice())

    expect(sending.container.textContent).toContain('Enviando mensagem para coder…')
    sending.unmount()

    const replied = render(notice({ output: 'session_id: abc\npong' }))

    expect(replied.container.textContent).toContain('Mensagem enviada para coder')
    expect(replied.container.textContent).toContain('Mensagem de coder')
    expect(replied.container.textContent).toContain('ver mensagem')
  })
})
