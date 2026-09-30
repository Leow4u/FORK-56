/**
 * Geometria dos Workbots, portada do plugin de bots do app desktop
 * (apps/desktop/src/plugins/work4you-bots/plugin.js: sampleFaceRing, facePose, ringToPath),
 * para o site desenhar os mesmos rostos em vez de iniciais.
 */

export const WORKBOT_SHAPES = ['circle', 'blob', 'squircle', 'pill', 'triangle', 'hexagon', 'cloud', 'drop'] as const
export type WorkbotShape = (typeof WORKBOT_SHAPES)[number]

/** A paleta do seletor de avatar do app. */
export const WORKBOT_COLORS = {
  blue: '#1b85d6',
  brown: '#8d6748',
  cyan: '#38bdf8',
  magenta: '#ec4899',
  orange: '#f97316',
  red: '#ef4444',
  royal: '#3b40c8',
  silver: '#9ca3af',
  teal: '#14b8a6',
  violet: '#8b5cf6',
} as const

export type Point = readonly [number, number]

export interface FacePose {
  blink: boolean
  /** Opacidade dos três pontinhos de "trabalhando". */
  dots: readonly [number, number, number]
  gazeX: number
  gazeY: number
  roll: number
  tilt: number
  turn: number
}

/** O próximo formato da lista, para o clique "trocar o visual". */
export function nextShape(shape: WorkbotShape): WorkbotShape {
  return WORKBOT_SHAPES[(WORKBOT_SHAPES.indexOf(shape) + 1) % WORKBOT_SHAPES.length]
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t

  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
}

function sampleDropRing(steps: number): Point[] {
  const points: Point[] = []
  const n = Math.max(8, Math.floor(steps / 3))

  for (let i = 0; i < n; i++) {
    points.push(cubicAt([20, 3], [20, 3], [6, 20], [6, 27], i / n))
  }

  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI

    points.push([20 - 14 * Math.cos(t), 27 + 13.5 * Math.sin(t)])
  }

  for (let i = 1; i <= n; i++) {
    points.push(cubicAt([34, 27], [34, 20], [20, 3], [20, 3], i / n))
  }

  return points
}

/** Nuvem: três bolhas sobre um piso reto (arcos do caminho original do app). */
function sampleCloudRing(steps: number): Point[] {
  const arcs = [
    { cx: 17.5, cy: 24.5, r: 7.5 },
    { cx: 19.5, cy: 17, r: 9.5 },
    { cx: 29.7, cy: 25, r: 7 },
  ]
  const points: Point[] = []
  const n = Math.max(16, Math.floor(steps / 4))

  // Contorno superior: para cada ângulo, o ponto mais alto entre as três bolhas.
  for (let i = 0; i <= n * 3; i++) {
    const x = 10.2 + (i / (n * 3)) * (36.5 - 10.2)
    let top = 32

    for (const arc of arcs) {
      const dx = x - arc.cx

      if (Math.abs(dx) <= arc.r) {
        top = Math.min(top, arc.cy - Math.sqrt(arc.r * arc.r - dx * dx))
      }
    }

    points.push([x, top])
  }

  points.push([36.5, 32], [10.2, 32])

  return points
}

/** Contorno de um rosto numa caixa 40×40. */
export function sampleFaceRing(shape: WorkbotShape, steps = 52): Point[] {
  if (shape === 'drop') {
    return sampleDropRing(steps)
  }

  if (shape === 'cloud') {
    return sampleCloudRing(steps)
  }

  const points: Point[] = []

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    let r = 16.2

    if (shape === 'blob') {
      r = 16 + 1.7 * Math.sin(3 * a) + 0.7 * Math.cos(5 * a)
    } else if (shape === 'squircle') {
      r = 16.2 / (Math.pow(Math.abs(c) ** 5 + Math.abs(s) ** 5, 1 / 5) || 1)
    } else if (shape === 'pill') {
      r = 16 / (Math.pow(Math.abs(c) ** 8 + Math.abs(s / 0.72) ** 8, 1 / 8) || 1)
    } else if (shape === 'triangle') {
      const u = (a + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
      const sector = (u / ((Math.PI * 2) / 3)) % 1

      r = 13.5 / Math.max(0.42, Math.cos((sector - 0.5) * 1.9))
    } else if (shape === 'hexagon') {
      const seg = Math.PI / 3

      r = 16.2 * (Math.cos(seg / 2) / Math.cos(a - seg * Math.round(a / seg)))
    }

    points.push([20 + r * c, 20 + r * s])
  }

  return points
}

export function projectFacePoint([x, y]: Point, pose: FacePose): Point {
  const dx = x - 20
  const dy = y - 20
  const roll = (pose.roll * Math.PI) / 180
  const xr = dx * Math.cos(roll) - dy * Math.sin(roll)
  const yr = dx * Math.sin(roll) + dy * Math.cos(roll)
  const sx = 0.74 + 0.26 * Math.abs(Math.cos((pose.turn * Math.PI) / 180))
  const sy = 0.8 + 0.2 * Math.abs(Math.cos((pose.tilt * Math.PI) / 180))

  return [20 + xr * sx, 20 + yr * sy]
}

export function ringToPath(points: readonly Point[]): string {
  if (points.length === 0) {
    return ''
  }

  return `${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join('')}Z`
}

/** Pose do rosto no instante t (s). "work" balança e mostra os pontinhos; "idle" só respira. */
export function facePose(mood: 'idle' | 'work', t: number): FacePose {
  if (mood === 'work') {
    const dot = (phase: number) => 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - phase))

    return {
      blink: t % 1.45 > 1.26,
      dots: [dot(0), dot(0.7), dot(1.4)],
      gazeX: Math.sin(t * 0.55) * 3.6,
      gazeY: -1.6 + Math.sin(t * 0.38) * 2,
      roll: Math.sin(t * 0.75) * 4.2,
      tilt: Math.sin(t * 0.42) * 8 + Math.sin(t * 1.1) * 1.6,
      turn: -11 + Math.sin(t * 0.48) * 8,
    }
  }

  return {
    blink: t % 3.2 > 3.02,
    dots: [0, 0, 0],
    gazeX: 0,
    gazeY: 0,
    roll: Math.sin(t * 0.85) * 1.2,
    tilt: Math.sin(t * 0.27),
    turn: Math.sin(t * 0.5) * 1.5,
  }
}

/** Olhos claros em corpos escuros, escuros nos claros (mesma regra do app). */
export function isDarkColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255

  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110
}
