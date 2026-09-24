/**
 * Pure planning for drive_preview: stable refs, the page inventory script,
 * and the delta a later action returns. The webview stays in the pane.
 */

export interface PreviewElement {
  checked: boolean | null
  h: number
  label: string
  ref: string
  role: string
  value: string
  w: number
  x: number
  y: number
}

export interface PreviewInventory {
  elements: PreviewElement[]
  title: string
  url: string
}

/** What the model sees. Coordinates stay in the renderer. */
export interface PreviewElementView {
  checked?: boolean
  label: string
  ref: string
  role: string
  value?: string
}

export interface PreviewDelta {
  added: PreviewElementView[]
  changed: PreviewElementView[]
  removed: string[]
}

export type PreviewDriveAction = 'back' | 'click' | 'elements' | 'forward' | 'hover' | 'press' | 'reload' | 'scroll' | 'type'

export interface PreviewDriveRequest {
  action: string
  direction?: string
  key?: string
  ref?: string
  text?: string
}

export interface PreviewInputEvent {
  button?: 'left'
  clickCount?: number
  deltaX?: number
  deltaY?: number
  keyCode?: string
  type: 'char' | 'keyDown' | 'keyUp' | 'mouseDown' | 'mouseMove' | 'mouseUp' | 'mouseWheel'
  x?: number
  y?: number
}

interface RawElement {
  checked?: boolean | null
  h?: number
  label?: string
  role?: string
  value?: string
  w?: number
  x?: number
  y?: number
}

const ROLE_PREFIX: Record<string, string> = {
  a: 'lnk',
  button: 'btn',
  checkbox: 'chk',
  input: 'inp',
  link: 'lnk',
  menuitem: 'menu',
  radio: 'rad',
  select: 'sel',
  tab: 'tab',
  textbox: 'inp',
  textarea: 'inp'
}

const SCROLL_DELTA = 480

/** Script the guest page runs. Returns unlabeled geometry; refs are assigned here. */
export function previewInventoryScript(): string {
  return `(() => {
  var sel = 'a,button,input,textarea,select,summary,[role="button"],[role="link"],[role="textbox"],[role="checkbox"],[role="radio"],[role="menuitem"],[role="tab"],[contenteditable="true"]';
  var out = [];
  var nodes = document.querySelectorAll(sel);
  for (var i = 0; i < nodes.length && out.length < 120; i++) {
    var el = nodes[i];
    var rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    var style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
    var role = (el.getAttribute('role') || el.tagName || '').toLowerCase();
    var label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    var value = '';
    if ('value' in el && typeof el.value === 'string') value = el.value.slice(0, 80);
    var checkable = el.matches('input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"]');
    out.push({
      role: role,
      label: label,
      value: value,
      checked: checkable ? Boolean(el.checked || el.getAttribute('aria-checked') === 'true') : null,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      w: rect.width,
      h: rect.height
    });
  }
  return { url: location.href, title: document.title || '', elements: out };
})()`
}

function slug(label: string): string {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)

  return cleaned || 'item'
}

function asRawElement(item: unknown): RawElement {
  if (!item || typeof item !== 'object') {
    return {}
  }

  return item as RawElement
}

/** Stable refs from DOM order. The same role and label keep the same ref until the page changes order. */
export function assignPreviewRefs(raw: readonly unknown[]): PreviewElement[] {
  const seen = new Map<string, number>()

  return raw.map(entry => {
    const item = asRawElement(entry)
    const role = String(item.role || 'el')
    const label = String(item.label || '')
    const base = `${ROLE_PREFIX[role] || 'el'}-${slug(label)}`
    const nth = seen.get(base) ?? 0

    seen.set(base, nth + 1)

    return {
      checked: item.checked == null ? null : Boolean(item.checked),
      h: Number(item.h) || 0,
      label,
      ref: nth === 0 ? base : `${base}-${nth + 1}`,
      role,
      value: String(item.value || ''),
      w: Number(item.w) || 0,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0
    }
  })
}

export function viewElement(element: PreviewElement): PreviewElementView {
  const view: PreviewElementView = {
    label: element.label,
    ref: element.ref,
    role: element.role
  }

  if (element.value) {
    view.value = element.value
  }

  if (element.checked != null) {
    view.checked = element.checked
  }

  return view
}

export function diffPreviewInventory(before: PreviewElement[], after: PreviewElement[]): PreviewDelta {
  const prior = new Map(before.map(element => [element.ref, element]))
  const next = new Map(after.map(element => [element.ref, element]))
  const added: PreviewElementView[] = []
  const changed: PreviewElementView[] = []
  const removed: string[] = []

  for (const element of after) {
    const old = prior.get(element.ref)

    if (!old) {
      added.push(viewElement(element))

      continue
    }

    if (old.label !== element.label || old.value !== element.value || old.role !== element.role || old.checked !== element.checked) {
      changed.push(viewElement(element))
    }
  }

  for (const ref of prior.keys()) {
    if (!next.has(ref)) {
      removed.push(ref)
    }
  }

  return { added, changed, removed }
}

function point(element: PreviewElement): { x: number; y: number } {
  return { x: Math.round(element.x), y: Math.round(element.y) }
}

/** Real input events for one action. History actions are not input events. */
export function previewInputPlan(
  action: PreviewDriveAction,
  element: PreviewElement | null,
  request: PreviewDriveRequest,
  fallback: { x: number; y: number }
): PreviewInputEvent[] {
  const at = element ? point(element) : fallback

  const click: PreviewInputEvent[] = [
    { type: 'mouseMove', x: at.x, y: at.y },
    { button: 'left', clickCount: 1, type: 'mouseDown', x: at.x, y: at.y },
    { button: 'left', clickCount: 1, type: 'mouseUp', x: at.x, y: at.y }
  ]

  if (action === 'click') {
    return click
  }

  if (action === 'hover') {
    return [{ type: 'mouseMove', x: at.x, y: at.y }]
  }

  if (action === 'type') {
    const chars = Array.from(request.text || '')

    return [
      ...click,
      ...chars.flatMap(char => [
        { keyCode: char, type: 'keyDown' as const },
        { keyCode: char, type: 'char' as const },
        { keyCode: char, type: 'keyUp' as const }
      ])
    ]
  }

  if (action === 'press') {
    const key = request.key || 'Enter'
    const focus = element ? click : []

    return [...focus, { keyCode: key, type: 'keyDown' }, { keyCode: key, type: 'keyUp' }]
  }

  if (action === 'scroll') {
    const direction = request.direction || 'down'
    const deltaX = direction === 'left' ? -SCROLL_DELTA : direction === 'right' ? SCROLL_DELTA : 0
    const deltaY = direction === 'up' ? -SCROLL_DELTA : direction === 'down' ? SCROLL_DELTA : 0

    return [{ deltaX, deltaY, type: 'mouseWheel', x: at.x, y: at.y }]
  }

  return []
}
