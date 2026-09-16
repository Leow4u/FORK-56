import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { ComposerScopeProvider, MAIN_COMPOSER_SCOPE } from '@/app/chat/composer/scope'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $currentUsage } from '@/store/session'
import { $sessionStates } from '@/store/session-states'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'
import type { UsageStats } from '@/types/work4you'

import { contextUsageOccupancyTip } from './context-usage-label'
import { ComposerContextUsage, ContextUsagePill } from './context-usage-pill'

const usage: UsageStats = {
  calls: 1,
  context_max: 272_000,
  context_percent: 47,
  context_used: 128_200,
  input: 0,
  output: 0,
  total: 0
}

const occupancy = contextUsageOccupancyTip(usage, (used, max) => `${used} / ${max} Tokens`)

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  $currentUsage.set({ calls: 0, input: 0, output: 0, total: 0 })
  $sessionStates.set({})
})

async function occupancyTooltip(name = 'Context usage') {
  const trigger = screen.getByRole('button', { name })

  fireEvent.pointerMove(trigger, { pointerType: 'mouse' })

  return screen.findByRole('tooltip')
}

describe('ComposerContextUsage', () => {
  it('hides when the host says the meter is off', () => {
    const { container } = render(<ComposerContextUsage busy={false} hidden />)

    expect(container.querySelector('[data-slot="composer-context-usage"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Context usage' })).toBeNull()
  })

  it('shows the chip when the host leaves it visible', () => {
    const { container } = render(<ComposerContextUsage busy={false} hidden={false} />)

    expect(container.querySelector('[data-slot="composer-context-usage"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Context usage' })).toBeTruthy()
  })
})

describe('ContextUsagePill', () => {
  it('keeps occupancy off the chip when the session has no context max', async () => {
    render(<ContextUsagePill busy={false} />)

    const trigger = screen.getByRole('button', { name: 'Context usage' })

    expect(trigger.textContent).toBe('')
    expect(trigger.querySelector('[data-slot="context-usage-ring"]')?.getAttribute('data-percent')).toBe('0')
    expect((await occupancyTooltip()).textContent).toBe('0%')
  })

  it('shows occupancy on hover and opens the existing breakdown panel', async () => {
    $currentUsage.set(usage)

    render(<ContextUsagePill busy={false} sessionId="runtime-1" />)

    const trigger = screen.getByRole('button', { name: 'Context usage' })

    expect(trigger.textContent).toBe('')
    expect(trigger.querySelector('[data-slot="context-usage-ring"]')?.getAttribute('data-percent')).toBe('47')
    expect((await occupancyTooltip()).textContent).toBe(occupancy)

    fireEvent.pointerDown(trigger, { button: 0 })

    expect(await screen.findByText('Context Usage')).toBeTruthy()
    expect(screen.getByText('47% Full')).toBeTruthy()
  })

  it('reads a tile session from $sessionStates instead of the primary gauge', async () => {
    $currentUsage.set(usage)
    $sessionStates.set({
      'tile-runtime': {
        ...createClientSessionState('stored-1'),
        usage: { ...usage, context_percent: 12, context_used: 32_000 }
      }
    })

    render(
      <ComposerScopeProvider value={{ ...MAIN_COMPOSER_SCOPE, target: 'tile:pane-1' }}>
        <ContextUsagePill busy={false} sessionId="tile-runtime" />
      </ComposerScopeProvider>
    )

    const trigger = screen.getByRole('button', { name: 'Context usage' })

    expect(trigger.querySelector('[data-slot="context-usage-ring"]')?.getAttribute('data-percent')).toBe('12')
    expect((await occupancyTooltip()).textContent).toContain('12%')
  })
})
