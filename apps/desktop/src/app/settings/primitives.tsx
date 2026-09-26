import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { triggerHaptic } from '@/lib/haptics'
import type { IconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { PAGE_INSET_X, PAGE_SETTINGS_MAX_W } from '../layout-constants'

// `bare` drops the page gutters + tall bottom pad for embedding in a tighter
// surface (e.g. the boot-failure recovery card owns its own padding).
export function SettingsContent({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  return (
    <section className="min-h-0 overflow-hidden">
      <div
        className={cn(
          'h-full min-h-0 overflow-y-auto',
          bare ? 'px-5 pb-6' : cn('mx-auto w-full pb-20', PAGE_SETTINGS_MAX_W, PAGE_INSET_X)
        )}
        data-slot={bare ? undefined : 'settings-content'}
      >
        {children}
      </div>
    </section>
  )
}

const PILL_VARIANT = { muted: 'muted', primary: 'default', warn: 'warn' } as const

export function Pill({ tone = 'muted', children }: { tone?: keyof typeof PILL_VARIANT; children: ReactNode }) {
  return <Badge variant={PILL_VARIANT[tone]}>{children}</Badge>
}

export function SectionHeading({
  aside,
  description,
  icon: Icon,
  meta,
  title,
  variant = 'section'
}: {
  // Right-aligned trailing content on the heading row (e.g. a compact status +
  // action), so a single-item section needn't repeat its own label as a row.
  aside?: ReactNode
  description?: ReactNode
  icon?: IconComponent
  meta?: string
  title: string
  variant?: 'group' | 'page' | 'section'
}) {
  if (variant === 'page') {
    return (
      <header className="mb-6">
        <div className="flex items-end gap-3">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {meta && <Pill>{meta}</Pill>}
          {aside && <div className="mb-0.5 flex min-w-0 items-center">{aside}</div>}
        </div>
        {description && (
          <div className="mt-1.5 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
            {description}
          </div>
        )}
      </header>
    )
  }

  if (variant === 'group') {
    return (
      <div className="mb-2 flex items-center gap-2">
        <h2 className="min-w-0 text-[length:var(--conversation-text-font-size)] font-medium text-(--ui-text-secondary)">
          {title}
        </h2>
        {meta && <Pill>{meta}</Pill>}
        {aside && <div className="ml-auto flex min-w-0 items-center">{aside}</div>}
      </div>
    )
  }

  return (
    <div className="mb-2.5 flex items-center gap-2 pt-2 text-[length:var(--conversation-text-font-size)] font-medium">
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span>{title}</span>
      {meta && <Pill>{meta}</Pill>}
      {aside && <div className="ml-auto flex min-w-0 items-center">{aside}</div>}
    </div>
  )
}

// Grouped rows on the off-white settings page. The label stays outside; the
// rows sit in one white card so every settings screen shares the same group.
export function SettingsGroup({
  aside,
  children,
  className,
  meta,
  title
}: {
  aside?: ReactNode
  children: ReactNode
  className?: string
  meta?: string
  title?: string
}) {
  return (
    <section className={cn('mb-6 last:mb-0', className)}>
      {title ? <SectionHeading aside={aside} meta={meta} title={title} variant="group" /> : null}
      <div
        className="divide-y divide-(--ui-stroke-secondary) overflow-hidden rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-editor) px-4"
        data-slot="settings-group"
      >
        {children}
      </div>
    </section>
  )
}

// A titled section: quiet group label + well. Keeps the heading and its
// content welded together so pages stop hand-rolling a heading + body at
// every call site.
export function SettingsSection({
  aside,
  children,
  icon: _icon,
  meta,
  title
}: {
  aside?: ReactNode
  children: ReactNode
  icon?: IconComponent
  meta?: string
  title: string
}) {
  return (
    <SettingsGroup aside={aside} meta={meta} title={title}>
      {children}
    </SettingsGroup>
  )
}

export function NavLink({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: IconComponent
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      className={cn(
        'flex min-h-7 w-full justify-start gap-2 rounded-md px-2 text-left text-[length:var(--conversation-text-font-size)] transition',
        active
          ? 'bg-(--ui-bg-tertiary) text-foreground'
          : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground'
      )}
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Button>
  )
}

export function ListRow({
  title,
  description,
  hint,
  action,
  below,
  'data-tour': dataTour,
  id,
  wide = false,
  className
}: {
  title: ReactNode
  description?: ReactNode
  hint?: ReactNode
  action?: ReactNode
  below?: ReactNode
  /** Durable handle for tours (see lib/tour) — usually the field's schema key. */
  'data-tour'?: string
  id?: string
  wide?: boolean
  className?: string
}) {
  const detail = description || hint || below

  return (
    // The control stays on the title line at every width. A narrow pane used
    // to drop it under the copy. `wide` is the exception: the action needs the
    // full row (theme grid, webhook copy) and sits under the label.
    <div className={cn('@container', className)} data-tour={dataTour} id={id}>
      <div
        className={cn(
          'grid gap-x-3 gap-y-1 py-3 max-md:gap-x-4 max-md:py-4',
          wide
            ? 'grid-cols-1'
            : 'grid-cols-[minmax(0,1fr)_auto] items-center @xl:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)]'
        )}
      >
        <div className={cn('min-w-0', !wide && 'col-start-1 row-start-1 self-center')}>
          <div className="text-[length:var(--conversation-text-font-size)] font-medium text-foreground">{title}</div>
        </div>
        {action && (
          <div
            className={cn(
              wide
                ? 'min-w-0'
                : 'col-start-2 row-start-1 shrink-0 justify-self-end self-center max-md:flex max-md:min-h-11 max-md:items-center @xl:row-span-2'
            )}
          >
            {action}
          </div>
        )}
        {detail && (
          <div className={cn(!wide && 'col-span-2 col-start-1 row-start-2 @xl:col-span-1')}>
            {description && (
              <div className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
                {description}
              </div>
            )}
            {hint && <div className="mt-1 block font-mono text-[0.68rem] text-muted-foreground/45">{hint}</div>}
            {below}
          </div>
        )}
      </div>
    </div>
  )
}

// A labelled on/off row — the canonical device-pref switch (haptic baked in).
export function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange
}: {
  checked: boolean
  description?: string
  disabled?: boolean
  label: string
  onChange: (on: boolean) => void
}) {
  return (
    <ListRow
      action={
        <Switch
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onCheckedChange={on => {
            triggerHaptic('selection')
            onChange(on)
          }}
        />
      }
      description={description}
      title={label}
    />
  )
}

