// The bot avatar vocabulary: what a Work4You profile looks like when it is
// drawn as a face. One bot = one profile, so this is the profile's identity
// everywhere a face shows (the WorkBots roster, the sidebar profile rail, the
// settings scope chips). It used to live inside the WorkBots plugin; it moved
// here so core surfaces and the plugin draw the SAME bot from the same rules.
//
// Pure data and geometry only — no React, no DOM. The React face is
// `components/ui/bot-face.tsx`; the animation clock is `bot-face-clock.ts`.

import { blobatar } from 'blobatar/blob'

import { profileColor } from '@/lib/profile-color'

// ── shapes & colors ─────────────────────────────────────────────────────────

/** Legacy flat silhouettes. `defaultShapeFor` hashes a name into this list, so
 *  its order is a stored contract: reordering re-rolls every unconfigured bot. */
export const AVATAR_SHAPES = ['circle', 'squircle', 'pill', 'triangle', 'hexagon', 'cloud', 'drop'] as const

/** What the avatar picker offers, including the hand-drawn blob outline. */
export const AVATAR_PICKER_SHAPES = [
  'circle',
  'blob',
  'squircle',
  'pill',
  'triangle',
  'hexagon',
  'cloud',
  'drop'
] as const

export const AVATAR_COLORS = [
  '#f5f5f4', // white
  '#8d6748', // brown
  '#ef4444', // red
  '#f97316', // orange
  '#14b8a6', // teal
  '#38bdf8', // cyan
  '#3b40c8', // royal blue
  '#8b5cf6', // violet
  '#ec4899', // magenta
  '#9ca3af' // silver
] as const

/** The primary profile's look when nobody customized it: a friendly violet
 *  squircle. `profileColor('default')` is null (the rail paints it neutral),
 *  which would otherwise render the main bot as a black square. */
export const PRIMARY_BOT_APPEARANCE = { color: '#8b5cf6', shape: 'squircle' } as const

/** Perceptual luminance — eyes/pupils flip light on dark bodies (ink, oxblood). */
export function isDarkColor(hex: string): boolean {
  try {
    const n = parseInt(hex.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255

    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110
  } catch {
    return false
  }
}

/** The shape a name rolls when nothing is stored for it. Same `*31` hash as
 *  `profileColor`, so a bot's default shape and hue come from one seed. */
export function defaultShapeFor(name: string): string {
  let hash = 0

  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  }

  return AVATAR_SHAPES[hash % AVATAR_SHAPES.length]
}

// ── sigils (stored picks from an earlier version; still drawn) ──────────────

/** xorshift PRNG seeded from a string — stable across sessions/platforms. */
function sigilRng(text: string): () => number {
  let h = 2166136261

  for (const ch of text) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }

  let state = h >>> 0 || 88675123

  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0

    return state / 4294967296
  }
}

/**
 * Angular hermetic sigil: strokes on the left half of a 5-column grid,
 * mirrored right, plus a chance of a diamond ring. Returns SVG path strings.
 */
export function sigilGeometry(name: string, seed: number): { ring: null | string; strokes: string } {
  const rng = sigilRng(`${name}::${seed}`)
  const gx = (i: number) => 6 + i * 7 // 5 cols: 6..34
  const gy = (j: number) => 8 + j * 6 // 5 rows: 8..32
  const strokes: string[] = []
  const segments = 4 + Math.floor(rng() * 3)

  for (let k = 0; k < segments; k++) {
    const x1 = Math.floor(rng() * 3) // left half incl. center
    const y1 = Math.floor(rng() * 5)
    const x2 = Math.min(2, Math.max(0, x1 + (rng() > 0.5 ? 1 : -1)))
    const y2 = Math.min(4, Math.max(0, y1 + Math.floor(rng() * 3) - 1))

    strokes.push(`M${gx(x1)} ${gy(y1)} L${gx(x2)} ${gy(y2)}`)
    // mirror (col i → col 4-i)
    strokes.push(`M${gx(4 - x1)} ${gy(y1)} L${gx(4 - x2)} ${gy(y2)}`)

    // occasional cross-tie through the axis for connectedness
    if (rng() > 0.6) {
      strokes.push(`M${gx(x2)} ${gy(y2)} L${gx(4 - x2)} ${gy(y2)}`)
    }
  }

  // spine down the axis grounds every variant
  strokes.push(`M20 ${gy(0)} L20 ${gy(4)}`)

  const ring = rng() > 0.45 ? 'M20 4 L36 20 L20 36 L4 20 Z' : null

  return { ring, strokes: strokes.join(' ') }
}

