import { FeatureBand } from './FeatureBand'
import { Field, ProductWindow } from './ProductWindow'
import { Scene } from './Scene'

export function Schedule() {
  return (
    <FeatureBand
      id="agenda"
      title="O que se repete, o bot assume."
      flip
      scene={
        <Scene src="/media/dusk-ridge.png">
          <ProductWindow title="Novo cronjob · Analista Financeiro">
            <Field label="Nome" value="Briefing de segunda" />
            <Field label="Quando" value="Toda segunda · 09:00" />
            <Field
              label="Continuidade"
              value="Ligada — o bot lê o último output."
              tone="ok"
            />
          </ProductWindow>
        </Scene>
      }
    >
      <p>
        Cron no mesmo app: blueprints, horário em linguagem natural, job preso
        ao bot. Sem outro serviço.
      </p>
    </FeatureBand>
  )
}
