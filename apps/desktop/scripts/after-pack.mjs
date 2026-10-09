/**
 * after-pack.mjs — electron-builder afterPack hook.
 *
 * Stamps the Work4You icon + identity onto the packed Windows Work4You.exe via
 * rcedit (delegated to set-exe-identity.mjs). This runs for EVERY packed build
 * — first install, `work4you desktop`, the installer's --update rebuild, and a
 * dev's manual `npm run pack` — so the branded exe can never silently revert
 * to the stock "Electron" icon/name (the bug when the stamp lived only in
 * install.ps1, which the update path doesn't use).
 *
 * Windows-only: configure the verified extractor when building NSIS, then stamp
 * the executable for every target. NSIS version/template/helper hash drift must
 * stop the build, because the stock plugin can silently omit packaged files.
 * Identity stamping remains best-effort; only its cosmetic failures are caught.
 * macOS/Linux identity comes from the bundle Info.plist / desktop entry.
 *
 * electron-builder passes a context with:
 *   - electronPlatformName: 'win32' | 'darwin' | 'linux'
 *   - appOutDir:            the unpacked app directory for this target
 *   - targets:              Target objects, each with a name such as 'nsis'
 *   - packager.appInfo.productFilename: the exe basename (e.g. 'Work4You')
 */

import path from 'node:path'

import { applyNsisDirectExtractionPatch } from '../../../scripts/ci/patch-nsis-direct-extraction.mjs'

import { stampExeIdentity } from './set-exe-identity.mjs'

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return
  }

  if (context.targets.some(target => target.name === 'nsis')) {
    // afterPack runs before NSIS generates/signs the uninstaller and installer.
    // Keep this outside the cosmetic catch: packaging must fail on extractor drift.
    const extraction = await applyNsisDirectExtractionPatch()
    console.log(`[after-pack] verified direct NSIS extraction: template=${extraction.patchedSha256} helper=${extraction.sevenZip.sha256}`)
  }

  const productName = context.packager?.appInfo?.productFilename || 'Work4You'
  const exe = path.join(context.appOutDir, `${productName}.exe`)
  const desktopRoot = path.resolve(import.meta.dirname, '..')

  try {
    await stampExeIdentity(exe, desktopRoot)
  } catch (err) {
    // Never fail the build over a cosmetic stamp.
    console.warn(`[after-pack] exe identity stamp failed (${err.message}); Work4You.exe keeps the stock Electron icon`)
  }
}
