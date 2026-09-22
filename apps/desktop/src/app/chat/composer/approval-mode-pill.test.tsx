import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const { requestGateway } = vi.hoisted(() => ({
  requestGateway: vi.fn()
}))

vi.mock('@/app/gateway/hooks/use-gateway-request', () => ({
  useGatewayRequest: () => ({ requestGateway })
}))

import { I18nProvider } from '@/i18n'
import { $approvalModes } from '@/store/approval-mode'
import { $activeGatewayProfile } from '@/store/profile'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { ApprovalModePill } from './approval-mode-pill'

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  $approvalModes.set({})
  $activeGatewayProfile.set('default')
  requestGateway.mockReset()
})

function hang() {
  return new Promise<never>(() => undefined)
}

describe('ApprovalModePill', () => {
  it('shows the cached mode label for the active gateway profile', () => {
    requestGateway.mockImplementation(() => hang())
    $activeGatewayProfile.set('work')
    $approvalModes.set({ default: 'manual', work: 'off' })

    render(<ApprovalModePill disabled={false} />)

    const trigger = screen.getByRole('button', { name: /approval mode: off/i })

    expect(trigger.getAttribute('data-slot')).toBe('composer-approval-mode')
    expect(trigger.textContent).toMatch(/off/i)
    expect(screen.queryByRole('button', { name: /approval mode: manual/i })).toBeNull()
  })

  it('writes the selected mode through the gateway', async () => {
    requestGateway.mockImplementation(async (_method, params) => ({ value: params?.value ?? 'smart' }))

    render(<ApprovalModePill disabled={false} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: /approval mode: smart/i }), { button: 0 })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /off/i }))

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.set', { key: 'approvals.mode', value: 'off' })
      expect(screen.getByRole('button', { name: /approval mode: off/i })).toBeTruthy()
    })
  })

  it('syncs the active profile from the gateway on mount', async () => {
    requestGateway.mockResolvedValue({ value: 'manual' })

    render(<ApprovalModePill disabled={false} />)

    await waitFor(() => {
      expect(requestGateway).toHaveBeenCalledWith('config.get', { key: 'approvals.mode' })
      expect(screen.getByRole('button', { name: /approval mode: manual/i })).toBeTruthy()
    })
  })

  it('keeps the compact HUD trigger icon-only', () => {
    requestGateway.mockImplementation(() => hang())

    render(<ApprovalModePill compact disabled={false} />)

    const trigger = screen.getByRole('button', { name: /approval mode: smart/i })

    expect(trigger.getAttribute('data-slot')).toBe('composer-approval-mode')
    expect(trigger.textContent).not.toMatch(/smart|manual|off/i)
  })

  it('disables only when the composer is disabled', () => {
    requestGateway.mockImplementation(() => hang())

    const { rerender } = render(<ApprovalModePill disabled={false} />)

    expect((screen.getByRole('button', { name: /approval mode: smart/i }) as HTMLButtonElement).disabled).toBe(false)

    rerender(<ApprovalModePill disabled />)

    expect((screen.getByRole('button', { name: /approval mode: smart/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders the shared menu in the active locale', async () => {
    requestGateway.mockImplementation(() => hang())

    render(
      <I18nProvider configClient={null} initialLocale="ja">
        <ApprovalModePill disabled={false} />
      </I18nProvider>
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: '承認モード: スマート' }), { button: 0 })

    expect(await screen.findByRole('menuitemradio', { name: /手動/ })).toBeTruthy()
    expect(screen.getByText('必要な場合にのみ確認します')).toBeTruthy()
    expect(screen.getByText('承認プロンプトなしで実行します')).toBeTruthy()
  })
})
