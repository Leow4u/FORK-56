import { MODEL_BRAND_PATHS, type ModelBrand } from './model-brand-paths'

export function ModelBrandLogo({ brand }: { brand: ModelBrand }) {
  return (
    <svg aria-hidden className="size-[18px]" fill="currentColor" viewBox="0 0 24 24">
      {MODEL_BRAND_PATHS[brand].map((d, index) => (
        <path d={d} key={index} />
      ))}
    </svg>
  )
}
