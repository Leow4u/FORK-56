import { useState } from 'react'
import type { ReactNode } from 'react'
import { formatRun } from '../lib/dates'
import { compileTask } from '../lib/task-compiler'
import type { TaskOrder as Order, TaskStatus, TaskTag } from '../lib/task-compiler'
import { HeroCtas } from './Ctas'
import { Glyph } from './Glyph'
import styles from './TaskOrder.module.css'

const DEFAULT_REQUEST = 'Toda sexta às 17h, manda no Slack quem não bateu a meta da semana.'

const EXAMPLES = [
  {
    label: 'Resumo de vendas toda segunda',
    request: 'Toda segunda às 8h, me manda no WhatsApp o resumo das vendas da semana.',
  },
  { label: 'Nota fiscal que chega no e-mail', request: 'Quando chegar nota fiscal no e-mail, lança na planilha do financeiro.' },
  {
    label: 'Preço dos concorrentes',
    request: 'Monitora o preço dos concorrentes todo dia e me avisa no Telegram se mudar.',
  },
  {
    label: 'Status do pedido no WhatsApp',
    request: 'Responde os clientes do WhatsApp que perguntarem do status do pedido.',
  },
] as const

const STATUS: Record<TaskStatus, { label: string; live: boolean }> = {
  running: { label: 'Em execução', live: true },
  scheduled: { label: 'Agendada', live: false },
  waiting: { label: 'Ativa · aguardando evento', live: true },
}

/** Fig. 02: o visitante escreve uma tarefa e vê o pedido virar uma ordem de serviço. */
export function TaskOrder() {
  const [value, setValue] = useState('')
  const [order, setOrder] = useState(() => compileTask(DEFAULT_REQUEST, new Date()))
  const [version, setVersion] = useState(0)
  const [empty, setEmpty] = useState(false)

  const submit = (request: string) => {
    if (!request.trim()) {
      setEmpty(true)

      return
    }

    setEmpty(false)
    setOrder(compileTask(request, new Date()))
    setVersion((current) => current + 1)
  }

  return (
    <section aria-labelledby="ordem-title" className={styles.section} id="ordem">
      <div className="shell">
        <div className={`mono-label ${styles.fig}`}>
          <span>Fig. 02 — Ordem de serviço</span>
          <span className={styles.live}>
            <i aria-hidden="true" className={styles.dot} />
            Experimente
          </span>
        </div>

        <div className={styles.grid}>
          <div>
            <h2 className={styles.title} id="ordem-title">
              Você pede em português. <span>Ele transforma em trabalho.</span>
            </h2>
            <p className={styles.lede}>
              Escreva uma tarefa do seu dia. O Work4You entende quando fazer, onde buscar e o que entregar, e guarda o
              caminho para a próxima vez.
            </p>

            <form
              className={styles.form}
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit(value)
              }}
            >
              <label className={`mono-label ${styles.label}`} htmlFor="tarefa">
                Diga uma tarefa
              </label>
              <div className={styles.field}>
                <span aria-hidden="true" className={styles.prompt}>
                  ›
                </span>
                <input
                  autoComplete="off"
                  className={styles.input}
                  id="tarefa"
                  maxLength={180}
                  name="tarefa"
                  onChange={(event) => {
                    setValue(event.target.value)
                    setEmpty(false)
                  }}
                  placeholder="Ex.: toda sexta às 17h, manda no Slack quem não bateu a meta"
                  type="text"
                  value={value}
                />
                <button className={styles.submit} type="submit">
                  Criar tarefa
                </button>
              </div>
              {empty ? (
                <p className={styles.error} role="alert">
                  Escreva uma tarefa. Por exemplo: “todo dia às 9h, me manda a agenda no WhatsApp”.
                </p>
              ) : null}
              <div aria-label="Exemplos de tarefas" className={styles.examples} role="group">
                {EXAMPLES.map((example) => (
                  <button
                    className={styles.example}
                    key={example.label}
                    onClick={() => {
                      setValue(example.request)
                      submit(example.request)
                    }}
                    type="button"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </form>

            <div className={styles.ctas}>
              <HeroCtas />
            </div>
          </div>

          <div>
            {/* A região viva fica fora do cartão, que remonta a cada pedido para reanimar as linhas. */}
            <div aria-live="polite">
              <OrderCard animate={version > 0} key={version} order={order} />
            </div>
            <p className={styles.note}>
              Demonstração: a ordem de serviço é montada no seu navegador, com regras simples, sem enviar nada.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

interface OrderCardProps {
  animate: boolean
  order: Order
}

function OrderCard({ animate, order }: OrderCardProps) {
  const status = STATUS[order.status]
  const rows: { label: string; quote?: boolean; value: ReactNode }[] = [
    { label: 'Pedido', quote: true, value: `“${order.request}”` },
    {
      label: 'Gatilho',
      value: (
        <>
          <code className={styles.code}>{order.trigger.code}</code>
          {order.trigger.human}
        </>
      ),
    },
    { label: 'Lê de', value: <Tags items={order.sources} /> },
    {
      label: 'Faz',
      value: (
        <span className={styles.flow}>
          {order.steps.map((step, index) => (
            <span key={`${index}-${step}`}>
              {index > 0 ? <i aria-hidden="true">→</i> : null}
              {step}
            </span>
          ))}
        </span>
      ),
    },
    { label: 'Entrega', value: <Tags items={[order.delivery]} /> },
    {
      label: 'Aprende',
      value: (
        <>
          <code className={styles.code}>{order.skill}</code>
          guardada para a próxima vez
        </>
      ),
    },
    { label: 'Próximas', value: <NextRuns order={order} /> },
  ]

  return (
    <div className={animate ? `${styles.card} ${styles.animate}` : styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.number}>Ordem de serviço Nº {order.number}</span>
        <span className={status.live ? `mono-label ${styles.pill} ${styles.pillLive}` : `mono-label ${styles.pill}`}>
          <i aria-hidden="true" />
          {status.label}
        </span>
      </div>
      <dl className={styles.rows}>
        {rows.map((row, index) => (
          <div className={styles.row} key={row.label} style={animate ? { animationDelay: `${index * 0.11}s` } : undefined}>
            <dt className="mono-label">{row.label}</dt>
            <dd className={row.quote ? styles.quote : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Tags({ items }: { items: TaskTag[] }) {
  return (
    <span className={styles.tags}>
      {items.map((item) => (
        <span className={styles.tag} key={item.label}>
          <Glyph className={styles.tagGlyph} name={item.glyph} />
          {item.label}
        </span>
      ))}
    </span>
  )
}

function NextRuns({ order }: { order: Order }) {
  if (order.status === 'waiting') {
    return <span className={styles.tag}>em tempo real, a cada novo evento</span>
  }

  if (order.nextRuns.length === 0) {
    return <span className={styles.tag}>agora</span>
  }

  return (
    <span className={styles.tags}>
      {order.nextRuns.map((run) => (
        <span className={styles.tag} key={run.getTime()}>
          {formatRun(run)}
        </span>
      ))}
    </span>
  )
}
