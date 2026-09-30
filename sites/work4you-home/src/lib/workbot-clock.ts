import { facePose, projectFacePoint, ringToPath, sampleFaceRing, type WorkbotShape } from './workbot'

/**
 * Um relógio só para todos os Workbots da página, como no app: pinta os rostos direto no SVG
 * (sem re-render do React), pula os que estão fora da tela e faz os olhos seguirem o ponteiro.
 */

export interface FaceHandle {
  mood: 'idle' | 'work'
  shape: WorkbotShape
  svg: SVGSVGElement
}

const faces = new Set<FaceHandle>()
let pointer: { x: number; y: number } | null = null
let frame = 0
let started = 0

const EYE_Y = 17.2
const CLOUD_EYE_Y = 22
/** Até onde as pupilas andam na direção do ponteiro (unidades do viewBox 40×44). */
const GAZE_REACH = 2.4

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function onPointer(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY }
}

function onLeave() {
  pointer = null
}

/** Direção do olhar, de -1 a 1 em cada eixo, a partir do centro do rosto. */
export function gazeToward(rect: { height: number; left: number; top: number; width: number }, target: { x: number; y: number }) {
  const dx = target.x - (rect.left + rect.width / 2)
  const dy = target.y - (rect.top + rect.height / 2)
  const distance = Math.hypot(dx, dy)

  if (distance < 1) {
    return { x: 0, y: 0 }
  }

  // Perto do rosto o olhar vai menos longe; a partir de ~160px já olha "de canto".
  const strength = Math.min(1, distance / 160)

  return { x: (dx / distance) * strength, y: (dy / distance) * strength }
}

export function paintFace(face: FaceHandle, t: number) {
  const { svg, shape } = face
  const pose = facePose(face.mood, t)
  const body = svg.querySelector('[data-body]')
  const rect = svg.getBoundingClientRect()
  let gazeX = pose.gazeX
  let gazeY = pose.gazeY

  if (pointer && face.mood === 'idle') {
    const gaze = gazeToward(rect, pointer)

    gazeX = gaze.x * GAZE_REACH * 1.3
    gazeY = gaze.y * GAZE_REACH
  }

  const ring = shape === 'cloud' ? sampleFaceRing(shape) : sampleFaceRing(shape).map((point) => projectFacePoint(point, pose))

  body?.setAttribute('d', ringToPath(ring))

  const eyeY = (shape === 'cloud' ? CLOUD_EYE_Y : EYE_Y) + gazeY
  const eyeL = 15.4 + gazeX
  const eyeR = 24.6 + gazeX

  svg.querySelector('[data-eye-l]')?.setAttribute('cx', String(eyeL))
  svg.querySelector('[data-eye-r]')?.setAttribute('cx', String(eyeR))
  svg.querySelectorAll('[data-eye-l], [data-eye-r]').forEach((eye) => eye.setAttribute('cy', String(eyeY)))
  svg.querySelector('[data-hl-l]')?.setAttribute('cx', String(eyeL - 0.6))
  svg.querySelector('[data-hl-r]')?.setAttribute('cx', String(eyeR - 0.6))
  svg.querySelectorAll('[data-hl-l], [data-hl-r]').forEach((dot) => dot.setAttribute('cy', String(eyeY - 0.7)))
  svg.querySelector('[data-open]')?.setAttribute('opacity', pose.blink ? '0' : '1')

  const shut = svg.querySelector('[data-shut]')

  shut?.setAttribute('d', `M${eyeL - 2.6} ${eyeY}L${eyeL + 2.6} ${eyeY}M${eyeR - 2.6} ${eyeY}L${eyeR + 2.6} ${eyeY}`)
  shut?.setAttribute('opacity', pose.blink ? '1' : '0')
  svg.querySelectorAll('[data-dot]').forEach((dot, i) => dot.setAttribute('opacity', String(pose.dots[i] ?? 0)))
  svg.style.transform = `rotate(${pose.tilt}deg)`
}

function tick(now: number) {
  const t = (now - started) / 1000
  const height = window.innerHeight

  for (const face of faces) {
    const rect = face.svg.getBoundingClientRect()

    if (rect.bottom > 0 && rect.top < height) {
      paintFace(face, t)
    }
  }

  frame = requestAnimationFrame(tick)
}

function start() {
  if (frame || reducedMotion()) {
    return
  }

  started = performance.now()
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  frame = requestAnimationFrame(tick)
}

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
  window.removeEventListener('pointermove', onPointer)
  document.documentElement.removeEventListener('pointerleave', onLeave)
}

/** Registra um rosto no relógio; devolve a função que o tira. */
export function watchFace(face: FaceHandle): () => void {
  faces.add(face)
  start()

  return () => {
    faces.delete(face)

    if (faces.size === 0) {
      stop()
    }
  }
}
