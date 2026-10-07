import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PaneTab, PaneTabLabel, PaneTabStrip } from './pane-tab'

afterEach(cleanup)

describe('PaneTab close gestures', () => {
  it('middle-click closes — pointer events only, no auxclick', () => {
    const onClose = vi.fn()
    render(
      <PaneTab onClose={onClose}>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    const tab = screen.getByText('tab')
    fireEvent.pointerDown(tab, { button: 1 })
    fireEvent.pointerUp(tab, { button: 1 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('⌘-click (metaKey + button 0) closes — the Mac middle-click equivalent', () => {
    const onClose = vi.fn()
    render(
      <PaneTab onClose={onClose}>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    fireEvent.pointerDown(screen.getByText('tab'), { button: 0, metaKey: true })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('⌘-click preempts the shell drag/activate pointerdown handler', () => {
    const onClose = vi.fn()
    const onPointerDown = vi.fn()
    render(
      <PaneTab onClose={onClose} onPointerDown={onPointerDown}>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    fireEvent.pointerDown(screen.getByText('tab'), { button: 0, metaKey: true })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('⌘-click swallows the follow-up activation click (capture phase)', () => {
    const onClose = vi.fn()
    const onActivate = vi.fn()
    render(
      <PaneTab onClose={onClose}>
        <PaneTabLabel as="button" onClick={onActivate}>
          tab
        </PaneTabLabel>
      </PaneTab>
    )

    fireEvent.click(screen.getByText('tab'), { button: 0, metaKey: true })
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('plain left-click neither closes nor blocks activation', () => {
    const onClose = vi.fn()
    const onActivate = vi.fn()
    const onPointerDown = vi.fn()
    render(
      <PaneTab onClose={onClose} onPointerDown={onPointerDown}>
        <PaneTabLabel as="button" onClick={onActivate}>
          tab
        </PaneTabLabel>
      </PaneTab>
    )

    fireEvent.pointerDown(screen.getByText('tab'), { button: 0 })
    fireEvent.click(screen.getByText('tab'), { button: 0 })
    expect(onClose).not.toHaveBeenCalled()
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('does nothing without an onClose (uncloseable workspace tab)', () => {
    const onPointerDown = vi.fn()
    render(
      <PaneTab onPointerDown={onPointerDown}>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    fireEvent.pointerDown(screen.getByText('tab'), { button: 0, metaKey: true })
    expect(onPointerDown).toHaveBeenCalledTimes(1)
  })
})

describe('PaneTab hover close button', () => {
  it('clicking the ✕ closes without activating or dragging the tab', () => {
    const onClose = vi.fn()
    const onActivate = vi.fn()
    const onPointerDown = vi.fn()
    render(
      <PaneTab onClose={onClose} onPointerDown={onPointerDown}>
        <PaneTabLabel as="button" onClick={onActivate}>
          tab
        </PaneTabLabel>
      </PaneTab>
    )

    const close = screen.getByRole('button', { name: 'Close' })
    fireEvent.pointerDown(close, { button: 0 })
    fireEvent.click(close, { button: 0 })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onActivate).not.toHaveBeenCalled()
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('renders no ✕ without an onClose', () => {
    render(
      <PaneTab>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('can hide the hover ✕ while retaining the close handler', () => {
    const onClose = vi.fn()
    render(
      <PaneTab onClose={onClose} showCloseButton={false}>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    const tab = screen.getByText('tab')
    fireEvent.pointerDown(tab, { button: 1 })
    fireEvent.pointerUp(tab, { button: 1 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders no ✕ on a vertical rail tab (middle/⌘-click only there)', () => {
    const onClose = vi.fn()
    render(
      <PaneTab onClose={onClose} vertical>
        <PaneTabLabel>tab</PaneTabLabel>
      </PaneTab>
    )

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

// The content area's strip: the ✕ is always there, in a slot of its own, so the
// title truncates before it instead of running underneath.
describe('PaneTab on a surface strip', () => {
  it('keeps the ✕ in the tab itself, and it closes without activating or dragging', () => {
    const onClose = vi.fn()
    const onActivate = vi.fn()
    const onPointerDown = vi.fn()
    render(
      <PaneTabStrip variant="surface">
        <PaneTab onClose={onClose} onPointerDown={onPointerDown} role="tab">
          <PaneTabLabel as="button" onClick={onActivate}>
            tab
          </PaneTabLabel>
        </PaneTab>
      </PaneTabStrip>
    )

    const close = screen.getByRole('button', { name: 'Close' })

    expect(close.parentElement).toBe(screen.getByRole('tab'))

    fireEvent.pointerDown(close, { button: 0 })
    fireEvent.click(close, { button: 0 })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onActivate).not.toHaveBeenCalled()
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('leaves a vertical rail tab to middle/⌘-click', () => {
    render(
      <PaneTabStrip variant="surface">
        <PaneTab onClose={vi.fn()} vertical>
          <PaneTabLabel>tab</PaneTabLabel>
        </PaneTab>
      </PaneTabStrip>
    )

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

// A content-area title cut short shows in full on a lingering hover — and only
// when it IS cut short; other strips keep their labels as they are.
describe('PaneTab full title', () => {
  const title = 'quarterly-report-with-a-very-long-name.html'

  const overflowing = (el: HTMLElement) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 300 })
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 100 })
  }

  const hover = (el: HTMLElement) =>
    act(() => {
      fireEvent.pointerEnter(el)
      vi.advanceTimersByTime(700)
    })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a cut-short title in full on a surface strip', () => {
    vi.useFakeTimers()
    render(
      <PaneTabStrip variant="surface">
        <PaneTab>
          <PaneTabLabel>{title}</PaneTabLabel>
        </PaneTab>
      </PaneTabStrip>
    )

    const label = screen.getByText(title)

    overflowing(label)
    hover(label)
    expect(screen.getByRole('tooltip').textContent).toContain(title)
  })

  it('adds no tooltip to the other strips', () => {
    vi.useFakeTimers()
    render(
      <PaneTabStrip>
        <PaneTab>
          <PaneTabLabel>{title}</PaneTabLabel>
        </PaneTab>
      </PaneTabStrip>
    )

    const label = screen.getByText(title)

    overflowing(label)
    hover(label)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
