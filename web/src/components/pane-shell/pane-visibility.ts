export function usePaneLifecycle(_id: string): { visible: boolean } {
  return { visible: true };
}

export function usePaneVisible(): boolean {
  return true;
}

export function queryVisible(selector: string): Element[] {
  return Array.from(document.querySelectorAll(selector));
}

export function queryAllVisible(selector: string): Element[] {
  return queryVisible(selector);
}
