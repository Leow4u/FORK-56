import { cn } from '@/lib/utils'

import { MODEL_BRAND_PATHS, type ModelBrand } from './model-brand-paths'

export function ModelBrandLogo({ brand, className }: { brand: ModelBrand; className?: string }) {
  return (
    <svg aria-hidden className={cn('size-[18px]', className)} fill="currentColor" viewBox="0 0 24 24">
      {MODEL_BRAND_PATHS[brand].map((d, index) => (
        <path d={d} key={index} />
      ))}
    </svg>
  )
}
