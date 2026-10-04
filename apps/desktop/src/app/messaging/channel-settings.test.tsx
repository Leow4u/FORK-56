// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type * as NanostoresModule from 'nanostores'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MessagingPlatformInfo } from '@/types/work4you'

vi.mock('@/work4you', () => ({ updateMessagingPlatform: vi.fn() }))

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

vi.mock('@/store/system-actions', async () => {
  const { atom } = await vi.importActual<typeof NanostoresModule>('nanostores')

  return { $gatewayRestarting: atom(false), runGatewayRestart: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const waitingOnRestart: MessagingPlatformInfo = {
  configured: true,
  description: '',
  docs_url: '',
  enabled: true,
  env_vars: [],
  gateway_running: true,
  id: 'slack',
  name: 'Slack',
  state: 'pending_restart'
}

describe('ConnectionRow', () => {
  it('restarts the gateway of the profile being configured', async () => {
    const { runGatewayRestart } = await import('@/store/system-actions')
    const { ConnectionRow } = await import('./channel-settings')

    render(
      <ConnectionRow
        onRunSteps={vi.fn()}
        onTest={vi.fn()}
        platform={waitingOnRestart}
        scopeProfile="work"
        testing={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /restart gateway/i }))

    expect(runGatewayRestart).toHaveBeenCalledWith('work')
  })
})
