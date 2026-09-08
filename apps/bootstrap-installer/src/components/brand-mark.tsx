import { cn } from '../lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// Brand mark: the work4you-icon PNG is RGBA-transparent. No tile behind it —
// transparent holes show the paper/ink canvas. Asset lives in public/.
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
