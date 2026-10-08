import { cn } from '@/lib/utils'

import { Button } from './button'
import { Codicon } from './codicon'

interface ColorSwatchesProps {
  swatches: readonly string[]
  value: null | string
  onChange: (color: null | string) => void
  clearLabel: string
  clearIcon?: string
  swatchLabel?: (color: string) => string
  presentation?: 'compact' | 'palette'
  label?: string
}

// Shared swatch grid + clear row used by the profile rail and the project
// dialog, so color picking looks and behaves identically everywhere.
export function ColorSwatches({
  swatches,
  value,
  onChange,
  clearLabel,
  clearIcon = 'circle-slash',
  swatchLabel,
  presentation = 'compact',
  label
}: ColorSwatchesProps) {
  const palette = presentation === 'palette'

  return (
    <div aria-label={label} className={palette ? 'grid w-52 max-w-full gap-1' : undefined} role="group">
      {palette && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-(--ui-text-secondary)">{label}</span>
          <Button
            aria-pressed={value === null}
            onClick={() => onChange(null)}
            size="xs"
            type="button"
            variant={value === null ? 'secondary' : 'ghost'}
          >
            <Codicon name={value === null ? 'check' : 'sparkle'} />
            {clearLabel}
          </Button>
        </div>
      )}
      <div className={palette ? 'grid grid-cols-5 justify-items-center gap-1' : 'grid grid-cols-6 gap-1.5'}>
        {swatches.map(swatch => (
          <button
            aria-label={swatchLabel?.(swatch) ?? swatch}
            aria-pressed={swatch === value}
            className={cn(
              palette
                ? 'relative grid size-8 cursor-pointer place-items-center rounded-full transition-colors hover:bg-(--chrome-action-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-text-primary)'
                : 'size-5 rounded-full transition-transform hover:scale-110',
              palette && swatch === value && 'ring-1 ring-(--ui-text-primary)'
            )}
            key={swatch}
            onClick={() => onChange(swatch)}
            style={
              palette
                ? undefined
                : {
                    backgroundColor: swatch,
                    boxShadow:
                      swatch === value ? '0 0 0 2px var(--ui-bg-elevated), 0 0 0 3.5px currentColor' : undefined,
                    color: swatch
                  }
            }
            type="button"
          >
            {palette && (
              <>
                <span aria-hidden className="size-6 rounded-full" style={{ backgroundColor: swatch }} />
                {swatch === value && (
                  <span
                    aria-hidden
                    className="absolute right-0 bottom-0 grid size-3.5 place-items-center rounded-full bg-(--ui-bg-elevated) text-(--ui-text-primary)"
                  >
                    <Codicon name="check" size="0.625rem" />
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>
      {!palette && (
        <button
          aria-pressed={value === null}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-xs text-(--ui-text-tertiary) transition hover:bg-(--ui-control-hover-background) hover:text-foreground"
          onClick={() => onChange(null)}
          type="button"
        >
          <Codicon name={clearIcon} size="0.75rem" />
          {clearLabel}
        </button>
      )}
    </div>
  )
}
