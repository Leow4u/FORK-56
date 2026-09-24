/**
 * drive_preview's window into the preview pane. PreviewPane registers the
 * live webview; the gateway bridge calls driveActivePreview.
 */

import { atom } from 'nanostores'

import { $rightRailActiveTabId } from '@/store/layout'
import { $previewTabs } from '@/store/preview'

import {
  assignPreviewRefs,
  diffPreviewInventory,
  type PreviewDriveRequest,
  type PreviewElement,
  type PreviewInputEvent,
  previewInputPlan,
  type PreviewInventory,
  previewInventoryScript,
  viewElement
} from './preview-drive'

export interface PreviewDriveMark {
  h: number
  tabId: string
  w: number
  x: number
  y: number
}

/** Outline of the element the agent is acting on. No caption. */
export const $previewDriveMark = atom<PreviewDriveMark | null>(null)

export interface PreviewDriverHost {
  center: () => { x: number; y: number }
  history: (action: 'back' | 'forward' | 'reload') => Promise<void>
  input: (events: PreviewInputEvent[]) => Promise<void>
  inventory: () => Promise<{ elements: unknown[]; title: string; url: string }>
  settle: () => Promise<void>
}

const hosts = new Map<string, PreviewDriverHost>()
let baseline: PreviewElement[] = []
let baselineUrl = ''

export function registerPreviewDriver(tabId: string, host: PreviewDriverHost): () => void {
  hosts.set(tabId, host)

  return () => {
    if (hosts.get(tabId) === host) {
      hosts.delete(tabId)
    }
  }
}

export function previewDriverScript(): string {
  return previewInventoryScript()
}

function activeHost(): { host: PreviewDriverHost; tabId: string } | null {
  const tabs = $previewTabs.get()
  const tab = tabs.find(item => item.id === $rightRailActiveTabId.get()) ?? tabs[0]

  if (!tab) {
    return null
  }

  const host = hosts.get(tab.id)

  if (!host) {
    return null
  }

  return { host, tabId: tab.id }
}

async function readInventory(host: PreviewDriverHost): Promise<PreviewInventory> {
  const page = await host.inventory()

  return {
    elements: assignPreviewRefs(Array.isArray(page.elements) ? page.elements : []),
    title: page.title || '',
    url: page.url || ''
  }
}

function remember(inventory: PreviewInventory) {
  if (inventory.url !== baselineUrl) {
    baseline = []
    baselineUrl = inventory.url
  }

  baseline = inventory.elements
}

function showMark(tabId: string, element: PreviewElement) {
  $previewDriveMark.set({
    h: element.h,
    tabId,
    w: element.w,
    x: element.x - element.w / 2,
    y: element.y - element.h / 2
  })
  window.setTimeout(() => {
    const current = $previewDriveMark.get()

    if (current?.tabId === tabId && current.x === element.x - element.w / 2) {
      $previewDriveMark.set(null)
    }
  }, 700)
}

/** Run one drive_preview request against the active preview tab. Null when nothing is open. */
export async function driveActivePreview(request: PreviewDriveRequest): Promise<Record<string, unknown> | null> {
  const active = activeHost()

  if (!active) {
    return null
  }

  const { host, tabId } = active
  const before = await readInventory(host)

  if (before.url !== baselineUrl) {
    baseline = []
    baselineUrl = before.url
  }

  const action = request.action

  if (action === 'elements') {
    remember(before)

    return {
      elements: before.elements.map(viewElement),
      success: true,
      title: before.title,
      url: before.url
    }
  }

  if (action === 'back' || action === 'forward' || action === 'reload') {
    await host.history(action)
    await host.settle()
    const after = await readInventory(host)
    const delta = diffPreviewInventory(baseline.length ? baseline : before.elements, after.elements)

    remember(after)

    return { action, delta, success: true, title: after.title, url: after.url }
  }

  const needsRef = action === 'click' || action === 'hover' || action === 'type'
  const element = request.ref ? before.elements.find(item => item.ref === request.ref) || null : null

  if (needsRef && !element) {
    return {
      elements: before.elements.map(viewElement),
      error: `Unknown ref ${request.ref || ''}. Use a ref from elements.`,
      success: false,
      url: before.url
    }
  }

  if (element) {
    showMark(tabId, element)
  }

  const events = previewInputPlan(action as 'click', element, request, host.center())

  if (events.length) {
    await host.input(events)
  }

  await host.settle()
  const after = await readInventory(host)
  const delta = diffPreviewInventory(baseline.length ? baseline : before.elements, after.elements)

  remember(after)

  return { action, delta, success: true, title: after.title, url: after.url }
}

/** Test hook: a navigation in one test must not leak refs into the next. */
export function resetPreviewDriveBaseline() {
  baseline = []
  baselineUrl = ''
  $previewDriveMark.set(null)
}
