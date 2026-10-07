import { useI18n } from '@/i18n'

import { Marked, StepField } from './channel-steps'

const SANS_FIELD = 'font-sans text-[0.8125rem]'

export function HomeDeliveryField({
  error,
  onChange,
  value
}: {
  error?: string
  onChange: (value: string) => void
  value: string
}) {
  const { t } = useI18n()
  const copy = t.messaging.homeDelivery

  return (
    <StepField
      className={SANS_FIELD}
      help={error ? <span className="text-destructive">{error}</span> : copy.help}
      label={copy.label}
      onChange={event => onChange(event.target.value)}
      value={value}
    />
  )
}

export function HomeDeliveryNote() {
  const { t } = useI18n()

  return <Marked className="text-(--ui-text-secondary)" text={t.messaging.homeDelivery.note} />
}
