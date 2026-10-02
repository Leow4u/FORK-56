import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The clock's scheduling is the app's budgeted loop; here it is a fake that
// hands back the draw callback and options so the tests drive frames by hand.
// IntersectionObserver is faked the same way so visibility can be scripted.
const loopFactory = vi.hoisted(() => {
  const calls = { dispose: 0, wake: 0 }

  const state: {
    draw: ((now: number) => void) | null
    options: { fps?: number; idleWhen?: () => boolean } | null
  } = { draw: null, options: null }

  return {
    calls,
    createBudgetedLoop: vi.fn((draw: (now: number) => void, options: { fps?: number; idleWhen?: () => boolean }) => {
      state.draw = draw
      state.options = options

      return {
        dispose: () => {
          calls.dispose += 1
        },
        isDormant: () => false,
        wake: () => {
          calls.wake += 1
        }
      }
    }),
    state
  }
})

vi.mock('@/lib/budgeted-loop', () => ({ createBudgetedLoop: loopFactory.createBudgetedLoop }))

class FakeIntersectionObserver {
  static instance: FakeIntersectionObserver | null = null
  callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void
  disconnected = false
  observed = new Set<Element>()

  constructor(callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
    this.callback = callback
    FakeIntersectionObserver.instance = this
  }

  disconnect() {
    this.disconnected = true
    this.observed.clear()
  }

  emit(entries: Array<{ isIntersecting: boolean; target: Element }>) {
    this.callback(entries)
  }

  observe(element: Element) {
    this.observed.add(element)
  }

  unobserve(element: Element) {
    this.observed.delete(element)
  }
}

const { faceClockRunning, paintMathFace, startFaceClock, stopFaceClock } = await import('./bot-face-clock')

function mountFace(shape = 'circle', mood = 'idle'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

  svg.setAttribute('data-hb-math', '1')
  svg.setAttribute('data-hb-shape', shape)
  svg.setAttribute('data-hb-mood', mood)
  svg.innerHTML =
    '<path data-hb-body="1" d=""></path>' +
    '<g data-hb-open="1"><ellipse data-hb-el="1"></ellipse><ellipse data-hb-er="1"></ellipse>' +
    '<circle data-hb-hl-l="1"></circle><circle data-hb-hl-r="1"></circle></g>' +
    '<path data-hb-shut="1" opacity="0"></path>' +
    '<circle data-hb-dot="1"></circle><circle data-hb-dot="1"></circle><circle data-hb-dot="1"></circle>'
  document.body.appendChild(svg)

  return svg
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  loopFactory.calls.dispose = 0
  loopFactory.calls.wake = 0
  loopFactory.createBudgetedLoop.mockClear()
})

afterEach(() => {
  stopFaceClock()
  document.body.innerHTML = ''
  FakeIntersectionObserver.instance = null
  vi.unstubAllGlobals()
})

