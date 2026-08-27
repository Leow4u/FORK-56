import type { FC, ReactNode } from "react";

export function paragraphPlainText(children: ReactNode): string | null {
  if (typeof children === "string") return children;
  if (
    Array.isArray(children) &&
    children.length > 0 &&
    children.every((child) => typeof child === "string")
  ) {
    return children.join("");
  }
  return null;
}

/** Web v1: plugin transcript directives are not loaded in the dashboard yet. */
export const TranscriptDirective: FC<{ children: ReactNode }> = () => null;

export function TranscriptDirectiveLeaf(_props: {
  streaming?: boolean;
  text: string;
}): null {
  return null;
}

export function useIsClaimedDirective(_text: string): boolean {
  return false;
}
