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

/** Empty-chat Select workspace chip: the entered project, else a named project, else the CTA. Never a cwd leaf. */
export function emptyWorkspaceChipLabel(
  cwd: string | null | undefined,
  selectLabel: string,
  scopedLabel?: null | string
): string {
  const scoped = scopedLabel?.trim()

  if (scoped) {
    return scoped
  }

  const path = (cwd ?? '').trim()

  if (!path) {
    return selectLabel
  }

  return projectNameForCwd(path) || selectLabel
}
