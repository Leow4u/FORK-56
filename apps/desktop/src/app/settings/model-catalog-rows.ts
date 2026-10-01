import { displayModelName } from '@/lib/model-status-label'
import { normalize } from '@/lib/text'
import { collapseModelFamilies, type ModelFamily, modelVisibilityKey } from '@/store/model-visibility'
import type { ModelOptionProvider } from '@/types/work4you'

export interface CatalogModelRow {
  family: ModelFamily
  provider: ModelOptionProvider
}

/** Rows for Settings → Model.
 *
 *  The closed list is each provider's featured shortlist, plus any model the
 *  person has switched on. A provider with no featured list shows its whole
 *  catalog. Search and "View all models" walk every family. MoA presets stay
 *  out of this list.
 */
export function settingsCatalogRows(
  providers: readonly ModelOptionProvider[],
  visible: ReadonlySet<string>,
  options: { query: string; showAll: boolean }
): { hasMore: boolean; rows: CatalogModelRow[] } {
  const query = normalize(options.query)
  const rows: CatalogModelRow[] = []
  let hasMore = false

  const ordered = providers
    .filter(provider => provider.slug.toLowerCase() !== 'moa' && (provider.models?.length ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const provider of ordered) {
    const families = collapseModelFamilies(provider.models ?? [])
    const featured = new Set(provider.featured_models ?? [])

    for (const family of families) {
      const haystack =
        `${family.id} ${family.fastId ?? ''} ${provider.name} ${provider.slug} ${displayModelName(family.id)}`.toLowerCase()

      if (query) {
        if (haystack.includes(query)) {
          rows.push({ family, provider })
        }

        continue
      }

      const enabled = visible.has(modelVisibilityKey(provider.slug, family.id))
      const inPreview = featured.size > 0 ? featured.has(family.id) || enabled : true

      if (options.showAll || inPreview) {
        rows.push({ family, provider })
      } else {
        hasMore = true
      }
    }
  }

  return { hasMore, rows }
}
