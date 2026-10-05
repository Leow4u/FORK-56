import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import type { CapabilitiesView } from './store'

export interface CapabilitiesCategory {
  id: string
  label: string
  /** Items in this category; shown beside the label when known. */
  count?: number
}

export interface CapabilitiesAddItem {
  disabled?: boolean
  label: string
  onSelect: () => void
}

/**
 * The one toolbar every Capabilities tab (Skills, MCP, Plugins) renders under
 * the page header, in the same shape: the "mine | discover" switch, the
 * category filter, the tab's own filter (sort, …), then at the right one
 * "Add" menu holding the tab's creation entries and the tab's overflow menu.
 *
 * Presentational: each tab owns its state (`app/skills/store.ts` atoms) and
 * its actions, and passes them in — nothing here reaches into a tab.
 */
export function CapabilitiesToolbar({
  addItems = [],
  categories,
  category = 'all',
  className,
  filters,
  menu,
  mineLabel,
  onCategoryChange,
  onViewChange,
  view,
  viewsHidden = false
}: {
  addItems?: readonly CapabilitiesAddItem[]
  /** Category filter options; omit to hide the filter. */
  categories?: readonly CapabilitiesCategory[]
  category?: string
  className?: string
  /** Tab-specific controls placed after the category filter (sort, …). */
  filters?: ReactNode
  /** The tab's overflow menu (a `ListStripMenu`), placed after Add. */
  menu?: ReactNode
  /** Label of the "mine" segment: Installed, Connected, … */
  mineLabel: string
  onCategoryChange?: (category: string) => void
  onViewChange: (view: CapabilitiesView) => void
  view: CapabilitiesView
  /** Hides the view switch and the category filter (e.g. inside a detail pane). */
  viewsHidden?: boolean
}) {
  const { t } = useI18n()

  return (
    <div className={cn('flex min-h-8 flex-wrap items-center gap-2', className)} data-slot="capabilities-toolbar">
      {!viewsHidden && (
        <SegmentedControl<CapabilitiesView>
          onChange={onViewChange}
          options={[
            { id: 'mine', label: mineLabel },
            { id: 'discover', label: t.skills.viewDiscover }
          ]}
          value={view}
        />
      )}
      {!viewsHidden && categories && onCategoryChange && (
        <Select onValueChange={onCategoryChange} value={category}>
          <SelectTrigger aria-label={t.skills.categoryFilter} className="h-7 max-w-56 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.skills.allCategories}</SelectItem>
            {categories.map(entry => (
              <SelectItem key={entry.id} value={entry.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{entry.label}</span>
                  {typeof entry.count === 'number' && (
                    <span className="text-[0.72em] text-(--ui-text-tertiary) tabular-nums">{entry.count}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!viewsHidden && filters}
      <span className="flex-1" />
      {addItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" type="button">
              <Codicon name="add" size="0.8rem" />
              {t.common.add}
              <Codicon className="opacity-60" name="chevron-down" size="0.8rem" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" sideOffset={6}>
            {addItems.map(item => (
              <DropdownMenuItem disabled={item.disabled} key={item.label} onSelect={item.onSelect}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {menu}
    </div>
  )
}
