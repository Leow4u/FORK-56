import { useCallback, useRef, type KeyboardEvent } from "react";

import {
  SlashPopover,
  type SlashPopoverHandle,
} from "@/components/SlashPopover";
import type { GatewayClient } from "@/lib/gatewayClient";

import { Composer, type ComposerProps } from "./composer";

export interface SlashComposerProps extends Omit<ComposerProps, "onBeforeKeyDown"> {
  gateway: GatewayClient | null;
}

/**
 * Chat composer with `/` command autocomplete (same UX as the legacy PTY chat).
 */
export function SlashComposer({
  gateway,
  value,
  onChange,
  className,
  ...rest
}: SlashComposerProps) {
  const slashRef = useRef<SlashPopoverHandle>(null);

  const onBeforeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) =>
      slashRef.current?.handleKey(event) ?? false,
    [],
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <SlashPopover
        ref={slashRef}
        input={value}
        gw={gateway}
        onApply={onChange}
      />
      <Composer
        value={value}
        onChange={onChange}
        onBeforeKeyDown={onBeforeKeyDown}
        className="w-full"
        {...rest}
      />
    </div>
  );
}
