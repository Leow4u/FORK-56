import { desktopFsCacheKey } from '@/lib/desktop-fs'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { $previewOwner, openPreview, previewOwnerKey } from '@/store/preview'
import { $reviewRepoRoot, reviewRepoCwd } from '@/store/review'

export function reviewAbsolutePath(relative: string): string {
  if (/^([a-zA-Z]:[\\/]|\/)/.test(relative)) {
    return relative
  }

  const cwd = ($reviewRepoRoot.get() || reviewRepoCwd())?.replace(/[\\/]+$/, '')

  return cwd ? `${cwd}/${relative}` : relative
}

/** Use the same preview resolver as Files, on the review's pinned workspace. */
export async function openReviewFile(path: string): Promise<void> {
  const cwd = reviewRepoCwd()
  const root = $reviewRepoRoot.get()
  const connection = desktopFsCacheKey()
  const owner = $previewOwner.get()
  const preview = await normalizeOrLocalPreviewTarget(reviewAbsolutePath(path))

  if (
    preview &&
    reviewRepoCwd() === cwd &&
    $reviewRepoRoot.get() === root &&
    desktopFsCacheKey() === connection &&
    previewOwnerKey($previewOwner.get()) === previewOwnerKey(owner)
  ) {
    openPreview(preview, 'file-browser', owner)
  }
}
