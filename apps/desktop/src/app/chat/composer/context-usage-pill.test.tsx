import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { ComposerScopeProvider, MAIN_COMPOSER_SCOPE } from '@/app/chat/composer/scope'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $currentUsage } from '@/store/session'
import { $sessionStates } from '@/store/session-states'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'
import type { UsageStats } from '@/types/work4you'

import { ContextUsagePill } from './context-usage-pill'

const usage: UsageStats = {
  calls: 1,
  context_max: 272_000,
  context_percent: 47,
  context_used: 128_200,
  input: 0,
  output: 0,
  total: 0
}

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  $currentUsage.set({ calls: 0, input: 0, output: 0, total: 0 })
  $sessionStates.set({})
})

describe('ContextUsagePill', () => {
  it('stays on the composer at 0% when the session has no context max', () => {
    render(<ContextUsagePill busy={false} />)

    expect(screen.getByRole('button', { name: 'Context usage' }).textContent).toBe('0%')
  })

  it('paints primary occupancy and opens the existing breakdown panel', async () => {
    $currentUsage.set(usage)

    render(<ContextUsagePill busy={false} sessionId="runtime-1" />)

    const trigger = screen.getByRole('button', { name: 'Context usage' })

    expect(trigger.textContent).toBe('47%')

    fireEvent.pointerDown(trigger, { button: 0 })

    expect(await screen.findByText('Context Usage')).toBeTruthy()
    expect(screen.getByText('47% Full')).toBeTruthy()
  })

  it('reads a tile session from $sessionStates instead of the primary gauge', () => {
    $currentUsage.set(usage)
    $sessionStates.set({
      'tile-runtime': {
        ...createClientSessionState('stored-1'),
        usage: { ...usage, context_percent: 12 }
      }
    })

    render(
      <ComposerScopeProvider value={{ ...MAIN_COMPOSER_SCOPE, target: 'tile:pane-1' }}>
        <ContextUsagePill busy={false} sessionId="tile-runtime" />
      </ComposerScopeProvider>
    )

    expect(screen.getByRole('button', { name: 'Context usage' }).textContent).toBe('12%')
  })
})
