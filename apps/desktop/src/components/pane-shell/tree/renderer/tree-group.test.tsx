import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'

import type { GroupNode } from '../model'

import { TreeGroup } from './tree-group'

let root: null | Root = null
let container: HTMLDivElement | null = null
let disposePane: (() => void) | null = null

function render(ui: ReactNode) {
  if (!container) {
    container = globalThis.document.createElement('div')
    globalThis.document.body.append(container)
    root = createRoot(container)
  }

  act(() => {
    root!.render(ui)
  })
}

function terminalGroup(minimized: boolean): GroupNode {
  return {
    active: 'terminal',
    headerHidden: false,
    id: 'terminal-zone',
    minimized,
    panes: ['terminal'],
    type: 'group'
  }
}

const toggle = (label: string) =>
  globalThis.document.querySelector<HTMLButtonElement>(
    `[data-tree-group="terminal-zone"] button[aria-label="${label}"]`
  )!

afterEach(() => {
  if (root) {
    act(() => root!.unmount())
  }

  container?.remove()
  disposePane?.()
  root = null
  container = null
  disposePane = null
  vi.unstubAllGlobals()
})

describe('TreeGroup', () => {
  it('points the docked-zone chevron in the collapse or restore action direction', () => {
    disposePane = registry.register({
      area: 'panes',
      data: { height: '12rem' },
      id: 'terminal',
      render: () => <div>Terminal</div>,
      title: 'Terminal'
    })
    // jsdom does not implement CSS.escape, which the real tab-strip effect uses.
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    render(<TreeGroup node={terminalGroup(false)} parentAxis="column" />)

    expect(toggle('Minimize').querySelector('i')!.className).toContain('codicon-chevron-down')
    expect(globalThis.document.querySelector('[data-tree-group="terminal-zone"]')?.className).not.toContain(
      'rounded-tl-(--ui-stage-radius)'
    )

    render(<TreeGroup node={terminalGroup(true)} parentAxis="column" />)

    expect(toggle('Restore').querySelector('i')!.className).toContain('codicon-chevron-up')
  })

  it('rounds the top rail-facing corner of the conversation stage only', () => {
    disposePane = registry.register({
      area: 'panes',
      data: { placement: 'main' },
      id: 'workspace',
      render: () => <div>Chat</div>,
      title: 'Workspace'
    })
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    render(
      <TreeGroup
        node={{
          active: 'workspace',
          headerHidden: true,
          id: 'main-zone',
          panes: ['workspace'],
          type: 'group'
        }}
      />
    )

    const stage = globalThis.document.querySelector('[data-tree-group="main-zone"]')
    expect(stage?.className).toContain('rounded-tl-(--ui-stage-radius)')
    expect(stage?.className).not.toMatch(/rounded-bl|m-[0-9]|inset/)
  })
})
