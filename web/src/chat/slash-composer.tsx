import { useCallback, useRef, type KeyboardEvent } from "react";

import {
  PathPopover,
  type PathPopoverHandle,
} from "@/components/PathPopover";
import {
  SlashPopover,
  type SlashPopoverHandle,
} from "@/components/SlashPopover";
import type { GatewayClient } from "@/lib/gatewayClient";

import { Composer, type ComposerProps } from "./composer";

export interface SlashComposerProps extends Omit<ComposerProps, "onBeforeKeyDown"> {
  gateway: GatewayClient | null;
  sessionId?: string | null;
}

/**
 * Chat composer with `/` slash and `@` path autocomplete.
 */
export function SlashComposer({
  gateway,
  sessionId = null,
  value,
  onChange,
  className,
  ...rest
}: SlashComposerProps) {
  const slashRef = useRef<SlashPopoverHandle>(null);
  const pathRef = useRef<PathPopoverHandle>(null);

  const onBeforeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (pathRef.current?.handleKey(event)) return true;
      return slashRef.current?.handleKey(event) ?? false;
    },
    [],
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <PathPopover
        ref={pathRef}
        input={value}
        gw={gateway}
        sessionId={sessionId}
        onApply={onChange}
      />
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