describe('startFaceClock', () => {
  it('schedules through the budgeted loop at 15fps with a visibility-aware idle predicate', () => {
    const face = mountFace()

    startFaceClock()

    expect(loopFactory.createBudgetedLoop).toHaveBeenCalledTimes(1)
    expect(loopFactory.state.options?.fps).toBe(15)
    expect(typeof loopFactory.state.options?.idleWhen).toBe('function')

    // The first paint scans the document and starts observing the face.
    loopFactory.state.draw?.(1000)
    expect(FakeIntersectionObserver.instance?.observed.has(face)).toBe(true)
    // Observed but not yet visible → idle.
    expect(loopFactory.state.options?.idleWhen?.()).toBe(true)

    FakeIntersectionObserver.instance?.emit([{ isIntersecting: true, target: face }])
    expect(loopFactory.state.options?.idleWhen?.()).toBe(false)
    expect(loopFactory.calls.wake).toBeGreaterThanOrEqual(1)

    // A visible face gets painted on the next frame.
    loopFactory.state.draw?.(1100)
    expect(face.querySelector('[data-hb-body]')?.getAttribute('d')).toMatch(/^M.*Z$/)

    FakeIntersectionObserver.instance?.emit([{ isIntersecting: false, target: face }])
    expect(loopFactory.state.options?.idleWhen?.()).toBe(true)
  })

  it('is idle with no faces, and a re-entry (a face mounting) wakes rather than re-creates', () => {
    startFaceClock()
    loopFactory.state.draw?.(1000)

    expect(loopFactory.state.options?.idleWhen?.()).toBe(true)

    mountFace()
    startFaceClock()

    expect(loopFactory.createBudgetedLoop).toHaveBeenCalledTimes(1)
    expect(loopFactory.calls.wake).toBe(1)
  })

  it('forgets faces that left the document on the next scan', () => {
    const face = mountFace()

    startFaceClock()
    loopFactory.state.draw?.(1000)
    expect(FakeIntersectionObserver.instance?.observed.has(face)).toBe(true)

    face.remove()
    loopFactory.state.draw?.(2100)
    expect(FakeIntersectionObserver.instance?.observed.has(face)).toBe(false)
  })

  it('stopFaceClock disposes the loop, disconnects the observer, and a fresh start re-creates both', () => {
    mountFace()
    startFaceClock()
    loopFactory.state.draw?.(1000)
    const observer = FakeIntersectionObserver.instance

    expect(faceClockRunning()).toBe(true)

    stopFaceClock()

    expect(loopFactory.calls.dispose).toBe(1)
    expect(observer?.disconnected).toBe(true)
    expect(faceClockRunning()).toBe(false)

    startFaceClock()

    expect(loopFactory.createBudgetedLoop).toHaveBeenCalledTimes(2)
    expect(FakeIntersectionObserver.instance).not.toBe(observer)
  })
})

describe('paintMathFace', () => {
  it('moves the body, eyes and catchlights for the pose and shows the thinking dots while working', () => {
    const idle = mountFace('squircle', 'idle')
    const work = mountFace('cloud', 'work')

    paintMathFace(idle, 1)
    paintMathFace(work, 1)

    expect(idle.querySelector('[data-hb-body]')?.getAttribute('d')).toMatch(/^M.*Z$/)
    // The cloud keeps its hand-drawn body.
    expect(work.querySelector('[data-hb-body]')?.getAttribute('d')).toMatch(/^M11 32 a7\.5/)

    const idleEyeY = Number(idle.querySelector('[data-hb-el]')?.getAttribute('cy'))
    const workEyeY = Number(work.querySelector('[data-hb-el]')?.getAttribute('cy'))

    // Cloud eyes sit lower; a working gaze lifts them a little.
    expect(workEyeY).toBeGreaterThan(idleEyeY)
    // Catchlights ride the pupils.
    expect(Number(idle.querySelector('[data-hb-hl-l]')?.getAttribute('cy'))).toBeCloseTo(idleEyeY - 0.7, 5)

    const dotOpacity = (svg: SVGSVGElement) =>
      [...svg.querySelectorAll('[data-hb-dot]')].map(dot => Number(dot.getAttribute('opacity')))

    expect(Math.max(...dotOpacity(idle))).toBe(0)
    expect(Math.max(...dotOpacity(work))).toBeGreaterThan(0)
    expect(work.style.transform).toMatch(/^rotate\(/)
  })

  it('blinks by swapping the open eyes for the shut line', () => {
    const face = mountFace('circle', 'idle')

    paintMathFace(face, 1)
    expect(face.querySelector('[data-hb-open]')?.getAttribute('opacity')).toBe('1')
    expect(face.querySelector('[data-hb-shut]')?.getAttribute('opacity')).toBe('0')

    paintMathFace(face, 3.1)
    expect(face.querySelector('[data-hb-open]')?.getAttribute('opacity')).toBe('0')
    expect(face.querySelector('[data-hb-shut]')?.getAttribute('opacity')).toBe('1')
  })
})
