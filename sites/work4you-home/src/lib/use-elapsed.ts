import { useEffect, useState } from 'react'

/** Segundos acumulados enquanto `running` é true (um relógio de animação que pausa). */
export function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running) {
      return
    }

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const step = Math.max(0, Math.min(0.1, (now - last) / 1000))

      last = now
      setElapsed((value) => value + step)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [running])

  return elapsed
}