// ── blobatar shapes mode (default for new agents) ───────────────────────────
// Deterministic soft-body faces drawn from a string. Shape strings:
//   'blobatar'                — the face follows the bot's NAME (renaming the
//                               bot re-rolls the face, live in the dialog)
//   'blobatar:<seed>'         — seed locked (the 🔒 lock / 🎲 randomize picks)
//   'blobatar:<seed>:<kind>'  — plus one of the ten silhouettes pinned
//   'blobatar::<kind>'        — silhouette pinned, seed still follows the name
// Bot names are slugs and generated seeds are base36, so ':' never appears
// inside a segment. Colors come from the library's own name-derived palette
// (contrast-guaranteed) — the classic color swatches don't apply.

export const BLOB_KINDS = [
  'round',
  'organic',
  'boxy',
  'capsule',
  'nub',
  'cloud',
  'droplet',
  'hexagon',
  'sun',
  'triangle'
] as const

export type BlobKind = (typeof BLOB_KINDS)[number]

// Trait positions at the center of each silhouette band. Band thresholds are
// frozen per blobatar major (gen2: 0.22 / 0.48 / 0.60 / 0.70 / 0.79 / 0.86 /
// 0.915 / 0.95 / 0.98).
export const BLOB_KIND_TRAIT: Record<BlobKind, number> = {
  boxy: 0.54,
  capsule: 0.65,
  cloud: 0.825,
  droplet: 0.8875,
  hexagon: 0.9325,
  nub: 0.745,
  organic: 0.35,
  round: 0.11,
  sun: 0.965,
  triangle: 0.99
}

const isBlobKind = (value: string): value is BlobKind => (BLOB_KINDS as readonly string[]).includes(value)

export function isBlobShape(shape: null | string | undefined): shape is string {
  return shape === 'blobatar' || (typeof shape === 'string' && shape.startsWith('blobatar:'))
}

export interface ParsedBlobShape {
  /** The pinned silhouette, or '' when the name decides. */
  kind: '' | BlobKind
  /** What the renderer draws from: the locked seed, else the name. */
  seed: string
  /** The locked seed segment as stored, '' when the face follows the name. */
  seedPart: string
}

export function parseBlobShape(shape: null | string | undefined, name: string): ParsedBlobShape {
  const parts = typeof shape === 'string' ? shape.split(':') : []
  const seedPart = parts[1] || ''
  const kindPart = parts[2] || ''
  const kind = isBlobKind(kindPart) ? kindPart : ''

  return { kind, seed: seedPart || name || 'agent', seedPart }
}

export function blobShapeString(seedPart: string, kind: '' | BlobKind): string {
  if (kind) {
    return `blobatar:${seedPart}:${kind}`
  }

  return seedPart ? `blobatar:${seedPart}` : 'blobatar'
}

/** Static SVG markup for a blob face, tagged data-bot-face so the roster's
 *  PNG backfill (`svg[data-bot-face=…]`) still finds it. Null when the
 *  renderer refuses the input, so callers fall back to the math face. */
export function blobMarkup(shape: string, name: string, size: number): null | string {
  const { kind, seed } = parseBlobShape(shape, name)
  const opts: { size: number; traits?: { shape: number } } = { size }

  if (kind) {
    opts.traits = { shape: BLOB_KIND_TRAIT[kind] }
  }

  try {
    return blobatar(seed, opts).replace('<svg ', '<svg data-bot-face=' + JSON.stringify(name) + ' ')
  } catch {
    return null
  }
}

// ── appearance resolver ─────────────────────────────────────────────────────

/** The per-bot look a person may have stored (WorkBots keeps it under the
 *  profile's `ui_meta['work4you-bots']`; the image stays local). */
export interface BotAppearanceMeta {
  color?: null | string
  /** True once the person saved an explicit shape/color in the editor. */
  custom?: boolean
  image?: null | string
  shape?: null | string
}

export interface BotAppearance {
  color: string
  image: null | string
  shape: string
}

/** The namespace WorkBots stores a bot's look under in the profile's
 *  `ui_meta` (profile.yaml), shared by every client of the gateway. */
