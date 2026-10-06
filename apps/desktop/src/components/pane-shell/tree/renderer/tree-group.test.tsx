import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'

import type { GroupNode } from '../model'

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

  it('shows standing chrome as one switcher with no ✕, and closeable panes as chips with a ✕', () => {
    const pane = (id: string, data: Record<string, unknown>) =>
      registry.register({ area: 'panes', data, id, render: () => <div>{id}</div>, title: id })

    disposePanes.push(
      pane('sessions', { hideOnly: true, placement: 'left', showCloseButton: false }),
      pane('bots', { hideOnly: true, placement: 'left', showCloseButton: false }),
      pane('shell', { placement: 'bottom' })
    )
    vi.stubGlobal('CSS', { escape: (value: string) => value })

    render(
      <TreeGroup
        node={{
          active: 'sessions',
          headerHidden: false,
          id: 'side-zone',
          minimized: false,
          panes: ['sessions', 'bots', 'shell'],
          type: 'group'
        }}
        parentAxis="row"
      />
    )

    const tab = (id: string) => globalThis.document.querySelector<HTMLElement>(`[data-tree-tab="${id}"]`)!
    const close = (id: string) => tab(id).querySelector('button[aria-label="Close"]')

    expect(tab('sessions').parentElement).toBe(tab('bots').parentElement)
    expect(tab('shell').parentElement).not.toBe(tab('sessions').parentElement)
    expect(close('sessions')).toBeNull()
    expect(close('bots')).toBeNull()
    expect(close('shell')).not.toBeNull()
  })
})
