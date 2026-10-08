import { cleanPath, comparisonPath, isUnderPath } from '@/lib/path-compare'

import { readProjectDir } from './ipc'
import type { TreeNode } from './use-project-tree'

/** Read the same visible filesystem as the browser, including collapsed folders.
 * Bounded, cancellable traversal: a large workspace or a directory-link cycle
 * must not keep issuing IPC calls after the user clears the filter. */
export async function readFilterTree(cwd: string, signal: AbortSignal) {
  const data: TreeNode[] = []
  const pending = [{ path: cwd, children: data }]
  const visited = new Set<string>()
  let partial = false
  let count = 0

  while (pending.length && !signal.aborted) {
    if (visited.size >= 1000 || count >= 20000) {
      partial = true

      break
    }

    const dir = pending.shift()!
    const key = comparisonPath(cleanPath(dir.path))

    if (visited.has(key)) {
      continue
    }

    visited.add(key)

    try {
      const result = await readProjectDir(dir.path, cwd)

      if (signal.aborted) {
        break
      }

      if (result.error) {
        partial = true
      }

      for (const entry of result.entries) {
        if (comparisonPath(cleanPath(entry.path)) === key) {
          continue
        }

        if (++count > 20000) {
          partial = true

          break
        }

        const node: TreeNode = {
          id: entry.path,
          name: entry.name,
          isDirectory: entry.isDirectory,
          ...(entry.isDirectory ? { children: [] } : {})
        }

        dir.children.push(node)

        if (node.children) {
          pending.push({ path: entry.path, children: node.children })
        }
      }
    } catch {
      partial = true
    }
  }

  return { data, partial }
}

/** Location only; outside-workspace files keep their full path. */
export function fileBreadcrumb(cwd: string, path?: string): string[] {
  if (!cwd && !path) {
    return []
  }

  const root = cleanPath(cwd || '/')
  const file = path ? cleanPath(path) : root
  const rootName = root.split('/').filter(Boolean).at(-1) || '/'

  if (!path) {
    return [rootName]
  }

  if (cwd && (isUnderPath(root, file) || (root === '/' && file.startsWith('/') && !file.startsWith('//')))) {
    return [
      rootName,
      ...file
        .slice(root === '/' ? 1 : root.length + 1)
        .split('/')
        .filter(Boolean)
    ]
  }

  return file.split('/').filter(Boolean)
}

export function hasTreeMatch(nodes: readonly TreeNode[], query: string): boolean {
  const term = query.toLowerCase()

  return nodes.some(
    node => node.name.toLowerCase().includes(term) || (node.children && hasTreeMatch(node.children, term))
  )
}

export function findTreeNode(nodes: readonly TreeNode[], path: string): TreeNode | undefined {
  const key = comparisonPath(cleanPath(path))

  for (const node of nodes) {
    if (comparisonPath(cleanPath(node.id)) === key) {
      return node
    }

    const child = node.children && findTreeNode(node.children, path)

    if (child) {
      return child
    }
  }
}
