import { cn } from '@/lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// Brand glyph: work4you-icon.png is RGBA-transparent. Never put a tile behind
// it — transparent holes in the mark must show the surrounding surface (cream
// boot overlay, paper onboarding, ink About), not a white square.
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex size-14 shrink-0 items-center justify-center bg-transparent', className)}
      {...props}
    >
      <img alt="" className="size-full bg-transparent object-contain" src={assetPath('work4you-icon.png')} />
    </span>
  )
}
