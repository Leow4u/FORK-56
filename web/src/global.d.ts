export {};

declare global {
  interface Window {
    /** Electron desktop bridge — absent in the web dashboard. */
    work4youDesktop?: {
      openExternal?: (url: string) => Promise<void>;
      writeClipboard?: (text: string) => Promise<boolean>;
      readClipboard?: () => Promise<string>;
      getPathForFile?: (file: File) => string;
      normalizePreviewTarget?: (
        target: string,
        baseDir?: string,
      ) => Promise<unknown>;
      revealPath?: (path: string) => Promise<boolean>;
      readFileDataUrl?: (filePath: string) => Promise<string>;
      saveImageFromUrl?: (url: string) => Promise<boolean>;
    };
  }
}