// Skeleton primitives mirroring the settings layout rhythm — a loading page keeps
// its shape (like ModelSettings) instead of collapsing to a centered spinner.
export function SectionHeadingSkeleton({ variant = 'section' }: { variant?: 'group' | 'page' | 'section' }) {
  if (variant === 'page') {
    return (
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40 max-w-full" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
    )
  }

  return (
    <div className={cn('mb-2.5 flex items-center gap-2', variant === 'group' ? '' : 'pt-2')}>
      {variant === 'section' && <Skeleton className="size-4" />}
      <Skeleton className="h-4 w-36 max-w-full" />
    </div>
  )
}

export function ListRowSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="@container">
      <div
        className={cn(
          'grid gap-x-3 gap-y-1 py-3',
          wide
            ? 'grid-cols-1'
            : 'grid-cols-[minmax(0,1fr)_auto] items-center @xl:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)]'
        )}
      >
        <Skeleton className={cn('h-3.5 w-40 max-w-full', !wide && 'col-start-1 row-start-1')} />
        {!wide && <Skeleton className="col-start-2 row-start-1 h-8 w-24 justify-self-end @xl:row-span-2 @xl:w-72" />}
        <Skeleton className={cn('h-3 w-64 max-w-full', !wide && 'col-span-2 col-start-1 row-start-2 @xl:col-span-1')} />
      </div>
    </div>
  )
}

// A full settings page in its loading shape: an optional leading search field
// over one or more sections, each an optional heading above a run of rows.
// `<SettingsSkeleton search sections={[{ heading, rows }]} />`.
export function SettingsSkeleton({
  search = false,
  sections = [{ rows: 4 }]
}: {
  search?: boolean
  sections?: { heading?: boolean; rows: number }[]
}) {
  return (
    <SettingsContent>
      <SectionHeadingSkeleton variant="page" />
      {search && <Skeleton className="mb-3 h-8 w-full" />}
      {sections.map((section, i) => (
        <div key={i}>
          {section.heading && <SectionHeadingSkeleton variant="group" />}
          <SettingsGroup>
            {Array.from({ length: section.rows }, (_, r) => (
              <ListRowSkeleton key={r} />
            ))}
          </SettingsGroup>
        </div>
      ))}
    </SettingsContent>
  )
}

// Canonical implementation lives in components/ui; re-exported so the many
// settings call sites keep their import path.
export { EmptyState } from '@/components/ui/empty-state'
