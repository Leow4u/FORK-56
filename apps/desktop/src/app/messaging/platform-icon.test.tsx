import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlatformAvatar } from './platform-icon'

describe('PlatformAvatar brand marks', () => {
  it('renders SVG marks instead of letter monograms for Slack, Teams, and Graph', () => {
    const { container: slack } = render(
      <PlatformAvatar platformId="slack" platformName="Slack" variant="tile" />
    )
    expect(slack.textContent).not.toContain('S')
    expect(slack.querySelector('svg path[fill="#E01E5A"]')).not.toBeNull()

    const { container: teams } = render(
      <PlatformAvatar platformId="teams" platformName="Microsoft Teams" variant="tile" />
    )
    expect(teams.textContent).not.toContain('T')
    expect(teams.querySelector('svg path')).not.toBeNull()

    const { container: graph } = render(
      <PlatformAvatar platformId="msgraph_webhook" platformName="Microsoft Graph Webhook" variant="tile" />
    )
    expect(graph.querySelector('svg path[fill="#F25022"]')).not.toBeNull()
    expect(graph.querySelector('svg path[fill="#00A4EF"]')).not.toBeNull()
  })

  it('keeps accessible platform name out of the decorative avatar', () => {
    render(<PlatformAvatar platformId="slack" platformName="Slack" variant="tile" />)
    expect(screen.queryByText('Slack')).toBeNull()
  })
})
