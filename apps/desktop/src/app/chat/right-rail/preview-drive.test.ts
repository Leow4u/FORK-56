import { beforeEach, describe, expect, it } from 'vitest'

import { closeRightRail, openPreview } from '@/store/preview'

import { assignPreviewRefs, diffPreviewInventory, previewInputPlan } from './preview-drive'
import {
  driveActivePreview,
  type PreviewDriverHost,
  registerPreviewDriver,
  resetPreviewDriveBaseline
} from './preview-driver'

const page = [
  { checked: null, h: 20, label: 'Sign in', role: 'button', value: '', w: 80, x: 40, y: 10 },
  { checked: null, h: 20, label: 'Sign in', role: 'button', value: '', w: 80, x: 40, y: 40 }
]

describe('preview drive refs and input', () => {
  it('keeps a stable ref for the same label and numbers the duplicate', () => {
    const [first, second] = assignPreviewRefs(page)

    expect(first?.ref).toBe('btn-sign-in')
    expect(second?.ref).toBe('btn-sign-in-2')
  })

  it('reports only what changed', () => {
    const before = assignPreviewRefs(page)

    const after = assignPreviewRefs([
      { ...page[0], value: 'ok' },
      { checked: null, h: 10, label: 'Help', role: 'link', value: '', w: 20, x: 4, y: 4 }
    ])

    const delta = diffPreviewInventory(before, after)

    expect(delta.removed).toEqual(['btn-sign-in-2'])
    expect(delta.added.map(item => item.ref)).toEqual(['lnk-help'])
    expect(delta.changed.map(item => item.ref)).toEqual(['btn-sign-in'])
  })

  it('plans a real click at the element center', () => {
    const [element] = assignPreviewRefs(page)
    const events = previewInputPlan('click', element!, { action: 'click' }, { x: 0, y: 0 })

    expect(events.map(event => event.type)).toEqual(['mouseMove', 'mouseDown', 'mouseUp'])
    expect(events[0]).toMatchObject({ x: 40, y: 10 })
  })
})

describe('driveActivePreview', () => {
  beforeEach(() => {
    resetPreviewDriveBaseline()
    closeRightRail()
  })

  it('returns null when no preview is open', async () => {
    expect(await driveActivePreview({ action: 'elements' })).toBeNull()
  })

  it('clicks the ref and returns the delta', async () => {
    openPreview({ kind: 'url', label: 'Browser', source: 'https://example.com', url: 'https://example.com' })
    const sent: string[] = []
    let elements = page

    const host: PreviewDriverHost = {
      center: () => ({ x: 1, y: 1 }),
      history: async () => undefined,
      input: async events => {
        sent.push(...events.map(event => event.type))
      },
      inventory: async () => ({ elements, title: 'Example', url: 'https://example.com' }),
      settle: async () => undefined
    }

    const { $previewTabs } = await import('@/store/preview')
    const tabId = $previewTabs.get()[0]?.id

    expect(tabId).toBeTruthy()
    const unregister = registerPreviewDriver(tabId!, host)

    const listed = await driveActivePreview({ action: 'elements' })

    expect(listed?.elements).toEqual([
      { label: 'Sign in', ref: 'btn-sign-in', role: 'button' },
      { label: 'Sign in', ref: 'btn-sign-in-2', role: 'button' }
    ])

    elements = [page[0]!]
    const clicked = await driveActivePreview({ action: 'click', ref: 'btn-sign-in' })

    expect(sent).toEqual(['mouseMove', 'mouseDown', 'mouseUp'])
    expect(clicked?.success).toBe(true)
    expect(clicked?.delta).toMatchObject({ removed: ['btn-sign-in-2'] })

    unregister()
  })
})
