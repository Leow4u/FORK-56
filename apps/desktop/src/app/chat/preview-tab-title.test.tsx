import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $allPreviewTabs, closeRightRail, openPreview, rememberPreviewTitle } from '@/store/preview'

import { PreviewTabTitle, webTabTitle } from './preview-tile'

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
