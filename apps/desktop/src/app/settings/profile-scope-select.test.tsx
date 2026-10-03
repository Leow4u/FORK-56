// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Keep store/profile's side-effecting imports inert — same seam as
// profile-scope.test.tsx (the face reads the profile look stores).
vi.mock('@/store/gateway', () => ({
  $gateway: atom<unknown>(null),
  ensureGatewayForAgent: vi.fn(async () => undefined),
  ensureGatewayForProfile: vi.fn(async () => undefined),
  openGatewayForProfile: vi.fn(async () => undefined)
}))
vi.mock('@/work4you', () => ({
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn()
}))
vi.mock('@/lib/query-client', () => ({ invalidateProfileScopedQueries: vi.fn() }))
vi.mock('@/store/starmap', () => ({ resetStarmapGraph: vi.fn() }))
vi.mock('@/lib/bot-face-clock', () => ({ startFaceClock: vi.fn() }))

const { ProfileScopeSelect } = await import('./profile-scope-select')

const options = [
  { key: 'default', label: 'Work4You', profile: 'default', value: 'default' },
  { key: 'researcher', label: 'Pesquisa', profile: 'researcher', value: 'researcher' }
]

beforeEach(() => {
  // jsdom's scrollIntoView is missing; Radix Select calls it on open.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

describe('ProfileScopeSelect', () => {
  it('shows the label and the selected profile name in the trigger', () => {
    render(<ProfileScopeSelect label="Configuring:" onChange={vi.fn()} options={options} value="default" />)

    expect(screen.getByText('Configuring:')).toBeTruthy()
    expect(screen.getByRole('combobox').textContent).toContain('Work4You')
  })

  it('lists every option and reports the picked value', async () => {
    const onChange = vi.fn()

    render(<ProfileScopeSelect label="Configuring:" onChange={onChange} options={options} value="default" />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Pesquisa' }))

    expect(onChange).toHaveBeenCalledWith('researcher')
  })
})