export const BOT_UI_META_KEY = 'work4you-bots'

/** The stored look out of a profile's `ui_meta`, or null when none. Only the
 *  compact fields the server carries: the image never rides `ui_meta` (it is
 *  a profile asset), so `image` is left for the caller to fill. */
export function botMetaOf(uiMeta: null | Record<string, unknown> | undefined): BotAppearanceMeta | null {
  const raw = uiMeta?.[BOT_UI_META_KEY]

  if (!raw || typeof raw !== 'object') {
    return null
  }

  const stored = raw as Record<string, unknown>

  return {
    color: typeof stored.color === 'string' && stored.color ? stored.color : null,
    custom: stored.custom === true,
    shape: typeof stored.shape === 'string' && stored.shape ? stored.shape : null
  }
}

/** The roster backfill rasterizes the live vector face at 160×160 and stores
 *  it as the profile's avatar so inter-agent notices have a picture. Pets are
 *  96×104 and uploads 256, so a 160px PNG is that snapshot, not a photo — and
 *  a snapshot must never replace the live face that is drawn from the look. */
export function isBackfilledFacePng(dataUrl: null | string | undefined): boolean {
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
    return false
  }

  try {
    const bin = atob(dataUrl.slice('data:image/png;base64,'.length).slice(0, 48))

    if (bin.length < 24) {
      return false
    }

    const w = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19)
    const h = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23)

    return w === 160 && h === 160
  } catch {
    return false
  }
}

/** What to draw for `name`: a stored pick wins, else the name rolls a shape
 *  and a hue. The primary profile gets its fixed friendly look unless the
 *  person customized it (an image, or a shape/color saved in the editor). */
export function botAppearance(name: null | string | undefined, meta?: BotAppearanceMeta | null): BotAppearance {
  const key = (name || '').trim()
  const isPrimary = key.toLowerCase() === 'default'
  const userCustomized = Boolean(meta?.custom)

  if (isPrimary && !userCustomized) {
    return { ...PRIMARY_BOT_APPEARANCE, image: meta?.image || null }
  }

  return {
    color: meta?.color || profileColor(key) || PRIMARY_BOT_APPEARANCE.color,
    image: meta?.image || null,
    shape: meta?.shape || defaultShapeFor(key)
  }
}

// ── face geometry (the "math face") ─────────────────────────────────────────
// Outlines are sampled from formulas in a 40×40 box, so the clock can project
// them for a head turn / tilt each frame instead of swapping baked paths.

export type Point = [number, number]

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t

  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  ]
}

/** Same outline as the old GitHub drop path, so it stays a fat water drop. */
function sampleDropRing(steps: number): Point[] {
  const pts: Point[] = []
  const n = Math.max(8, Math.floor(steps / 3))

  for (let i = 0; i < n; i++) {
    pts.push(cubicAt([20, 3], [20, 3], [6, 20], [6, 27], i / n))
  }

  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI

    pts.push([20 - 14 * Math.cos(t), 27 + 13.5 * Math.sin(t)])
  }

  for (let i = 1; i <= n; i++) {
    pts.push(cubicAt([34, 27], [34, 20], [20, 3], [20, 3], i / n))
  }

  return pts
}

interface Arc {
  cx: number
  cy: number
  dtheta: number
  rx: number
  ry: number
  theta1: number
}

function svgArc(x1: number, y1: number, rx: number, ry: number, fa: 0 | 1, fs: 0 | 1, x2: number, y2: number): Arc {
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  let rx2 = rx * rx
  let ry2 = ry * ry
  const lam = (dx * dx) / rx2 + (dy * dy) / ry2

  if (lam > 1) {
    const s = Math.sqrt(lam)

    rx *= s
    ry *= s
    rx2 = rx * rx
    ry2 = ry * ry
  }

  const num = rx2 * ry2 - rx2 * dy * dy - ry2 * dx * dx
  const den = rx2 * dy * dy + ry2 * dx * dx
  let sq = Math.sqrt(Math.max(0, num / den))

  if (fa === fs) {
    sq = -sq
  }

  const cx = sq * ((rx * dy) / ry) + (x1 + x2) / 2
  const cy = sq * ((-ry * dx) / rx) + (y1 + y2) / 2

  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const n = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1
    let a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / n)))

    if (ux * vy - uy * vx < 0) {
      a = -a
    }

    return a
  }

  const theta1 = ang(1, 0, (x1 - cx) / rx, (y1 - cy) / ry)
  let dtheta = ang((x1 - cx) / rx, (y1 - cy) / ry, (x2 - cx) / rx, (y2 - cy) / ry)

  if (!fs && dtheta > 0) {
    dtheta -= Math.PI * 2
  }

  if (fs && dtheta < 0) {
    dtheta += Math.PI * 2
  }

  return { cx, cy, dtheta, rx, ry, theta1 }
}

