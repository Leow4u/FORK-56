import { useMemo } from 'react'
import { formatRun } from '../lib/dates'
import { compileTask } from '../lib/task-compiler'
import { FeatureBand } from './FeatureBand'
import { Glyph } from './Glyph'
import { Panel } from './Panel'
import styles from './Schedule.module.css'

/** Rotinas de exemplo, escritas como o usuário escreveria. A agenda sai do mesmo leitor da Fig. 02. */
const ROUTINES = [
  { name: 'Resumo de vendas', request: 'Toda segunda às 8h, me manda no WhatsApp o resumo das vendas da semana.' },
  { name: 'Briefing da manhã', request: 'De segunda a sexta às 7h30 me manda no Telegram a agenda do dia.' },
  { name: 'Cobrança de vencidos', request: 'Toda sexta às 10h, cobra os boletos vencidos no WhatsApp.' },
  { name: 'Backup de contratos', request: 'Todo dia às 2h, atualiza o backup da pasta de contratos no Drive.' },
] as const

export function Schedule() {
  const rows = useMemo(() => {
    const now = new Date()

    return ROUTINES.map((routine) => ({ ...routine, order: compileTask(routine.request, now) }))
  }, [])

  return (
    <FeatureBand
      fig={{ label: 'Rotinas', number: '06', tag: 'Agenda em linguagem natural' }}
      flip
      id="agenda"
      title="O que se repete, o bot assume."
      visual={
        <Panel meta={`${rows.length} ativas`} title="Rotinas">
          <ol className={styles.list}>
            {rows.map(({ name, order, request }) => (
              <li className={styles.row} key={name}>
                <div className={styles.main}>
                  <p className={styles.name}>
                    <Glyph name={order.delivery.glyph} />
                    {name}
                  </p>
                  <p className={styles.request}>“{request}”</p>
                </div>
                <div className={styles.when}>
                  <code className={styles.cron}>{order.trigger.code}</code>
                  <span className={styles.next}>
                    próxima: {order.nextRuns[0] ? formatRun(order.nextRuns[0]) : 'agora'}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      }
    >
      <p>
        Escreva a rotina em português. O Work4You transforma em agenda, prende ao bot certo e roda no mesmo app, sem
        outro serviço.
      </p>
    </FeatureBand>
  )
}
