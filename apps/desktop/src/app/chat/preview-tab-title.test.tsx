import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  $allPreviewTabs,
  closeRightRail,
  openPreview,
  rememberPreviewIcon,
  rememberPreviewTitle,
  rememberPreviewUrl
} from '@/store/preview'

import { PreviewTabLead, PreviewTabTitle, webTabTitle } from './preview-tile'

const copy = { browser: 'Browser', newTab: 'New tab' }

afterEach(() => {
  cleanup()

  for (const tab of $allPreviewTabs.get()) {
    closeRightRail(tab.owner)
  }
})

// A web tab is labelled by its page; the blank page is the new tab; a page
// that hasn't said its name yet is the Browser.
describe('web tab label', () => {
  it('names the new tab page, else the page, else the Browser', () => {
    expect(webTabTitle({ url: 'about:blank' }, copy)).toBe('New tab')
    expect(webTabTitle({ title: 'Example Domain', url: 'about:blank' }, copy)).toBe('New tab')
    expect(webTabTitle({ title: 'Example Domain', url: 'https://example.com' }, copy)).toBe('Example Domain')
    expect(webTabTitle({ url: 'https://example.com' }, copy)).toBe('Browser')
  })

  // Live, without re-registering the pane: re-registering would remount it,
  // and so reload the page.
  it('follows the page as it names itself', () => {
    openPreview({ kind: 'url', label: 'Example', source: 'https://example.com', url: 'https://example.com' })

    const { container } = render(<PreviewTabTitle tabId="url:browser" />)

    expect(container.textContent).toBe('Browser')

    act(() => rememberPreviewTitle('url:browser', 'Example Domain'))
    expect(container.textContent).toBe('Example Domain')
  })

  it('names a blank tab the new tab', () => {
    openPreview({ kind: 'url', label: 'Browser', source: 'about:blank', url: 'about:blank' })

    const { container } = render(<PreviewTabTitle tabId="url:browser" />)

    expect(container.textContent).toBe('New tab')
  })
})

// A web tab leads with its page's icon, painted through main (the
// work4you-favicon scheme); the globe stands in until there is one, on the new
// tab page, and when the icon doesn't load.
describe('web tab icon', () => {
  const icon = (container: HTMLElement) => container.querySelector('img')?.getAttribute('src')

  it('follows the page, else shows the globe', () => {
    openPreview({ kind: 'url', label: 'Example', source: 'https://example.com', url: 'https://example.com' })

    const { container } = render(<PreviewTabLead tabId="url:browser" />)

    expect(icon(container)).toBeUndefined()
    expect(container.querySelector('svg')).not.toBeNull()

    act(() => rememberPreviewIcon('url:browser', 'https://example.com/favicon.ico'))
    expect(icon(container)).toBe(`work4you-favicon://icon/${encodeURIComponent('https://example.com/favicon.ico')}`)

    act(() => rememberPreviewUrl('url:browser', 'about:blank'))
    expect(icon(container)).toBeUndefined()
  })

  it("falls back to the globe when the icon doesn't load, and tries the page's next one", () => {
    openPreview({ kind: 'url', label: 'Example', source: 'https://example.com', url: 'https://example.com' })
    rememberPreviewIcon('url:browser', 'https://example.com/missing.ico')

    const { container } = render(<PreviewTabLead tabId="url:browser" />)
    const img = container.querySelector('img')

    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(icon(container)).toBeUndefined()
    expect(container.querySelector('svg')).not.toBeNull()

    act(() => rememberPreviewIcon('url:browser', 'https://example.com/icon.svg'))
    expect(icon(container)).toBe(`work4you-favicon://icon/${encodeURIComponent('https://example.com/icon.svg')}`)
  })
})
