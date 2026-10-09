export type BenchmarkCandidate = '7z-direct' | 'zip'
export interface BenchmarkOptions { installer: string; sha256: string; commit: string; out: string; candidate?: BenchmarkCandidate }
export interface InventoryFile { path: string; sha256: string; bytes: number }
export function parseArgs(argv: string[]): BenchmarkOptions
export function hashFile(filename: string): Promise<string>
export function inventoryTree(root: string): Promise<{ files: InventoryFile[]; fingerprintSha256: string; totalBytes: number }>
export function archiveEntries(listing: string): string[]
export function extractionToolVersion(info: string): string
export function cleanupScratch(root: string): { removedRelativePaths: string[]; freedScratchBytes: number }
export function benchmarkConfig(original: Record<string, any>, options: {
  variant: '7z' | BenchmarkCandidate; output: string; version: string
}): Record<string, any>
export function validatePayload(root: string, commit: string): void
export function prepareBenchmark(options: BenchmarkOptions): Promise<Record<string, unknown>>
