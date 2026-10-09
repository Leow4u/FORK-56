import { describe, expect, it, vi } from 'vitest'

import { terminalSelectionAnchor } from './selection'

function selectionHost(offsetLeft: number, offsetTop: number, selection = new DOMRect(40, 36, 40, 12)) {
  const parent = document.createElement('div')
  const host = document.createElement('div')
  const parentRect = new DOMRect(300, 200, 400, 300)
  const hostRect = new DOMRect(parentRect.left + offsetLeft, parentRect.top + offsetTop, 320, 180)

  const selectionRect = new DOMRect(
    hostRect.left + selection.left,
    hostRect.top + selection.top,
    selection.width,
    selection.height
  )

  parent.style.position = 'absolute'
  parent.append(host)
  host.innerHTML = '<div class="xterm-selection"><div></div></div>'
  host.getBoundingClientRect = vi.fn(() => hostRect)
  host.querySelector<HTMLElement>('.xterm-selection div')!.getBoundingClientRect = vi.fn(() => selectionRect)
  Object.defineProperties(host, {
    clientHeight: { value: hostRect.height },
    clientWidth: { value: hostRect.width },
    offsetLeft: { value: offsetLeft },
    offsetParent: { value: parent },
    offsetTop: { value: offsetTop }
  })

  return { host, parentRect, selectionRect }
}

describe('terminalSelectionAnchor', () => {
  it.each([
    [0, 0],
    [8, 8],
    [20, 28]
  ])('keeps the popup beside the selection when the host is inset by %i, %i', (left, top) => {
    const { host, parentRect, selectionRect } = selectionHost(left, top)
    const anchor = terminalSelectionAnchor(host)

    expect(anchor).not.toBeNull()
    expect(Number(anchor!.left) + parentRect.left).toBe(selectionRect.left)
    expect(Number(anchor!.top) + parentRect.top).toBe(selectionRect.bottom + 4)
  })

  it.each([
    [-50, -50],
    [500, 500]
  ])('keeps the popup inside the inset host for an outlying selection at %i, %i', (left, top) => {
    const { host } = selectionHost(20, 28, new DOMRect(left, top, 10, 10))
    const anchor = terminalSelectionAnchor(host)

    expect(anchor).not.toBeNull()
    expect(Number(anchor!.left)).toBeGreaterThanOrEqual(host.offsetLeft + 8)
    expect(Number(anchor!.left) + 128).toBeLessThanOrEqual(host.offsetLeft + host.clientWidth - 8)
    expect(Number(anchor!.top)).toBeGreaterThanOrEqual(host.offsetTop + 8)
    expect(Number(anchor!.top) + 26).toBeLessThanOrEqual(host.offsetTop + host.clientHeight - 8)
  })

  it('returns no anchor without a visible selection', () => {
    const { host } = selectionHost(8, 8, new DOMRect(40, 36, 0, 12))

    expect(terminalSelectionAnchor(host)).toBeNull()

    host.replaceChildren()
    expect(terminalSelectionAnchor(host)).toBeNull()
  })
})
