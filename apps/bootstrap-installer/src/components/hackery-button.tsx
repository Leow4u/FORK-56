import { cn } from '../lib/utils'
import { Loader } from './loader'

/*
 * HackeryButton — the onboarding "Begin" CTA, ported standalone.
 *
 * Bracketed [ LABEL ], mono/uppercase, primary accent on a --stroke-work4you hairline.
 * Lifted from apps/desktop's desktop-onboarding-overlay.tsx (sans the exit-scramble
 * choreography, which is overlay-specific). Uses the installer Loader for
 * the in-button waiting state.
 */
export function HackeryButton({
  className,
  label,
  loading,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & { label: React.ReactNode; loading?: boolean }) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={cn(
        'group inline-flex cursor-pointer items-center gap-2 rounded-md border border-(--stroke-work4you) px-6 py-2.5',
        'font-mono text-xs font-semibold uppercase text-primary',
        'transition-all duration-150 hover:border-primary/60 hover:bg-primary/[0.06]',
        'outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      type="button"
    >
      <span className="text-primary/40 transition-colors group-hover:text-primary">[</span>
      {loading ? <Loader className="size-4" /> : null}
      <span className="-mr-[0.25em] pl-[0.25em] tracking-[0.25em]">{label}</span>
      <span className="text-primary/40 transition-colors group-hover:text-primary">]</span>
    </button>
  )
}
