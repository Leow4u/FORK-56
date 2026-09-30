import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRaceScenarios } from '../lib/race-scripts'
import type { RaceReceipt, RaceStep } from '../lib/race-scripts'
import { countWords, formatDuration, planRace, raceFrame } from '../lib/race-timeline'
import type { RacePlan, RowState } from '../lib/race-timeline'
import { useElapsed } from '../lib/use-elapsed'
import { useInView } from '../lib/use-in-view'
import { usePrefersReducedMotion } from '../lib/use-reduced-motion'
import { Glyph } from './Glyph'
import { Icon } from './Icon'
import styles from './HeroRace.module.css'

/** Depois de terminar, a demonstração espera este tempo na tela e passa ao próximo roteiro. */
const IDLE_SECONDS = 6.5

interface HeroRaceProps {
  onWorkDone: (done: boolean) => void
}

/** Fig. 01: o mesmo pedido para um chatbot comum e para o Work4You, lado a lado. */
export function HeroRace({ onWorkDone }: HeroRaceProps) {
  const scenarios = useMemo(() => buildRaceScenarios(new Date()), [])
  const reduced = usePrefersReducedMotion()
  const [rootRef, inView] = useInView<HTMLDivElement>()
  const [run, setRun] = useState({ id: 0, index: 0 })
  const [auto, setAuto] = useState(true)
  const [ended, setEnded] = useState(false)
  const scenario = scenarios[run.index]
  const plan = useMemo(() => planRace(scenario), [scenario])
  const count = scenarios.length

  const play = (index: number) => {
    setAuto(false)
    setEnded(false)
    setRun((current) => ({ id: current.id + 1, index }))
  }
  const advance = useCallback(() => {
    setEnded(false)
    setRun((current) => ({ id: current.id + 1, index: (current.index + 1) % count }))
  }, [count])
  const stopAuto = useCallback(() => setAuto(false), [])
  const queued = ended && auto && !reduced

  return (
    <div className={queued ? `${styles.race} ${styles.queued}` : styles.race} ref={rootRef}>
      <p className="sr-only">
        Demonstração: a mesma tarefa é pedida a um chatbot comum, que responde com instruções em texto e não executa
        nada, e ao Work4You, que executa cada passo e mostra o resultado entregue.
      </p>

      <div className={styles.ask}>
        <span className={`mono-label ${styles.askLabel}`}>Pedido</span>
        <p className={styles.askText} key={scenario.key}>
          “{scenario.ask}”
        </p>
        <button className={styles.replay} onClick={() => play(run.index)} type="button">
          <Icon className={styles.replayIcon} name="replay" />
          Repetir
        </button>
      </div>

      <div aria-hidden="true" className={styles.fork} />

      <RaceLanes
        active={inView && !reduced}
        autoAdvance={auto && !reduced}
        finalOnly={reduced}
        key={run.id}
        onEnded={setEnded}
        onIdle={advance}
        onInteract={stopAuto}
        onWorkDone={onWorkDone}
        plan={plan}
      />

      <div aria-label="Escolha outra tarefa" className={styles.tryRow} role="group">
        <span className={`mono-label ${styles.tryLabel}`}>Teste outra tarefa</span>
        {scenarios.map((item, index) => (
          <button
            aria-pressed={index === run.index}
            className={styles.chip}
            key={item.key}
            onClick={() => play(index)}
            type="button"
          >
            {item.chip}
            <span aria-hidden="true" className={styles.chipBar} />
          </button>
        ))}
      </div>

      <p className={styles.note}>
        Demonstração com dados fictícios. O chatbot à esquerda é genérico e não tem acesso às suas ferramentas.
      </p>
    </div>
  )
}

interface RaceLanesProps {
  active: boolean
  autoAdvance: boolean
  finalOnly: boolean
  onEnded: (ended: boolean) => void
  onIdle: () => void
  onInteract: () => void
  onWorkDone: (done: boolean) => void
  plan: RacePlan
}

