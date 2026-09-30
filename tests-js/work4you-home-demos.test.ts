/**
 * Contratos das demonstrações da home (sites/work4you-home): a corrida
 * "Chatbots conversam. O Work4You trabalha." do hero e a ordem de serviço logo
 * abaixo. As duas são simulações no navegador, então os testes cobrem a
 * coerência do que aparece na tela (agenda, contadores, ordem dos eventos),
 * não o texto exato dos roteiros.
 */
import { describe, expect, it } from 'vitest'

import { buildRaceScenarios } from '../sites/work4you-home/src/lib/race-scripts'
import { buildWorkTimeline, formatDuration, planRace, raceFrame } from '../sites/work4you-home/src/lib/race-timeline'
import { compileTask } from '../sites/work4you-home/src/lib/task-compiler'

// qua, 30/09/2026 16:20 no fuso local de quem roda o teste
const NOW = new Date(2026, 8, 30, 16, 20)

const REQUESTS = [
  'Toda sexta às 17h, manda no Slack quem não bateu a meta da semana.',
  'Toda segunda às 8h, me manda no WhatsApp o resumo das vendas da semana.',
  'Quando chegar nota fiscal no e-mail, lança na planilha do financeiro.',
  'Monitora o preço dos concorrentes todo dia e me avisa no Telegram se mudar.',
  'Marca uma reunião com a Loja Centro na quinta às 15h.',
  'Responde os clientes do WhatsApp que perguntarem do status do pedido.',
  'Publica no Instagram o post de amanhã às 10h',
  'Dia 5 de cada mês às 9h, manda por e-mail o fechamento do mês pro contador.',
  'A cada 30 minutos confere se o site caiu e avisa no Discord',
  'De segunda a sexta às 7h30 me manda a agenda do dia',
  'todo dia às 8 da noite me lembra de fechar o caixa',
  'traduz esse contrato pro inglês',
  'asdfgh',
]

describe('compileTask (ordem de serviço)', () => {
  it('turns a weekly request with a time into a cron schedule on that weekday', () => {
    const order = compileTask('Toda sexta às 17h, manda no Slack quem não bateu a meta da semana.', NOW)

    expect(order.status).toBe('scheduled')
    expect(order.trigger.code).toBe('0 17 * * 5')
    expect(order.delivery.label).toBe('Slack')
    expect(order.nextRuns).toHaveLength(3)

    for (const run of order.nextRuns) {
      expect(run.getDay()).toBe(5)
      expect(run.getHours()).toBe(17)
    }
  })

  it('only lists future runs, in chronological order', () => {
    for (const request of REQUESTS) {
      const runs = compileTask(request, NOW).nextRuns

      runs.forEach((run, index) => {
        expect(run.getTime()).toBeGreaterThan(NOW.getTime())

        if (index > 0) {
          expect(run.getTime()).toBeGreaterThan(runs[index - 1].getTime())
        }
      })
    }
  })

  it('never puts a weekday-only request on a weekend', () => {
    const friday = new Date(2026, 9, 2, 9, 0)
    const order = compileTask('De segunda a sexta às 7h30 me manda a agenda do dia', friday)

    expect(order.trigger.code).toBe('30 7 * * 1-5')
    expect(order.nextRuns).toHaveLength(3)

    for (const run of order.nextRuns) {
      expect([0, 6]).not.toContain(run.getDay())
    }
  })

  it('waits for an event instead of scheduling, and does not deliver back to the event source', () => {
    const order = compileTask('Quando chegar nota fiscal no e-mail, lança na planilha do financeiro.', NOW)

    expect(order.status).toBe('waiting')
    expect(order.trigger.code).toBe('evento')
    expect(order.nextRuns).toEqual([])
    expect(order.delivery.glyph).not.toBe('gmail')
  })

  it('reads monthly and fixed-interval schedules', () => {
    const monthly = compileTask('Dia 5 de cada mês às 9h, manda por e-mail o fechamento do mês pro contador.', NOW)

    expect(monthly.trigger.code).toBe('0 9 5 * *')
    expect(monthly.nextRuns.every((run) => run.getDate() === 5 && run.getHours() === 9)).toBe(true)

    const interval = compileTask('A cada 30 minutos confere se o site caiu e avisa no Discord', NOW)
    const [first, second] = interval.nextRuns

    expect(interval.trigger.code).toBe('*/30 * * * *')
    expect(second.getTime() - first.getTime()).toBe(30 * 60 * 1000)
  })

  it('still produces a complete order for requests it does not understand', () => {
    for (const request of ['asdfgh', '???', 'traduz esse contrato pro inglês']) {
      const order = compileTask(request, NOW)

      expect(order.steps.length).toBeGreaterThan(0)
      expect(order.sources.length).toBeGreaterThan(0)
      expect(order.delivery.label.length).toBeGreaterThan(0)
      expect(order.trigger.human.length).toBeGreaterThan(0)
    }
  })

  it('names the learned skill as a short kebab-case slug', () => {
    for (const request of REQUESTS) {
      const { skill } = compileTask(request, NOW)

      expect(skill).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(skill.length).toBeLessThanOrEqual(40)
    }
  })
})

