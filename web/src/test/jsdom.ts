import { vi } from "vitest";

class InertResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

/** A ResizeObserver that accepts observers and never calls them back. */
export function stubResizeObserver() {
  vi.stubGlobal("ResizeObserver", InertResizeObserver);
}

/** jsdom has no Web Animations API — assistant-ui enter animations need this. */
export function stubElementAnimate() {
  if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.animate) {
    HTMLElement.prototype.animate = () =>
      ({
        cancel: () => {},
        finish: () => {},
        play: () => {},
        pause: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as Animation;
  }
}