/** Uma rodada da demonstração. Remonta a cada rodada, então o relógio sempre começa do zero. */
function RaceLanes({ active, autoAdvance, finalOnly, onEnded, onIdle, onInteract, onWorkDone, plan }: RaceLanesProps) {
  const [clockOn, setClockOn] = useState(true)
  const elapsed = useElapsed(active && clockOn && !finalOnly)
  const frame = raceFrame(plan, finalOnly ? Number.POSITIVE_INFINITY : elapsed)
  const talkRef = useRef<HTMLDivElement>(null)
  const workRef = useRef<HTMLDivElement>(null)
  const idleFired = useRef(false)
  const { receipt, steps, talk } = plan.scenario
  const said = talk.slice(0, frame.talkChars)
  const shownRows = frame.rows.filter((state) => state !== 'hidden').length

  useEffect(() => {
    onWorkDone(frame.receipt)
  }, [frame.receipt, onWorkDone])

  useEffect(() => {
    onEnded(frame.ended)
  }, [frame.ended, onEnded])

  // Sem troca automática, o relógio para no fim da rodada.
  useEffect(() => {
    if (frame.ended && !autoAdvance) {
      setClockOn(false)
    }
  }, [autoAdvance, frame.ended])

  useEffect(() => {
    if (autoAdvance && !idleFired.current && elapsed >= plan.end + IDLE_SECONDS) {
      idleFired.current = true
      onIdle()
    }
  }, [autoAdvance, elapsed, onIdle, plan.end])

  // As duas raias acompanham o fim do conteúdo, como um terminal.
  useEffect(() => {
    const node = talkRef.current

    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [frame.talkChars, frame.talkDone])

  useEffect(() => {
    const node = workRef.current

    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [shownRows, frame.receipt])

  const workClasses = [styles.lane, styles.workLane, frame.receipt ? '' : styles.running].filter(Boolean).join(' ')
  const workState = frame.receipt ? (receipt.kind === 'approval' ? 'Aguardando você' : 'Concluído') : 'Executando'

  return (
    <div className={styles.lanes}>
      <section aria-label="Chatbot comum" className={`${styles.lane} ${styles.talkLane}`}>
        <header className={`mono-label ${styles.laneHead}`}>
          <span>Chatbot comum</span>
          <span>Responde em texto</span>
        </header>
        <div className={styles.laneBody} ref={talkRef}>
          <div className={styles.message}>
            <span aria-hidden="true" className={styles.avatar}>
              <Icon className={styles.avatarIcon} name="bot" />
            </span>
            {frame.talkChars === 0 ? (
              <span aria-hidden="true" className={styles.typing}>
                <i />
                <i />
                <i />
              </span>
            ) : (
              <p className={styles.talkText}>
                {said}
                {frame.talkDone ? null : <span aria-hidden="true" className={styles.caret} />}
              </p>
            )}
          </div>
          {frame.talkDone ? (
            <div className={styles.verdict}>
              <span className={`mono-label ${styles.verdictLabel}`}>Resultado</span>
              Nada foi executado. O trabalho continua com você.
            </div>
          ) : null}
        </div>
        <footer className={`mono-label ${styles.laneFoot}`}>
          <span>
            Palavras <b>{countWords(said)}</b>
          </span>
          <span>
            Tarefas executadas <b>0</b>
          </span>
        </footer>
      </section>

      <section aria-label="Work4You" className={workClasses}>
        <header className={`mono-label ${styles.laneHead}`}>
          <span className={styles.who}>Work4You · agente</span>
          <span className={styles.state}>
            <i aria-hidden="true" />
            {workState}
          </span>
        </header>
        <div className={styles.laneBody} ref={workRef}>
          <ol className={styles.log}>
            {steps.map((step, index) =>
              frame.rows[index] === 'hidden' ? null : (
                <LogRow key={`${step.tool}-${index}`} state={frame.rows[index]} step={step} />
              ),
            )}
          </ol>
          {frame.receipt ? <Receipt onInteract={onInteract} receipt={receipt} /> : null}
        </div>
        <footer className={`mono-label ${styles.laneFoot}`}>
          <span>
            Tarefas executadas <b>{frame.tasksDone}</b>
          </span>
          <span>
            Tempo <b>{formatDuration(frame.realSeconds)}</b>
          </span>
        </footer>
      </section>
    </div>
  )
}

interface LogRowProps {
  state: RowState
  step: RaceStep
}

function LogRow({ state, step }: LogRowProps) {
  const incoming = step.kind === 'incoming'
  const classes = [
    styles.row,
    incoming ? styles.rowIncoming : '',
    step.kind === 'parallel' ? styles.rowParallel : '',
    state === 'running' && !incoming ? styles.rowRunning : '',
  ]
    .filter(Boolean)
    .join(' ')
  let status = null
  let duration = 'recebida'

  if (!incoming) {
    status = state === 'done' ? <Icon className={styles.check} name="check" /> : <span className={styles.spinner} />
    duration = state === 'done' ? formatDuration(step.seconds) : '…'
  }

  return (
    <li className={classes}>
      <span className={styles.status}>{status}</span>
      <Glyph className={styles.rowGlyph} name={step.glyph} />
      <span className={styles.tool}>{step.tool}</span>
      <span className={styles.detail}>{step.detail}</span>
      <span className={styles.duration}>{duration}</span>
    </li>
  )
}

const RECEIPT_GLYPH = { approval: 'notion', slack: 'slack', whatsapp: 'whatsapp' } as const

interface ReceiptProps {
  onInteract: () => void
  receipt: RaceReceipt
}

/** O comprovante do que foi entregue, no canal de destino. */
function Receipt({ onInteract, receipt }: ReceiptProps) {
  const [decision, setDecision] = useState<'approved' | 'preview' | null>(null)
  const done = receipt.kind !== 'approval' || decision === 'approved'

  const decide = (next: 'approved' | 'preview') => {
    onInteract()
    setDecision(next)
  }

  return (
    <div className={styles.receipt}>
      <div className={`mono-label ${styles.receiptHead}`}>
        <Glyph name={RECEIPT_GLYPH[receipt.kind]} />
        {receipt.head}
      </div>

      {receipt.kind === 'whatsapp' ? (
        <>
          <p className={`${styles.bubble} ${styles.zap}`}>
            {receipt.text}
            <small className={styles.zapMeta}>
              {receipt.time}
              <Icon className={styles.seen} name="doubleCheck" />
            </small>
          </p>
          <p className={styles.receiptFoot}>{receipt.foot}</p>
        </>
      ) : null}

      {receipt.kind === 'slack' ? (
        <div className={`${styles.bubble} ${styles.card}`}>
          <div>
            <b>Work4You</b>
            <span className={styles.appTag}>APP</span>
          </div>
          {receipt.text}
        </div>
      ) : null}

      {receipt.kind === 'approval' ? (
        <>
          <p className={`${styles.bubble} ${styles.card}`}>{receipt.text}</p>
          <div className={styles.approval}>
            {decision === 'approved' ? (
              <span>{receipt.approved}</span>
            ) : (
              <>
                <span>{receipt.question}</span>
                <div className={styles.approvalActions}>
                  <button className={`${styles.mini} ${styles.miniPrimary}`} onClick={() => decide('approved')} type="button">
                    Aprovar
                  </button>
                  <button
                    className={styles.mini}
                    disabled={decision === 'preview'}
                    onClick={() => decide('preview')}
                    type="button"
                  >
                    {decision === 'preview' ? 'Plano aberto no Notion (demonstração)' : 'Ver antes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      {done ? <span className={styles.stamp}>Feito</span> : null}
    </div>
  )
}