function sampleArc(arc: Arc, n: number): Point[] {
  const pts: Point[] = []

  for (let i = 0; i < n; i++) {
    const th = arc.theta1 + arc.dtheta * (i / n)

    pts.push([arc.cx + arc.rx * Math.cos(th), arc.cy + arc.ry * Math.sin(th)])
  }

  return pts
}

/** Same outline as the old GitHub cloud path: three puffs and a flat floor. */
function sampleCloudRing(steps: number): Point[] {
  const a1 = svgArc(11, 32, 7.5, 7.5, 0, 1, 10, 17.1)
  const a2 = svgArc(10, 17.1, 9.5, 9.5, 0, 1, 29, 12.5)
  const a3 = svgArc(29, 12.5, 7, 7, 0, 1, 30, 32)
  const len1 = Math.abs(a1.dtheta) * a1.rx
  const len2 = Math.abs(a2.dtheta) * a2.rx
  const len3 = Math.abs(a3.dtheta) * a3.rx
  const len4 = 19
  const total = len1 + len2 + len3 + len4
  const n = Math.max(64, steps)
  const n1 = Math.max(8, Math.round((n * len1) / total))
  const n2 = Math.max(10, Math.round((n * len2) / total))
  const n3 = Math.max(10, Math.round((n * len3) / total))
  const n4 = Math.max(4, n - n1 - n2 - n3)
  const pts: Point[] = []

  pts.push(...sampleArc(a1, n1))
  pts.push(...sampleArc(a2, n2))
  pts.push(...sampleArc(a3, n3))

  for (let i = 0; i < n4; i++) {
    pts.push([30 + (11 - 30) * (i / n4), 32])
  }

  return pts
}

/** The cloud keeps its hand-drawn path for the body (the sampled ring is only
 *  used for projection), so it stays the exact GitHub-style cloud. */
export const CLOUD_BODY_PATH = 'M11 32 a7.5 7.5 0 0 1 -1 -14.9 A9.5 9.5 0 0 1 29 12.5 A7 7 0 0 1 30 32 Z'

/** Outline of a face in a 40x40 box, sampled from formulas. */
export function sampleFaceRing(shape: null | string | undefined, steps = 52): Point[] {
  const kind = (shape || '').startsWith('sigil-') ? 'circle' : shape || 'circle'

  if (kind === 'drop' || kind === 'teardrop') {
    return sampleDropRing(steps)
  }

  if (kind === 'cloud') {
    return sampleCloudRing(steps)
  }

  if (kind === 'pill') {
    // A capsule has semicircular ends and straight top/bottom edges.
    // Keep the same proportions as the classic 36×26 pill.
    return Array.from({ length: steps }, (_, i): Point => {
      const angle = (i / steps) * Math.PI * 2 - Math.PI / 2
      const cosine = Math.cos(angle)

      return [20 + Math.sign(cosine) * 5 + 13 * cosine, 20 + 13 * Math.sin(angle)]
    })
  }

  const pts: Point[] = []

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    let rx = 16
    let ry = 16

    if (kind === 'circle') {
      rx = ry = 16.2
    } else if (kind === 'blob') {
      rx = ry = 16 + 1.7 * Math.sin(3 * a) + 0.7 * Math.cos(5 * a)
    } else if (kind === 'squircle') {
      const p = 4
      const d = Math.pow(Math.abs(c) ** p + Math.abs(s) ** p, 1 / p) || 1

      rx = ry = 16.2 / d
    } else if (kind === 'triangle' || kind === 'tetrahedron' || kind === 'wedge') {
      const u = (a + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
      const sector = (u / ((Math.PI * 2) / 3)) % 1

      rx = ry = 13.5 / Math.max(0.42, Math.cos((sector - 0.5) * 1.9))
    } else if (kind === 'hexagon' || kind === 'hex' || kind === 'icosahedron' || kind === 'dodecahedron') {
      const seg = Math.PI / 3
      const hex = Math.cos(seg / 2) / Math.cos(a - seg * Math.round(a / seg))

      rx = ry = 16.2 * hex
    } else if (kind === 'cube' || kind === 'octahedron') {
      const p = 3.1
      const d = Math.pow(Math.abs(c) ** p + Math.abs(s) ** p, 1 / p) || 1

      rx = ry = 16 / d
    } else if (kind === 'pebble') {
      rx = 16.4 * (1.04 - 0.14 * Math.cos(2 * a))
      ry = 15.2 * (1.06 + 0.08 * Math.sin(2 * a))
    } else {
      rx = ry = 16.2
    }

    pts.push([20 + rx * c, 20 + ry * s])
  }

  if (kind === 'triangle' || kind === 'hexagon') {
    // Soften the classic corners without changing the selected silhouette.
    for (let pass = 0; pass < 2; pass++) {
      const rounded = pts.map(([x, y], i): Point => {
        const before = pts[(i + pts.length - 1) % pts.length]
        const after = pts[(i + 1) % pts.length]

        return [(before[0] + 2 * x + after[0]) / 4, (before[1] + 2 * y + after[1]) / 4]
      })

      pts.splice(0, pts.length, ...rounded)
    }
  }

  return pts
}

