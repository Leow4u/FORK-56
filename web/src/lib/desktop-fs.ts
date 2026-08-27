export function isDesktopFsRemoteMode(): boolean {
  return false;
}

export async function readDesktopFileDataUrl(_path: string): Promise<string> {
  throw new Error("Desktop file bridge is not available in the web dashboard.");
}

export async function readDesktopFileText(_path: string): Promise<{
  text: string;
  path: string;
}> {
  throw new Error("Desktop file bridge is not available in the web dashboard.");
}
