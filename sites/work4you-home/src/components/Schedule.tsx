import { DesktopShot } from './DesktopShot'
import { FeatureBand } from './FeatureBand'
import { Scene } from './Scene'

export function Schedule() {
  return (
    <FeatureBand
      id="agenda"
      stack
      title="O que se repete, o bot assume."
      scene={
        <Scene src="/media/dusk-ridge.png" position="center 40%">
          <DesktopShot
            src="/media/product/cron.jpg"
            alt="Work4You desktop — New Cronjob"
          />
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