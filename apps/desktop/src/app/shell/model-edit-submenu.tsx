import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  dropdownMenuRow,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { isReasoningEffort, isThinkingEnabled, REASONING_EFFORTS, resolveReasoningEffort } from '@/lib/reasoning-effort'

// Work4You' real reasoning levels live in lib/reasoning-effort; `none` is owned
// by the Thinking toggle, not the radio.

/** How "fast" is achieved for a given model — two different mechanisms:
 *  - `param`: the Anthropic/OpenAI `speed=fast` request parameter.
 *  - `variant`: a separate `…-fast` sibling model selected via the model field.
 */
export type FastControl =
  { kind: 'none' } | { kind: 'param'; on: boolean } | { kind: 'variant'; baseId: string; fastId: string; on: boolean }

/** Resolve the fast mechanism for a model: prefer the speed=fast parameter
 *  when the backend supports it, else fall back to a `…-fast` sibling model. */
export function resolveFastControl(
  model: string,
  providerModels: readonly string[],
  paramSupported: boolean,
  currentFastMode: boolean
): FastControl {
  if (paramSupported) {
    return { kind: 'param', on: currentFastMode }
  }

  if (/-fast$/i.test(model)) {
    const baseId = model.replace(/-fast$/i, '')

    // Only a toggle if there's a base to switch back to; otherwise it's a
    // standalone fast model with no "off" state.
    return providerModels.includes(baseId) ? { kind: 'variant', baseId, fastId: model, on: true } : { kind: 'none' }
  }

  const fastId = `${model}-fast`

  if (providerModels.includes(fastId)) {
    return { kind: 'variant', baseId: model, fastId, on: false }
  }

  // Fast isn't natively offered here, but if the session still has the speed
  // param on (carried over from a previous model), expose the toggle so it can
  // be turned off rather than stranded.
  if (currentFastMode) {
    return { kind: 'param', on: true }
  }

  return { kind: 'none' }
}

interface ActiveModelOptionsProps {
  /** The profile's configured default effort — what an unset row inherits.
   *  Passed in (not read from a store) so this panel stays pure. */
  defaultEffort: string
  /** The active model's effective reasoning effort. */
  effort: string
  /** How fast mode is offered for this model (param toggle vs. variant swap). */
  fastControl: FastControl
  /** Switch to a specific model id (used to swap base ⇄ -fast variant). */
  onSelectModel: (model: string) => Promise<boolean | void> | void
  /** Report an option change. This panel is PURE: it never writes to a
   *  session, a preset store, or the gateway itself — the owning surface's
   *  controller decides what an edit means. */
  onSetOptions: (patch: { effort?: string; fast?: boolean }) => void
  /** Whether this model supports reasoning effort. */
  reasoning: boolean
}

/** Session options for the active model: Thinking / Fast on the menu root,
 *  Effort as a nested submenu. Same gates and writes as the old per-row
 *  Options panel — only the placement changed. */
export function ActiveModelOptions({
  defaultEffort,
  effort,
  fastControl,
  onSelectModel,
  onSetOptions,
  reasoning
}: ActiveModelOptionsProps) {
  const { t } = useI18n()
  const copy = t.shell.modelOptions

  const effortValue = resolveReasoningEffort(effort, defaultEffort)
  const thinkingOn = isThinkingEnabled(effort, defaultEffort)

  const setFast = (enabled: boolean) => {
    if (fastControl.kind === 'variant') {
      onSetOptions({ fast: enabled })
      void onSelectModel(enabled ? fastControl.fastId : fastControl.baseId)

      return
    }

    if (fastControl.kind === 'param') {
      onSetOptions({ fast: enabled })
    }
  }

  const hasFast = fastControl.kind !== 'none'
  const fastOn = fastControl.kind === 'none' ? false : fastControl.on

  if (!hasFast && !reasoning) {
    return null
  }

  return (
    <>
      {reasoning ? (
        <DropdownMenuItem className={dropdownMenuRow} onSelect={event => event.preventDefault()}>
          {copy.thinking}
          <Switch
            checked={thinkingOn}
            className="ml-auto"
            onCheckedChange={checked => onSetOptions({ effort: checked ? effortValue || defaultEffort : 'none' })}
            size="xs"
          />
        </DropdownMenuItem>
      ) : null}
      {hasFast ? (
        <DropdownMenuItem className={dropdownMenuRow} onSelect={event => event.preventDefault()}>
          {copy.fast}
          <Switch checked={fastOn} className="ml-auto" onCheckedChange={setFast} size="xs" />
        </DropdownMenuItem>
      ) : null}
      {reasoning && thinkingOn ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={dropdownMenuRow}>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span>{copy.effort}</span>
              <span className="truncate text-(--ui-text-tertiary)">
                {isReasoningEffort(effortValue) ? copy[effortValue] : null}
              </span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52 p-0" sideOffset={4}>
            <DropdownMenuRadioGroup onValueChange={value => onSetOptions({ effort: value })} value={effortValue}>
              {REASONING_EFFORTS.map(value => (
                <DropdownMenuRadioItem
                  className={dropdownMenuRow}
                  key={value}
                  onSelect={event => event.preventDefault()}
                  value={value}
                >
                  {copy[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
    </>
  )
}
