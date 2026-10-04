import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { Check, RefreshCw } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $gatewayRestarting, runGatewayRestart } from '@/store/system-actions'
import { getActionStatus, restartGateway } from '@/work4you'

/** The shared pieces of a channel's first connection: one question per screen
 *  inside the channel page, a numbered stepper above it, Back / Next below,
 *  and a ready screen that reports what actually happened. */

export const STEP_NOTE = 'text-xs leading-4 text-(--ui-text-tertiary)'

export interface StepEntry<T extends string> {
  id: T
  label: string
}

/** The numbered stepper: done steps get a green check, the current one is
 *  framed, the rest stay quiet. */
export function StepList<T extends string>({ current, steps }: { current: T; steps: StepEntry<T>[] }) {
  const currentIndex = steps.findIndex(entry => entry.id === current)

  return (
    <ol className="flex gap-1.5">
      {steps.map((entry, index) => {
        const state = entry.id === current ? 'active' : index < currentIndex ? 'done' : 'todo'

        return (
          <li
            aria-current={state === 'active' ? 'step' : undefined}
            className={cn(
              'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 text-xs',
              state === 'active'
                ? 'border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-foreground'
                : 'border-transparent',
              state === 'done' && 'text-(--ui-text-secondary)',
              state === 'todo' && 'text-(--ui-text-tertiary)'
            )}
            key={entry.id}
          >
            <span
              className={cn(
                'grid size-[1.125rem] shrink-0 place-items-center rounded-full text-[0.66rem] font-semibold tabular-nums',
                state === 'active' && 'bg-primary text-primary-foreground',
                state === 'done' && 'bg-emerald-500 text-background',
                state === 'todo' && 'bg-(--ui-bg-quaternary) text-(--ui-text-tertiary)'
              )}
            >
              {state === 'done' ? <Check className="size-[0.6875rem]" /> : index + 1}
            </span>
            <span className="truncate">{entry.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** The stepper and the bordered panel the current step renders into. */
export function StepsFrame<T extends string>({
  children,
  current,
  slot,
  steps
}: {
  children: ReactNode
  current: T
  slot: string
  steps: StepEntry<T>[]
}) {
  return (
    <section className="pt-1.5" data-slot={slot}>
      <StepList current={current} steps={steps} />
      <div className="mt-4 rounded-xl border border-(--ui-stroke-quaternary) px-6 py-[1.375rem]">{children}</div>
    </section>
  )
}

export function StepPanel({ children, note, title }: { children: ReactNode; note: ReactNode; title: string }) {
  return (
    <div>
      <h2 className="text-[1.0625rem] font-semibold text-foreground">{title}</h2>
      <p className={cn('mt-1', STEP_NOTE)}>{note}</p>
      {children}
    </div>
  )
}

/** `text` cut around the last occurrence of `part`, so one word of a
 *  translated sentence can be bold or a link; null when the translation does
 *  not contain it. */
export function splitAround(text: string, part: string): [string, string, string] | null {
  const at = part ? text.lastIndexOf(part) : -1

  return at === -1 ? null : [text.slice(0, at), part, text.slice(at + part.length)]
}

/** A sentence with one of its words in bold, as the boards set button names
 *  and the person's choice. */
export function Emphasized({ className, part, text }: { className?: string; part: string; text: string }) {
  const pieces = splitAround(text, part)

  if (!pieces) {
    return <>{text}</>
  }

  return (
    <>
      {pieces[0]}
      <b className={cn('font-medium', className ?? 'text-foreground')}>{pieces[1]}</b>
      {pieces[2]}
    </>
  )
}

interface StepFieldProps extends ComponentProps<typeof Input> {
  help?: ReactNode
  label: string
}

/** A labeled input of a step, as the boards draw it: the label, the input
 *  (monospace: ids, tokens, numbers) and the help line under it. */
export function StepField({ className, help, label, ...input }: StepFieldProps) {
  const id = useId()

  return (
    <div className="mt-3.5 flex flex-col gap-1.5">
      <label className="text-[0.78125rem] font-medium text-(--ui-text-secondary)" htmlFor={id}>
        {label}
      </label>
      <Input className={cn('h-8 max-w-[35rem] font-mono text-[0.78rem]', className)} id={id} {...input} />
      {help ? <span className={cn('max-w-[38.75rem]', STEP_NOTE)}>{help}</span> : null}
    </div>
  )
}

export function StepFooter({
  back,
  middle,
  next
}: {
  back?: { label: string; onClick: () => void }
  /** Extra buttons right before Next (a secondary action of the step). */
  middle?: ReactNode
  next: { disabled?: boolean; label: string; onClick: () => void }
}) {
  return (
    <div className="mt-5 flex items-center gap-2">
      {back && (
        <Button onClick={back.onClick} size="sm" variant="outline">
          {back.label}
        </Button>
      )}
      <span className="flex-1" />
      {middle}
      <Button disabled={next.disabled} onClick={next.onClick} size="sm">
        {next.label}
      </Button>
    </div>
  )
}

export interface ChoiceOption<T extends string> {
  description: string
  /** Shown inside the option while it is selected (an input, a hint). Kept
   *  outside the option's button so the control stays its own element. */
  extra?: ReactNode
  id: T
  title: string
}

/** One question's answers as bordered cards with a radio, like the setup
 *  boards: every option outlined, the chosen one filled. */
export function ChoiceList<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string
  onChange: (id: T) => void
  options: ChoiceOption<T>[]
  value: null | T
}) {
  return (
    <div aria-label={label} className="mt-4 flex flex-col gap-2" role="radiogroup">
      {options.map(option => {
        const selected = option.id === value

        return (
          <div
            className={cn(
              'rounded-[0.625rem] border px-3.5 py-3',
              selected
                ? 'border-(--ui-text-tertiary) bg-(--ui-bg-quinary)'
                : 'border-(--ui-stroke-quaternary) hover:bg-(--ui-sidebar-surface-background)'
            )}
            key={option.id}
          >
            <button
              aria-checked={selected}
              className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 text-left"
              onClick={() => onChange(option.id)}
              role="radio"
              type="button"
            >
              <span
                aria-hidden
                className={cn(
                  'relative mt-px size-4 rounded-full border-[1.5px]',
                  selected ? 'border-primary' : 'border-(--ui-text-tertiary)'
                )}
              >
                {selected && <span className="absolute inset-[2.5px] rounded-full bg-primary" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.84375rem] font-medium text-foreground">{option.title}</span>
                <span className={cn('mt-0.5 block', STEP_NOTE)}>{option.description}</span>
              </span>
            </button>
            {selected && option.extra ? <div className="pl-7">{option.extra}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

/** A line of the ready screen: a green check when done, a red dot when it
 *  failed, a spinner while it is still happening. */
export function ReadyLine({
  children,
  done,
  failed = false
}: {
  children: ReactNode
  done: boolean
  failed?: boolean
}) {
  return (
    <li className="flex items-center gap-2">
      {failed ? (
        <span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-destructive" />
      ) : done ? (
        <Check className="size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Codicon name="loading" size="0.8rem" spinning />
      )}
      <span className="flex flex-wrap items-center">{children}</span>
    </li>
  )
}

/** The ready screen: a big check (a spinner while saving), the title, what
 *  happened line by line, a "try it" note and the footer buttons. */
export function ReadyView({
  busy,
  children,
  footer,
  note,
  title
}: {
  busy: boolean
  children: ReactNode
  footer: ReactNode
  note?: ReactNode
  title: string
}) {
  return (
    <div className="flex flex-col items-start">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-emerald-500 text-background">
        {busy ? <Codicon name="loading" size="1.1rem" spinning /> : <Check className="size-5" />}
      </span>
      <h2 className="text-[1.0625rem] font-semibold text-foreground">{title}</h2>
      <ul className="mt-3 grid gap-1.5 text-[0.8125rem] text-(--ui-text-secondary)">{children}</ul>
      {note ? <p className={cn('mt-3.5', STEP_NOTE)}>{note}</p> : null}
      <div className="mt-5 flex w-full items-center justify-end gap-2">{footer}</div>
    </div>
  )
}

export interface RestartState {
  detail?: string
  exitCode?: number
  /** `none`: the save went through but no restart was spawned. */
  outcome: 'failed' | 'none' | 'ok' | 'pending'
}

/** `restart_started` only means the restart child spawned — not that it will
 *  succeed. Watch the action status briefly and surface a non-zero exit; in
 *  no-service installs the child becomes the foreground gateway and never
 *  exits, so "still running when we stop watching" counts as success. */
export async function watchRestartOutcome(scopeProfile: null | string): Promise<RestartState> {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500))

    try {
      const status = await getActionStatus('gateway-restart', 5, scopeProfile ?? undefined)

      if (status.running) {
        continue
      }

      if (status.exit_code !== 0 && status.exit_code !== null) {
        return { exitCode: status.exit_code, outcome: 'failed' }
      }

      return { outcome: 'ok' }
    } catch {
      // transient fetch error; keep polling
    }
  }

  return { outcome: 'ok' }
}

/** The restart after a save made through the plain channel update (no
 *  onboarding call to spawn it): ask for one and watch it the same way. */
export async function restartAndWatch(): Promise<RestartState> {
  $gatewayRestarting.set(true)

  try {
    await restartGateway()
  } catch (error) {
    $gatewayRestarting.set(false)

    return { detail: error instanceof Error ? error.message : String(error), outcome: 'none' }
  }

  try {
    return await watchRestartOutcome(null)
  } finally {
    $gatewayRestarting.set(false)
  }
}

/** The ready screen's restart line, with the manual restart one click away
 *  when the automatic one failed or never started. */
export function RestartLine({ restart }: { restart: RestartState }) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.channelSteps

  return (
    <ReadyLine done={restart.outcome === 'ok'} failed={restart.outcome !== 'ok' && restart.outcome !== 'pending'}>
      {restart.outcome === 'ok'
        ? s.checkRestarted
        : restart.outcome === 'pending'
          ? s.checkRestarting
          : restart.outcome === 'failed'
            ? s.checkRestartFailed(restart.exitCode ?? 1)
            : s.checkRestartNotStarted(restart.detail ? `: ${restart.detail}` : '')}
      {(restart.outcome === 'failed' || restart.outcome === 'none') && (
        <Button className="ml-2" onClick={() => void runGatewayRestart()} size="xs" variant="secondary">
          <RefreshCw />
          {m.restartGateway}
        </Button>
      )}
    </ReadyLine>
  )
}
