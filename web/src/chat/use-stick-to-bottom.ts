import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a scroll container pinned to the bottom while the user is already
 * there; exposes a jump control when they scroll up.
 */
export function useStickToBottom(deps: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView?.({ block: "end", behavior });
    setShowJump(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setShowJump(!isNearBottom());
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    if (isNearBottom()) {
      endRef.current?.scrollIntoView?.({ block: "end" });
      setShowJump(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, endRef, showJump, scrollToBottom };
}
