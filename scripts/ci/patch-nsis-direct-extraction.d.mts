export interface TemplateInfo {
  templatePath: string
  builderVersion: string
  originalSha256: string
}

export interface StandaloneSevenZip {
  path: string
  sha256: string
  release: string
  url: string
  archiveSha256: string
  licensePath: string
  licenseSha256: string
  copyingPath: string
  copyingSha256: string
}

export interface DirectExtractionReceipt extends TemplateInfo {
  patchedSha256: string
  alreadyApplied: boolean
  sevenZip: StandaloneSevenZip
}

export function verifyNsisBaselineTemplate(options?: { builderRoot?: string }): TemplateInfo
export function verifyStandaloneSevenZip(sevenZipPath: string): StandaloneSevenZip
export function transformNsisDirectExtraction(input: {
  source: string
  builderVersion: string
  sevenZipPath: string
}): { source: string, alreadyApplied: boolean, originalSha256: string, patchedSha256: string }
export function applyNsisDirectExtractionPatch(options?: {
  sevenZipPath?: string
  builderRoot?: string
}): Promise<DirectExtractionReceipt>
export function restoreNsisDirectExtractionPatch(receipt: TemplateInfo & {
  patchedSha256: string
  sevenZip: Pick<StandaloneSevenZip, 'path'>
}): void
