/**
 * Vitest under Node 26 exposes a broken experimental `localStorage` unless
 * `--localstorage-file` is set. jsdom should replace it, but CI still hits
 * `localStorage === undefined` for some chat unit tests. Install a real
 * in-memory Storage so persistence helpers can be exercised hermetically.
 */
export function resetTestLocalStorage(): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    value: storage,
    writable: true,
  });
}
