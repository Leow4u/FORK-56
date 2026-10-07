import { cva, type VariantProps } from 'class-variance-authority'

// Single source of truth for non-composer form-control chrome — Input,
// Textarea, and SelectTrigger all consume this. Mirrors `buttonVariants`:
// --control-radius (6px), 12px text, padding-driven sizing (no fixed heights). The visual
// chrome (background, border tint, hover, focus glow, invalid state) comes from
// the `desktop-input-chrome` CSS so every control shares one exact look.
export const controlVariants = cva(
  'desktop-input-chrome w-full min-w-0 border text-xs leading-4 text-foreground outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      // `pill` is the rounded field — the shape `SearchField`'s pill draws —
      // for a field that IS the bar it sits in (the Browser's address).
      shape: {
        default: 'rounded-(--control-radius)',
        pill: 'rounded-full'
      },
      size: {
        xs: 'px-2 py-0.5 text-[0.6875rem] leading-4',
        sm: 'px-2 py-1',
        default: 'px-2.5 py-1.5',
        lg: 'px-3 py-2 text-sm leading-5'
      }
    },
    defaultVariants: {
      shape: 'default',
      size: 'default'
    }
  }
)

export type ControlVariantProps = VariantProps<typeof controlVariants>
