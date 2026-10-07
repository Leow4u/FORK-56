import type { BotMood } from './bot-avatar'

interface Reaction {
  kind: 'greet' | 'press'
  startedAt: number
}

const reactions = new WeakMap<HTMLElement, Reaction>()

/** Decorative feedback belongs to the existing control; it never consumes
 * its click, keyboard event or selection. No timers per avatar. */
export function reactCharacter(face: HTMLElement, kind: Reaction['kind'], now = performance.now()): void {
  reactions.set(face, { kind, startedAt: now / 1000 })
}

/** Stable offsets keep a roster from breathing/blinking in unison. */
export function characterPhase(name: string, character: string): number {
  let hash = 0

  for (const letter of `${name}:${character}`) {
    hash = (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0
  }

  return (hash % 1000) / 100
}

function blink(t: number): number {
  const cycle = ((t % 4.7) + 4.7) % 4.7

  // A short close, hold and reopen, sampled by the existing 15fps clock.
  if (cycle < 4.36) {
    return 1
  }

  if (cycle < 4.47) {
    return 1 - ((cycle - 4.36) / 0.11) * 0.92
  }

  if (cycle < 4.54) {
    return 0.08
  }

  return 0.08 + ((cycle - 4.54) / 0.16) * 0.92
}

export function characterPose(mood: BotMood, time: number, phase = 0, reaction?: Reaction) {
  const t = time + phase
  const working = mood === 'work'
  const breath = Math.sin(t * 1.65)
  let lift = Math.sin(t * 1.1) * (working ? 0.7 : 0.35)
  let tilt = Math.sin(t * (working ? 1.25 : 0.48)) * (working ? 2.2 : 0.8)
  let scaleX = 1 - breath * 0.003
  let scaleY = 1 + breath * 0.006
  let eyes = blink(t)
  let gazeX = Math.sin(t * 0.48) * (working ? 2.1 : 0.65)
  let gazeY = working ? -1.5 + Math.sin(t * 0.6) * 0.6 : 0

  if (reaction) {
    const elapsed = time - reaction.startedAt
    const duration = reaction.kind === 'press' ? 0.65 : 0.9

    if (elapsed >= 0 && elapsed < duration) {
      const wave = Math.sin((elapsed / duration) * Math.PI)

      tilt += wave * (reaction.kind === 'press' ? -5 : 3)
      lift -= wave * (reaction.kind === 'press' ? 3 : 1)
      scaleX += wave * 0.018
      scaleY -= wave * 0.012
      gazeX = wave * 1.7
      gazeY = -wave
      // A brief friendly squint on activation, with a gentle reopen.
      eyes = reaction.kind === 'press' ? 1 - wave * 0.7 : 1
    }
  }

  return { eyes, gazeX, gazeY, lift, scaleX, scaleY, tilt }
}

/** The artwork stays intact; only the registered eye layers move locally.
 * Sunglasses intentionally have no exposed eyes to blink. */
export function paintCharacterFace(face: HTMLElement, now: number, reducedMotion = false): void {
  const overlay = face.querySelector<SVGSVGElement>('[data-character-eyes]')

  if (reducedMotion) {
    face.style.transform = ''

    if (overlay) {
      overlay.style.visibility = 'hidden'
    }

    reactions.delete(face)

    return
  }

  let reaction = reactions.get(face)

  if (reaction && now - reaction.startedAt > 1) {
    reactions.delete(face)
    reaction = undefined
  }

  const pose = characterPose(
    face.dataset.hbMood === 'work' ? 'work' : 'idle',
    now,
    Number(face.dataset.hbPhase) || 0,
    reaction
  )

  face.style.transform = `translateY(${pose.lift.toFixed(3)}%) rotate(${pose.tilt.toFixed(3)}deg) scale(${pose.scaleX.toFixed(4)}, ${pose.scaleY.toFixed(4)})`

  if (overlay) {
    overlay.style.visibility = overlay.dataset.ready === 'true' ? 'visible' : 'hidden'
    overlay.querySelectorAll<SVGGElement>('[data-character-eye]').forEach(eye => {
      const x = Number(eye.dataset.eyeX)
      const y = Number(eye.dataset.eyeY)

      eye.setAttribute(
        'transform',
        `translate(${x + pose.gazeX} ${y + pose.gazeY}) scale(1 ${pose.eyes.toFixed(3)}) translate(${-x} ${-y})`
      )
    })
  }
}
