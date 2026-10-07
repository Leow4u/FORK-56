import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'

import type { GroupNode } from '../model'
import { $newContentTabAction } from '../store'

import { TreeGroup } from './tree-group'

let root: null | Root = null
let container: HTMLDivElement | null = null
const disposePanes: Array<() => void> = []

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

  while (disposePanes.length) {
    disposePanes.pop()?.()
  }

  root = null
  container = null
  vi.unstubAllGlobals()
})

describe('TreeGroup', () => {
  it('points the docked-zone chevron in the collapse or restore action direction', () => {
    disposePanes.push(
      registry.register({
        area: 'panes',
        data: { height: '12rem' },
        id: 'terminal',
        render: () => <div>Terminal</div>,
        title: 'Terminal'
      })
    )
    // jsdom does not implement CSS.escape, which the real tab-strip effect uses.
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    render(<TreeGroup node={terminalGroup(false)} parentAxis="column" />)

    expect(toggle('Minimize').querySelector('i')!.className).toContain('codicon-chevron-down')
    const rail = globalThis.document.querySelector('[data-tree-group="terminal-zone"]')
    expect(rail?.className).toContain('bg-(--ui-sidebar-surface-background)')
    expect(rail?.className).not.toContain('rounded-tl-(--ui-stage-radius)')
    expect(rail?.className).not.toContain('--ui-chat-surface-background')

    render(<TreeGroup node={terminalGroup(true)} parentAxis="column" />)

    expect(toggle('Restore').querySelector('i')!.className).toContain('codicon-chevron-up')
  })

  it('rounds the top rail-facing corner of the conversation stage only', () => {
    disposePanes.push(
      registry.register({
        area: 'panes',
        data: { placement: 'main' },
        id: 'workspace',
        render: () => <div>Chat</div>,
        title: 'Workspace'
      })
    )
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
    expect(stage?.className).toContain('bg-(--ui-chat-surface-background)')
    expect(stage?.className).toContain('rounded-tl-(--ui-stage-radius)')
    expect(stage?.className).toContain('rounded-tr-(--ui-stage-radius)')
    expect(stage?.className).not.toMatch(/rounded-bl|m-[0-9]|inset/)
  })

  it('paints the Bots roster and a main-placement Cronjobs tile on the rail', () => {
    disposePanes.push(
      registry.register({
        area: 'panes',
        data: { placement: 'left' },
        id: 'sessions',
        render: () => <div>Sessions</div>,
        title: 'Sessions'
      }),
      registry.register({
        area: 'panes',
        data: { hideOnly: true, placement: 'left' },
        id: 'work4you-bots:pane',
        render: () => <div>Bots</div>,
        title: 'Bots'
      }),
      registry.register({
        area: 'panes',
        data: { placement: 'main' },
        id: 'work4you-bots:routines',
        render: () => <div>Cronjobs</div>,
        title: 'Cronjobs'
      })
    )
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    render(
      <TreeGroup
        node={{
          active: 'work4you-bots:pane',
          headerHidden: false,
          id: 'sessions-zone',
          panes: ['sessions', 'work4you-bots:pane'],
          type: 'group'
        }}
      />
    )

    const bots = globalThis.document.querySelector('[data-tree-group="sessions-zone"]')
    expect(bots?.className).toContain('bg-(--ui-sidebar-surface-background)')
    expect(bots?.className).not.toContain('--ui-chat-surface-background')
    expect(bots?.className).not.toContain('rounded-tl-(--ui-stage-radius)')

    render(
      <TreeGroup
        node={{
          active: 'work4you-bots:routines',
          headerHidden: false,
          id: 'routines-zone',
          panes: ['work4you-bots:routines'],
          type: 'group'
        }}
      />
    )

    const cron = globalThis.document.querySelector('[data-tree-group="routines-zone"]')
    expect(cron?.className).toContain('bg-(--ui-sidebar-surface-background)')
    expect(cron?.className).not.toContain('--ui-chat-surface-background')
    expect(cron?.className).not.toContain('rounded-tl-(--ui-stage-radius)')
    expect(cron?.className).not.toContain('rounded-tr-(--ui-stage-radius)')
  })

  // The content area's strip draws its tabs as surfaces; every other strip —
  // the chat's included, even with a preview stacked into it — keeps its own.
  it("draws the content area's tabs as surfaces, and only there", () => {
    disposePanes.push(
      registry.register({
        area: 'panes',
        data: { placement: 'main' },
        id: 'workspace',
        render: () => <div>Chat</div>,
        title: 'Workspace'
      }),
      registry.register({
        area: 'panes',
        data: { placement: 'main' },
        id: 'preview-tile:file:a',
        render: () => <div>Preview</div>,
        title: 'a.html'
      }),
      registry.register({
        area: 'panes',
        data: { height: '12rem' },
        id: 'terminal',
        render: () => <div>Terminal</div>,
        title: 'Terminal'
      })
    )
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    const zone = (id: string, panes: string[]): GroupNode => ({
      active: panes[0]!,
      headerHidden: false,
      id,
      panes,
      type: 'group'
    })

    const stripVariant = (id: string) =>
      globalThis.document.querySelector(`[data-zone-tabstrip="${id}"]`)?.getAttribute('data-variant')

    render(<TreeGroup node={zone('area-zone', ['preview-tile:file:a'])} />)
    expect(stripVariant('area-zone')).toBe('surface')

    render(<TreeGroup node={zone('chat-zone', ['workspace', 'preview-tile:file:a'])} />)
    expect(stripVariant('chat-zone')).toBe('underline')

    render(<TreeGroup node={zone('terminal-zone', ['terminal'])} parentAxis="column" />)
    expect(stripVariant('terminal-zone')).toBe('underline')
  })

  // The content area's "+" opens a new tab in the area — only there.
  it('offers the content area its own "+", and no other strip', () => {
    const newTab = vi.fn()

    $newContentTabAction.set(newTab)
    disposePanes.push(
      () => $newContentTabAction.set(null),
      registry.register({
        area: 'panes',
        data: { placement: 'main' },
        id: 'preview-tile:file:a',
        render: () => <div>Preview</div>,
        title: 'a.html'
      }),
      registry.register({
        area: 'panes',
        data: { height: '12rem' },
        id: 'terminal',
        render: () => <div>Terminal</div>,
        title: 'Terminal'
      })
    )
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    const plus = (id: string) =>
      globalThis.document.querySelector<HTMLButtonElement>(`[data-tree-group="${id}"] button[aria-label="New tab"]`)

    render(
      <TreeGroup
        node={{
          active: 'preview-tile:file:a',
          headerHidden: false,
          id: 'area-zone',
          panes: ['preview-tile:file:a'],
          type: 'group'
        }}
      />
    )
    act(() => plus('area-zone')!.click())
    expect(newTab).toHaveBeenCalledTimes(1)

    render(<TreeGroup node={terminalGroup(false)} parentAxis="column" />)
    expect(plus('terminal-zone')).toBeNull()
  })
})