describe('hero race (Conversa × Trabalho)', () => {
  const scenarios = buildRaceScenarios(NOW)

  it('finishes the Work4You lane before the chatbot finishes typing', () => {
    expect(scenarios.length).toBeGreaterThan(0)

    for (const scenario of scenarios) {
      const plan = planRace(scenario)

      expect(plan.receiptAt).toBeLessThan(plan.talkEnd)
    }
  })

  it('starts empty and ends with every step done and the receipt shown', () => {
    for (const scenario of scenarios) {
      const plan = planRace(scenario)
      const start = raceFrame(plan, 0)
      const end = raceFrame(plan, Number.POSITIVE_INFINITY)

      expect(start.rows.every((state) => state === 'hidden')).toBe(true)
      expect(start.talkChars).toBe(0)
      expect(start.receipt).toBe(false)

      expect(end.ended).toBe(true)
      expect(end.talkDone).toBe(true)
      expect(end.talkChars).toBe(scenario.talk.length)
      expect(end.rows.every((state) => state === 'done')).toBe(true)
      expect(end.tasksDone).toBe(scenario.steps.filter((step) => step.kind !== 'incoming').length)
      expect(end.realSeconds).toBe(plan.work.realTotal)
    }
  })

  it('never moves a counter backwards while the demo plays', () => {
    for (const scenario of scenarios) {
      const plan = planRace(scenario)
      let previous = raceFrame(plan, 0)

      for (let t = 0.05; t <= plan.end + 0.5; t += 0.05) {
        const frame = raceFrame(plan, t)

        expect(frame.talkChars).toBeGreaterThanOrEqual(previous.talkChars)
        expect(frame.tasksDone).toBeGreaterThanOrEqual(previous.tasksDone)
        expect(frame.realSeconds).toBeGreaterThanOrEqual(previous.realSeconds - 1e-9)
        previous = frame
      }
    }
  })

  it('runs parallel steps together and counts only the longest one in real time', () => {
    const timeline = buildWorkTimeline([
      { detail: '', glyph: 'team', seconds: 1, tool: 'delegar' },
      { detail: '', glyph: 'branch', kind: 'parallel', seconds: 40, tool: 'curto' },
      { detail: '', glyph: 'branch', kind: 'parallel', seconds: 100, tool: 'longo' },
      { detail: '', glyph: 'notion', seconds: 2, tool: 'fechar' },
    ])

    const [, short, long, last] = timeline.items

    expect(short.realStart).toBe(long.realStart)
    expect(short.end).toBeLessThan(long.end)
    expect(last.start).toBeGreaterThan(long.end)
    expect(timeline.realTotal).toBe(1 + 100 + 2)
  })

  it('formats durations the Brazilian way', () => {
    expect(formatDuration(0.4)).toBe('0,4 s')
    expect(formatDuration(13.2)).toBe('13,2 s')
    expect(formatDuration(132.6)).toBe('2 min 12 s')
  })
})
