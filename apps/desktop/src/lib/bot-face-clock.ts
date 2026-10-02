// The one animation clock behind every math face on screen. Faces render as
// static SVG tagged `data-hb-math`; this clock finds them, projects their
// outline for the current pose, and moves the eyes — so a baked path never
// has to be swapped and a face in a React tree, a plugin pane or a shadow
// root all breathe in step.
//
// Scheduling goes through `createBudgetedLoop` (15fps budget, pause while the
// window is hidden/unfocused, dormancy, teardown). The clock parks itself
// when no face is mounted or none is visible; a mounting face (`BotFace`
// calls `startFaceClock`) or the IntersectionObserver wakes it.

import { CLOUD_BODY_PATH, faceEyeY, facePose, projectFacePoint, ringToPath, sampleFaceRing } from '@/lib/bot-avatar'
import { createBudgetedLoop } from '@/lib/budgeted-loop'

/** Paint one face for time `t` (seconds): body outline, eye line, catchlights,
 *  blink, thinking dots, and the head tilt as a CSS transform. */
export function paintMathFace(svg: SVGSVGElement, t: number): void {
  const mood = svg.getAttribute('data-hb-mood') || 'idle'
  const shape = svg.getAttribute('data-hb-shape') || 'circle'
  const pose = facePose(mood, t)
  const body = svg.querySelector('[data-hb-body]')
  const open = svg.querySelector('[data-hb-open]')
  const shut = svg.querySelector('[data-hb-shut]')
  const el = svg.querySelector('[data-hb-el]')
  const er = svg.querySelector('[data-hb-er]')
  const dots = svg.querySelectorAll('[data-hb-dot]')

  if (body) {
    if (shape === 'cloud') {
      body.setAttribute('d', CLOUD_BODY_PATH)
    } else {
      const ring = sampleFaceRing(shape).map(([x, y]) => projectFacePoint(x, y, pose.turn, pose.tilt, pose.roll))

      body.setAttribute('d', ringToPath(ring))
    }
  }

  const eyeY = faceEyeY(shape) + pose.gazeY
  const eyeL = 15.4 + pose.gazeX
  const eyeR = 24.6 + pose.gazeX

  if (el) {
    el.setAttribute('cx', String(eyeL))
    el.setAttribute('cy', String(eyeY))
  }

  if (er) {
    er.setAttribute('cx', String(eyeR))
    er.setAttribute('cy', String(eyeY))
  }

  // Catchlights ride the pupils (upper-left offset) — without this they stay
  // at the circle-face position and drift outside e.g. the cloud's lower-set
  // eyes.
  const hl = svg.querySelector('[data-hb-hl-l]')
  const hr = svg.querySelector('[data-hb-hl-r]')

  if (hl) {
    hl.setAttribute('cx', String(eyeL - 0.6))
    hl.setAttribute('cy', String(eyeY - 0.7))
  }

  if (hr) {
    hr.setAttribute('cx', String(eyeR - 0.6))
    hr.setAttribute('cy', String(eyeY - 0.7))
  }

  if (open) {
    open.setAttribute('opacity', pose.blink ? '0' : '1')
  }

  if (shut) {
    shut.setAttribute(
      'd',
      `M${eyeL - 2.6} ${eyeY} L${eyeL + 2.6} ${eyeY} M${eyeR - 2.6} ${eyeY} L${eyeR + 2.6} ${eyeY}`
    )
    shut.setAttribute('opacity', pose.blink ? '1' : '0')
  }

  dots.forEach((dot, i) => {
    const o = i === 0 ? pose.d0 : i === 1 ? pose.d1 : pose.d2

    dot.setAttribute('opacity', String(o))
  })

  svg.style.transform = `rotate(${pose.tilt}deg)`
  svg.style.transformOrigin = '50% 70%'
}

/** Every mounted math face, shadow roots included (plugin panes may render
 *  into one). */
export function walkMathFaces(root: Document | ShadowRoot | null | undefined, acc: SVGSVGElement[]): SVGSVGElement[] {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return acc
  }

  root.querySelectorAll<SVGSVGElement>('svg[data-hb-math]').forEach(node => acc.push(node))
  root.querySelectorAll('*').forEach(element => {
    if (element.shadowRoot) {
      walkMathFaces(element.shadowRoot, acc)
    }
  })

  return acc
}

interface FaceClock {
  stop: () => void
  wake: () => void
}

let clock: FaceClock | null = null

/** Start the clock, or wake it if it is parked. Idempotent: every `BotFace`
 *  mount routes here, and a face mounting is what wakes a dormant clock. */
export function startFaceClock(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (clock) {
    clock.wake()

    return
  }

  const t0 = performance.now()
  // A large roster can mount hundreds of faces. Observe the cached nodes so
  // off-screen cards do not consume a full animation frame by themselves.
  let faces: SVGSVGElement[] = []
  let lastScan = -Infinity
  const visibleFaces = new Set<SVGSVGElement>()
  const observedFaces = new Set<SVGSVGElement>()

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
          let becameVisible = false

          for (const entry of entries) {
            const target = entry.target as SVGSVGElement

            if (entry.isIntersecting) {
              visibleFaces.add(target)
              becameVisible = true
            } else {
              visibleFaces.delete(target)
            }
          }

          // A parked clock (no visible faces) resumes when one scrolls in.
          if (becameVisible) {
            clock?.wake()
          }
        })
      : null

  const scanFaces = () => {
    faces = walkMathFaces(window.document, [])

    if (!observer) {
      return
    }

    const currentFaces = new Set(faces)

    for (const svg of observedFaces) {
      if (!currentFaces.has(svg)) {
        observer.unobserve(svg)
        observedFaces.delete(svg)
        visibleFaces.delete(svg)
      }
    }

    for (const svg of faces) {
      if (!observedFaces.has(svg)) {
        observedFaces.add(svg)
        observer.observe(svg)
      }
    }
  }

  // 1Hz document rescans; paint only visible faces (all cached faces when
  // IntersectionObserver is unavailable).
  const paint = (now: number) => {
    if (now - lastScan > 1000) {
      scanFaces()
      lastScan = now
    }

    const t = (now - t0) / 1000
    const facesToPaint = observer ? visibleFaces : faces

    for (const svg of facesToPaint) {
      if (svg.isConnected) {
        paintMathFace(svg, t)
      }
    }
  }

  // Nothing worth animating: no faces mounted (the next BotFace mount wakes
  // us) or none visible (the observer wakes us when one scrolls in).
  const idle = () => faces.length === 0 || (observer !== null && visibleFaces.size === 0)

  const loop = createBudgetedLoop(paint, { fps: 15, idleWhen: idle })

  clock = {
    stop: () => {
      loop.dispose()
      observer?.disconnect()
      visibleFaces.clear()
      observedFaces.clear()
      faces = []
      clock = null
    },
    wake: () => {
      // Faces may have mounted/unmounted while parked — rescan on wake.
      lastScan = -Infinity
      loop.wake()
    }
  }
}

/** Tear the clock down: cancels the frame, disconnects the visibility
 *  observer, drops every cached node. The next `startFaceClock` starts fresh. */
export function stopFaceClock(): void {
  clock?.stop()
}

/** True while a clock exists (diagnostics/tests). */
export const faceClockRunning = (): boolean => clock !== null
