import { pathLeaf } from '@/lib/display-path'
import { projectNameForCwd } from '@/store/projects'

/** Compact composer-chip label: named project, else cwd leaf, else Home. */
export function workspaceChipLabel(cwd: string | null | undefined, homeLabel: string): string {
  const path = (cwd ?? '').trim()

  if (!path) {
    return homeLabel
  }

  return projectNameForCwd(path) || pathLeaf(path) || homeLabel
}
