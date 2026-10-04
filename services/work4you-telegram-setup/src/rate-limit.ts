/** Sliding-window counter per key (the caller's IP). */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit and says whether it fits in the window. */
  take(key: string): boolean {
    const now = this.now()
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs)
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    return true
  }

  sweep(): void {
    const now = this.now()
    for (const [key, hits] of this.hits) {
      const recent = hits.filter((at) => now - at < this.windowMs)
      if (recent.length) this.hits.set(key, recent)
      else this.hits.delete(key)
    }
  }
}
