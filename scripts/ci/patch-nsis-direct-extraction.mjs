/** Experimental direct 7z extraction; the stock NSIS installer remains in charge. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const BUILDER_VERSION = '26.15.3'
const ORIGINAL_SHA256 = 'e4174388a0f7a1df0b85a0742aa1ea7a4b2b18f9f29dccd6ef10a66212f68148'
// electron-builder's checksummed 7zip@1.0.0/7zip-win-x64.tar.gz.
// Its standalone 24.09 executable is x86 and runs on supported x64 Windows.
// Preserve the official redistribution notices alongside the embedded helper.
const SEVEN_ZIP = Object.freeze({
  release: '7zip@1.0.0',
  url: 'https://github.com/electron-userland/electron-builder-binaries/releases/download/7zip%401.0.0/7zip-win-x64.tar.gz',
  archiveSha256: 'be071f15bd6da2f78fe81c6ddef2009b0c4d8a51f36b780cb806c7e6df95e1b3',
  sha256: '223b873c50380fe9a39f1a22b6abf8d46db506e1c08d08312902f6f3cd1f7ac3',
  licenseSha256: '7b7022cccdee7bddd07f5fd847161e33551cec411e9c9967c14008ee36d5ce3f',
  copyingSha256: '1e7e6bae5a5bde32f1ae5a7c37a082d1ab03cf89354f7f936ac40be9e39a6531',
})
const ORIGINAL_MACRO = `!macro extractUsing7za FILE
  Push $OUTDIR
  CreateDirectory "$PLUGINSDIR\\7z-out"
  ClearErrors
  SetOutPath "$PLUGINSDIR\\7z-out"
  Nsis7z::Extract "\${FILE}"
  Pop $R0
  SetOutPath $R0

  # Retry counter
  StrCpy $R1 0

  LoopExtract7za:
    IntOp $R1 $R1 + 1

    # Attempt to copy files in atomic way
    CopyFiles /SILENT "$PLUGINSDIR\\7z-out\\*" $OUTDIR
    IfErrors 0 DoneExtract7za

    DetailPrint \`Can't modify "\${PRODUCT_NAME}"'s files.\`
    \${if} $R1 < 5
      # Try copying a few times before asking for a user action.
      Goto RetryExtract7za
    \${else}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDRETRY IDCANCEL AbortExtract7za
    \${endIf}

    # As an absolutely last resort after a few automatic attempts and user
    # intervention - we will just overwrite everything with \`Nsis7z::Extract\`
    # even though it is not atomic and will ignore errors.

    # Clear the temporary folder first to make sure we don't use twice as
    # much disk space.
    RMDir /r "$PLUGINSDIR\\7z-out"

    Nsis7z::Extract "\${FILE}"
    Goto DoneExtract7za

  AbortExtract7za:
    Quit

  RetryExtract7za:
    Sleep 1000
    Goto LoopExtract7za

  DoneExtract7za:
!macroend`

const sha256 = value => createHash('sha256').update(value).digest('hex')
const occurrences = (source, value) => source.split(value).length - 1

function nsisPath(value) {
  assert(typeof value === 'string' && value.length > 0 && !/[\r\n\0]/.test(value), 'Invalid NSIS resource path')
  assert(path.isAbsolute(value) || path.win32.isAbsolute(value), 'NSIS resource path must be absolute')
  return value.replaceAll('$', () => '$$').replaceAll('"', () => '$\\"')
}

function helperFiles(sevenZipPath) {
  nsisPath(sevenZipPath)
  const paths = path.isAbsolute(sevenZipPath) ? path : path.win32
  const root = paths.dirname(paths.dirname(sevenZipPath))
  return { path: sevenZipPath, licensePath: paths.join(root, 'LICENSE.txt'), copyingPath: paths.join(root, 'COPYING') }
}

function replacementMacro(sevenZipPath) {
  const helper = helperFiles(sevenZipPath)
  return [
    '!macro extractUsing7za FILE',
    '  # work4you-direct-7z: only this upstream macro is replaced.',
    '  # Keep the helper out of the destination it is about to overwrite.',
    '  InitPluginsDir',
    '  ClearErrors',
    '  File /oname=$PLUGINSDIR\\work4you-7za.exe "' + nsisPath(helper.path) + '"',
    '  File /oname=$PLUGINSDIR\\work4you-7za-LICENSE.txt "' + nsisPath(helper.licensePath) + '"',
    '  File /oname=$PLUGINSDIR\\work4you-7za-COPYING "' + nsisPath(helper.copyingPath) + '"',
    '  IfErrors Work4youDirectAbort',
    '  Push $R0',
    '  Push $R1',
    '  Push $R2',
    '  Work4youDirectReset:',
    '    StrCpy $R1 0',
    '  Work4youDirectAttempt:',
    '    IntOp $R1 $R1 + 1',
    '    # No short inactivity timeout: a valid full runtime may take minutes.',
    '    # A trailing dot also quotes a drive-root destination safely.',
    '    nsExec::ExecToStack \'"$PLUGINSDIR\\work4you-7za.exe" x -y -aoa -bso0 -bsp0 "-o$OUTDIR\\." "${FILE}"\'',
    '    Pop $R0',
    '    Pop $R2',
    '    # The native fixture observes the real child result, without a wrapper.',
    '    !ifmacrodef work4youNsisExtractionAttempt',
    '      !insertmacro work4youNsisExtractionAttempt "$R1" "$R0" "$R2"',
    '    !endif',
    '    # nsExec may return "error"/"timeout": never coerce its string to zero.',
    '    StrCmp $R0 "0" Work4youDirectDone',
    '    DetailPrint "7z extraction attempt $R1 failed (status $R0): $R2"',
    '    StrCmp $R0 "1" Work4youDirectRetryCheck',
    '    StrCmp $R0 "2" Work4youDirectRetryCheck Work4youDirectFailure',
    '  Work4youDirectRetryCheck:',
    '    # Match the original five-attempt / one-second transient-lock budget.',
    '    IntCmp $R1 5 Work4youDirectFailure Work4youDirectSleep Work4youDirectFailure',
    '  Work4youDirectSleep:',
    '    Sleep 1000',
    '    Goto Work4youDirectAttempt',
    '  Work4youDirectFailure:',
    '    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(decompressionFailed)$\\n$R0" /SD IDCANCEL IDRETRY Work4youDirectReset',
    '  Work4youDirectAbort:',
    '    SetErrorLevel 2',
    '    Quit',
    '  Work4youDirectDone:',
    '    Pop $R2',
    '    Pop $R1',
    '    Pop $R0',
    '!macroend',
  ].join('\n')
}

/** Pure patch operation: exact upstream bytes, or this exact already-applied patch. */
export function transformNsisDirectExtraction({ source, builderVersion, sevenZipPath }) {
  assert.equal(builderVersion, BUILDER_VERSION, 'Unsupported electron-builder version for direct extraction')
  const replacement = replacementMacro(sevenZipPath)
  const originalCount = occurrences(source, ORIGINAL_MACRO)
  const replacementCount = occurrences(source, replacement)
  let original
  let alreadyApplied
  if (originalCount === 1 && replacementCount === 0) {
    original = source
    alreadyApplied = false
  } else {
    assert.equal(originalCount, 0, 'Expected exactly one upstream extraction macro')
    assert.equal(replacementCount, 1, 'Unknown or modified NSIS extraction patch')
    original = source.replace(replacement, () => ORIGINAL_MACRO)
    alreadyApplied = true
  }
  assert.equal(sha256(original), ORIGINAL_SHA256, 'Upstream NSIS template drift; review before patching')
  const patched = alreadyApplied ? source : source.replace(ORIGINAL_MACRO, () => replacement)
  return { source: patched, alreadyApplied, originalSha256: ORIGINAL_SHA256, patchedSha256: sha256(patched) }
}

