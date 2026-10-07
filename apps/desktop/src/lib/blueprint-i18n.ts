import type { BlueprintCatalogTranslations } from '@/i18n/types'
import type { AutomationBlueprint, AutomationBlueprintField } from '@/work4you'

function fieldCopyFor(
  blueprintKey: string,
  fieldName: string,
  catalog: BlueprintCatalogTranslations | undefined
) {
  const item = catalog?.items?.[blueprintKey]

  return item?.fields?.[fieldName] ?? catalog?.sharedFields?.[fieldName]
}

function localizedField(
  blueprintKey: string,
  field: AutomationBlueprintField,
  catalog: BlueprintCatalogTranslations | undefined
): AutomationBlueprintField {
  const copy = fieldCopyFor(blueprintKey, field.name, catalog)

  if (!copy) {
    return field
  }

  return {
    ...field,
    default: copy.default ?? field.default,
    help: copy.help ?? field.help,
    label: copy.label ?? field.label
  }
}

/** Overlay locale-specific copy on a backend blueprint catalog entry. */
export function localizeAutomationBlueprint(
  blueprint: AutomationBlueprint,
  catalog: BlueprintCatalogTranslations | undefined
): AutomationBlueprint {
  if (!catalog) {
    return blueprint
  }

  const item = catalog.items?.[blueprint.key]

  return {
    ...blueprint,
    description: item?.description ?? blueprint.description,
    fields: blueprint.fields.map(field => localizedField(blueprint.key, field, catalog)),
    title: item?.title ?? blueprint.title
  }
}

export function localizeAutomationBlueprints(
  blueprints: AutomationBlueprint[],
  catalog: BlueprintCatalogTranslations | undefined
): AutomationBlueprint[] {
  return blueprints.map(blueprint => localizeAutomationBlueprint(blueprint, catalog))
}

/** Human-readable label for a slot option while keeping the stored value unchanged. */
export function blueprintOptionLabel(
  blueprintKey: string,
  field: AutomationBlueprintField,
  option: string,
  catalog: BlueprintCatalogTranslations | undefined
): string {
  const copy = fieldCopyFor(blueprintKey, field.name, catalog)

  if (copy?.options?.[option]) {
    return copy.options[option]
  }

  if (field.type === 'weekdays' || field.name === 'recurrence') {
    return catalog?.weekdayOptions?.[option] ?? option
  }

  if (field.name === 'day') {
    return catalog?.dayOptions?.[option] ?? option
  }

  return option
}
