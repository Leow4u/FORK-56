declare global {
  interface Window {
    work4youDesktop?: {
      api?: (...args: unknown[]) => Promise<unknown>;
    };
  }
}

export {};
