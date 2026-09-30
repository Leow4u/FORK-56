import type { RaceScenario, RaceStep } from './race-scripts'

/**
 * Linha do tempo da demonstração do hero. Tudo é derivado de um único número,
 * os segundos desde o início da rodada, para que a tela seja uma função pura
 * do tempo (e o estado final, com `Infinity`, sirva para quem pede menos movimento).
 */

const TALK_DELAY = 0.9
const CHARS_PER_SECOND = 64
const STEP_SECONDS = 0.95
const INCOMING_SECONDS = 0.55
const STEP_GAP = 0.12
const WORK_DELAY = 0.45
const PARALLEL_SPAN = 2.6
const PARALLEL_STAGGER = 0.12
const VERDICT_DELAY = 0.35
const RECEIPT_DELAY = 0.2

export interface TimelineItem {
  end: number
  realEnd: number
  realStart: number
  start: number
}

export interface WorkTimeline {
  end: number
  items: TimelineItem[]
  realTotal: number
}

export interface RacePlan {
  end: number
  receiptAt: number
  scenario: RaceScenario
  talkEnd: number
  talkTimes: number[]
  work: WorkTimeline
}

export type RowState = 'done' | 'hidden' | 'running'

export interface RaceFrame {
  ended: boolean
  realSeconds: number
  receipt: boolean
  rows: RowState[]
  talkChars: number
  talkDone: boolean
  tasksDone: number
}

/** Quando cada caractere da resposta do chatbot aparece, com pausas na pontuação. */
export function talkRevealTimes(text: string): number[] {
  const times: number[] = []
  let t = TALK_DELAY

  // Por índice (unidades UTF-16), para bater com `text.slice(0, n)` na tela.
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    t += 1 / CHARS_PER_SECOND

    if (char === '.' || char === '?' || char === '!') {
      t += 0.13
    } else if (char === ',' || char === ':' || char === '\n') {
      t += 0.05
    }

    times.push(t)
  }

  return times
}

/**
 * Passos em sequência levam ~1 s de animação cada. Passos `parallel` consecutivos
 * começam juntos e terminam na proporção do seu tempo real, como subagentes.
 */
export function buildWorkTimeline(steps: readonly RaceStep[]): WorkTimeline {
  const items: TimelineItem[] = []
  let t = WORK_DELAY
  let real = 0
  let index = 0

  while (index < steps.length) {
    if (steps[index].kind === 'parallel') {
      const group: number[] = []

      while (index < steps.length && steps[index].kind === 'parallel') {
        group.push(index)
        index += 1
      }

      const longest = Math.max(...group.map((i) => steps[i].seconds))

      group.forEach((i, order) => {
        items[i] = {
          start: t + order * PARALLEL_STAGGER,
          end: t + 0.5 + (PARALLEL_SPAN * steps[i].seconds) / longest,
          realStart: real,
          realEnd: real + steps[i].seconds,
        }
      })
      t += 0.5 + PARALLEL_SPAN + 0.2
      real += longest
      continue
    }

    const step = steps[index]
    const duration = step.kind === 'incoming' ? INCOMING_SECONDS : STEP_SECONDS

    items[index] = { start: t, end: t + duration, realStart: real, realEnd: real + step.seconds }
    t += duration + STEP_GAP
    real += step.seconds
    index += 1
  }

  return { items, end: t, realTotal: real }
}

/** Tempo real acumulado mostrado no contador da raia do Work4You. */
export function realSecondsAt(work: WorkTimeline, t: number): number {
  let real = 0

  for (const item of work.items) {
    if (t >= item.end) {
      real = Math.max(real, item.realEnd)
    } else if (t > item.start) {
      const progress = (t - item.start) / (item.end - item.start)

      real = Math.max(real, item.realStart + (item.realEnd - item.realStart) * progress)
    }
  }

  return real
}

export function planRace(scenario: RaceScenario): RacePlan {
  const talkTimes = talkRevealTimes(scenario.talk)
  const talkEnd = (talkTimes.at(-1) ?? TALK_DELAY) + VERDICT_DELAY
  const work = buildWorkTimeline(scenario.steps)
  const receiptAt = work.end + RECEIPT_DELAY

  return { scenario, talkTimes, talkEnd, work, receiptAt, end: Math.max(talkEnd, receiptAt) }
}

function countRevealed(times: readonly number[], t: number): number {
  let low = 0
  let high = times.length

  while (low < high) {
    const mid = (low + high) >> 1

    if (times[mid] <= t) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

export function raceFrame(plan: RacePlan, t: number): RaceFrame {
  const { steps } = plan.scenario
  const rows = plan.work.items.map((item): RowState => (t < item.start ? 'hidden' : t < item.end ? 'running' : 'done'))
  const tasksDone = rows.filter((state, i) => state === 'done' && steps[i].kind !== 'incoming').length
  const receipt = t >= plan.receiptAt

  return {
    ended: t >= plan.end,
    realSeconds: receipt ? plan.work.realTotal : realSecondsAt(plan.work, t),
    receipt,
    rows,
    talkChars: countRevealed(plan.talkTimes, t),
    talkDone: t >= plan.talkEnd,
    tasksDone,
  }
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
}

const oneDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** "0,4 s", "13,2 s", "2 min 13 s" */
export function formatDuration(seconds: number): string {
  if (seconds < 59.95) {
    return `${oneDecimal.format(seconds)} s`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = Math.max(0, Math.floor(seconds - minutes * 60))

  return `${minutes} min ${String(rest).padStart(2, '0')} s`
}
