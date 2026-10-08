import { map } from 'nanostores'

interface FileViewState {
  treeOpen: boolean
  query: string
}

// The empty Files tab and its file tabs share a view, scoped by connection,
// conversation and cwd. Selecting a file must not clear its filter or reopen
// a tree the user hid. This is window-local presentation, not a disk setting.
export const $fileViews = map<Record<string, FileViewState>>({})
export const DEFAULT_FILE_VIEW: FileViewState = { treeOpen: true, query: '' }

export function updateFileView(scope: string, patch: Partial<FileViewState>) {
  $fileViews.setKey(scope, { ...($fileViews.get()[scope] ?? DEFAULT_FILE_VIEW), ...patch })
}