/** A point of the outline after the head turns / tilts / rolls. */
export function projectFacePoint(x: number, y: number, turn: number, tilt: number, roll: number): Point {
  const dx = x - 20
  const dy = y - 20
  const r = (roll * Math.PI) / 180
  const xr = dx * Math.cos(r) - dy * Math.sin(r)
  const yr = dx * Math.sin(r) + dy * Math.cos(r)
  const sx = 0.74 + 0.26 * Math.abs(Math.cos((turn * Math.PI) / 180))
  const sy = 0.8 + 0.2 * Math.abs(Math.cos((tilt * Math.PI) / 180))

  return [20 + xr * sx, 20 + yr * sy]
}

export function ringToPath(pts: readonly Point[]): string {
  if (!pts.length) {
    return ''
  }

  const last = pts[pts.length - 1]
  let d = `M${((last[0] + pts[0][0]) / 2).toFixed(2)} ${((last[1] + pts[0][1]) / 2).toFixed(2)}`

  // Midpoint curves keep the animated contour smooth even in a large preview.
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    const next = pts[(i + 1) % pts.length]

    d += `Q${x.toFixed(2)} ${y.toFixed(2)} ${((x + next[0]) / 2).toFixed(2)} ${((y + next[1]) / 2).toFixed(2)}`
  }

  return d + 'Z'
}

export type BotMood = 'idle' | 'work'

export interface FacePose {
  blink: boolean
  d0: number
  d1: number
  d2: number
  gazeX: number
  gazeY: number
  roll: number
  tilt: number
  turn: number
}

/** The head's pose at time `t` (seconds). Working leans and sways with three
 *  thinking dots; idle is a small sine with an occasional blink. */
export function facePose(mood: BotMood | string, t: number): FacePose {
  if (mood === 'work') {
    return {
      blink: t % 1.45 > 1.26,
      d0: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6)),
      d1: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - 0.7)),
      d2: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - 1.4)),
      gazeX: Math.sin(t * 0.55) * 3.6,
      gazeY: -1.6 + Math.sin(t * 0.38) * 2,
      roll: Math.sin(t * 0.75) * 4.2,
      tilt: Math.sin(t * 0.42) * 8 + Math.sin(t * 1.1) * 1.6,
      turn: -11 + Math.sin(t * 0.48) * 8
    }
  }

  return {
    blink: t % 3.2 > 3.02,
    d0: 0,
    d1: 0,
    d2: 0,
    gazeX: 0,
    gazeY: 0,
    roll: Math.sin(t * 0.85) * 1.2,
    tilt: Math.sin(t * 0.27),
    turn: Math.sin(t * 0.5) * 1.5
  }
}

/** Where the eye line sits for a shape: the cloud body is lower-set. */
export const faceEyeY = (shape: null | string | undefined): number => (shape === 'cloud' ? 22 : 17.2)
