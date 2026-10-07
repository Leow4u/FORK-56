import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useI18n } from '@/i18n'
import { ChevronDown, Mail, Monitor } from '@/lib/icons'
import type { CronDeliveryTarget } from '@/types/work4you'

import { PlatformAvatar } from '../messaging/platform-icon'

import { parseCronDeliveryTargets, toggleCronDeliveryTarget } from './cron-job-model'

function DeliveryIcon({ id, name }: { id: string; name: string }) {
  if (id === 'local') {
    return <Monitor aria-hidden className="size-5 shrink-0" />
  }

  if (id === 'email') {
    return <Mail aria-hidden className="size-5 shrink-0" />
  }

  return (
    <PlatformAvatar
      className="size-6"
      glyphClassName="size-5"
      platformId={id}
      platformName={name}
      style={{ backgroundColor: 'transparent' }}
    />
  )
}

export function RoutineDeliveryPicker({
  value,
  onChange,
  targets,
  loading,
  failed,
  onRetry
}: {
  value: string
  onChange: (value: string) => void
  targets: CronDeliveryTarget[]
  loading: boolean
  failed: boolean
  onRetry: () => void
}) {
  const { t } = useI18n()
  const c = t.cron
  const sideMenu = useMediaQuery('(min-width: 90rem)')
  const selected = parseCronDeliveryTargets(value)

  const rows = targets.some(target => target.id === 'local')
    ? targets
    : [{ id: 'local', name: c.deliveryLabels.local, home_target_set: true }, ...targets]

  const label = (target: { id: string; name: string }) => c.deliveryLabels[target.id] ?? target.name

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="routine-setting-row routine-delivery-trigger" type="button">
          <span>{c.create.receive}</span>
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span aria-hidden className="flex shrink-0 items-center gap-1">
              {selected.slice(0, 2).map(id => (
                <DeliveryIcon id={id} key={id} name={id} />
              ))}
            </span>
            <span className="truncate">
              {selected.length === 1
                ? label(rows.find(row => row.id === selected[0]) ?? { id: selected[0], name: selected[0] })
                : c.create.destinations(selected.length)}
            </span>
            <ChevronDown aria-hidden className="size-4 shrink-0" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="routine-delivery-menu w-80 max-w-[calc(100vw-2rem)] p-4"
        side={sideMenu ? 'right' : 'bottom'}
        sideOffset={12}
      >
        <p className="font-semibold">{c.create.receive}</p>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">{c.create.receiveHint}</p>
        <div aria-label={c.create.receive} role="group">
          {rows.map(target => (
            <label className="routine-delivery-option" key={target.id}>
              <DeliveryIcon id={target.id} name={target.name} />
              <span className="min-w-0 flex-1">
                <span className="block">{label(target)}</span>
                {!target.home_target_set && (
                  <span className="block text-xs text-muted-foreground">{c.deliverNeedsHomeChannel}</span>
                )}
              </span>
              <Checkbox
                checked={selected.includes(target.id)}
                onCheckedChange={checked => onChange(toggleCronDeliveryTarget(value, target.id, checked === true))}
              />
            </label>
          ))}
        </div>
        {loading && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {t.common.loading}
          </p>
        )}
        {failed && (
          <button className="mt-3 text-xs text-destructive underline" onClick={onRetry} type="button">
            {c.create.retryDestinations}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
