import { type RefObject, useEffect, useRef, useState } from 'react'

/** Diz se o elemento está na tela, para pausar animações fora dela. */
export function useInView<T extends Element>(threshold = 0.05): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const node = ref.current

    if (!node || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold })

    observer.observe(node)

    return () => observer.disconnect()
  }, [threshold])

  return [ref, inView]
}
