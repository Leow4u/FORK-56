import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { McpSetupCard, McpSetupMark } from './mcp-setup-card'

afterEach(() => {
  cleanup()
})

describe('McpSetupMark', () => {
  it('paints a trusted Composio CDN mark', () => {
    const { container } = render(<McpSetupMark logo="https://logos.composio.dev/api/gmail" name="Gmail" />)
    const img = container.querySelector('img')

    expect(img?.getAttribute('src')).toBe('https://logos.composio.dev/api/gmail')
    expect(img?.getAttribute('referrerpolicy') ?? img?.getAttribute('referrerPolicy')).toBe('no-referrer')
  })

  it('rejects an untrusted logo URL and falls back to a letter', () => {
    const { container } = render(<McpSetupMark logo="https://evil.example/gmail.png" name="Gmail" />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('G')
  })

  it('uses the curated GitHub glyph when there is no CDN mark', () => {
    const { container } = render(<McpSetupMark name="github" />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('McpSetupCard', () => {
  it('lays out the connector identity with the connect action on the right', () => {
    render(
      <McpSetupCard
        action={<button type="button">Connect</button>}
        decline={<button type="button">Not now</button>}
        header="Connectors that can help"
        label="Connect Gmail?"
        logo="https://logos.composio.dev/api/gmail"
        markName="Gmail"
        subtitle="Draft replies, summarize threads, & search your inbox"
        title="Gmail"
      />
    )

    const card = screen.getByRole('group', { name: 'Connect Gmail?' })

    expect(card.getAttribute('data-slot')).toBe('mcp-setup-inline')
    expect(screen.getByText('Connectors that can help')).toBeTruthy()
    expect(screen.getByText('Gmail')).toBeTruthy()
    expect(screen.getByText('Draft replies, summarize threads, & search your inbox')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy()
    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://logos.composio.dev/api/gmail')
  })

  it('keeps Connect and Not now available — it does not collapse decline into an unlabeled close', () => {
    render(
      <McpSetupCard
        action={<button type="button">Connect</button>}
        decline={<button type="button">Not now</button>}
        label="Connect Gmail?"
        markName="Gmail"
        title="Gmail"
      />
    )

    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
  })
})