function templateInfo(builderRoot) {
  const root = builderRoot ?? path.dirname(require.resolve('app-builder-lib/package.json'))
  const builder = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.equal(builder.version, BUILDER_VERSION, 'Unsupported electron-builder version for direct extraction')
  return { templatePath: path.join(root, 'templates/nsis/include/extractAppPackage.nsh'),
    builderVersion: builder.version, originalSha256: ORIGINAL_SHA256 }
}

/** A repeated benchmark must never silently measure the candidate as its baseline. */
export function verifyNsisBaselineTemplate({ builderRoot } = {}) {
  const info = templateInfo(builderRoot)
  assert.equal(sha256(fs.readFileSync(info.templatePath)), ORIGINAL_SHA256, 'Baseline requires the unmodified upstream NSIS template')
  return info
}

export function verifyStandaloneSevenZip(sevenZipPath) {
  const files = helperFiles(sevenZipPath)
  for (const [filename, expected] of [[files.path, SEVEN_ZIP.sha256],
    [files.licensePath, SEVEN_ZIP.licenseSha256], [files.copyingPath, SEVEN_ZIP.copyingSha256]]) {
    assert(fs.lstatSync(filename).isFile(), '7-Zip resource must be an ordinary file: ' + filename)
    assert.equal(sha256(fs.readFileSync(filename)), expected, 'Unrecognized standalone 7-Zip resource: ' + filename)
  }
  return { ...SEVEN_ZIP, ...files }
}

export async function applyNsisDirectExtractionPatch({ sevenZipPath, builderRoot } = {}) {
  const info = templateInfo(builderRoot)
  if (!sevenZipPath) {
    assert.equal(process.platform, 'win32', 'Resolve the Windows 7-Zip helper on a native Windows builder')
    const { getPath7za } = require('app-builder-lib/out/toolsets/7zip.js')
    sevenZipPath = await getPath7za()
  }
  const helper = verifyStandaloneSevenZip(sevenZipPath)
  const source = fs.readFileSync(info.templatePath, 'utf8')
  const transformed = transformNsisDirectExtraction({ source, builderVersion: info.builderVersion, sevenZipPath })
  // All checks complete before the one narrowly scoped write.
  if (!transformed.alreadyApplied) fs.writeFileSync(info.templatePath, transformed.source, 'utf8')
  return { ...info, patchedSha256: transformed.patchedSha256, alreadyApplied: transformed.alreadyApplied, sevenZip: helper }
}

/** Refuse to overwrite any edit made after applying this receipt. */
export function restoreNsisDirectExtractionPatch(receipt) {
  const source = fs.readFileSync(receipt.templatePath, 'utf8')
  assert.equal(receipt.originalSha256, ORIGINAL_SHA256, 'Invalid original template receipt')
  assert.equal(sha256(source), receipt.patchedSha256, 'Patched NSIS template changed; refusing to restore over it')
  const checked = transformNsisDirectExtraction({ source, builderVersion: receipt.builderVersion,
    sevenZipPath: receipt.sevenZip.path })
  assert(checked.alreadyApplied, 'Receipt does not identify an applied extraction patch')
  const restored = source.replace(replacementMacro(receipt.sevenZip.path), () => ORIGINAL_MACRO)
  fs.writeFileSync(receipt.templatePath, restored, 'utf8')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await applyNsisDirectExtractionPatch(), null, 2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}

