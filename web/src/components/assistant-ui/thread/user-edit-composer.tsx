import { ComposerPrimitive, useAui } from "@assistant-ui/react";
import type { FC } from "react";

import { Codicon } from "@/components/ui/codicon";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Work4YouGateway } from "@/work4you";

interface UserEditComposerProps {
  cwd: string | null;
  gateway: Work4YouGateway | null;
  sessionId: string | null;
}

/** Web v1: lightweight edit composer (desktop rich editor is a follow-up). */
export const UserEditComposer: FC<UserEditComposerProps> = () => {
  const { t } = useI18n();
  const copy = t.assistant.thread;
  const aui = useAui();

  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 py-2"
      data-slot="aui_edit-composer-root"
    >
      <ComposerPrimitive.Root className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
        <ComposerPrimitive.Input
          className={cn(
            "min-h-[4rem] w-full resize-y rounded-lg border border-border/40 bg-background px-3 py-2 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
          placeholder={copy.editMessage}
        />
        <div className="flex justify-end gap-2">
          <ComposerPrimitive.Cancel asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
              onClick={() => aui.composer().cancel()}
            >
              {t.common.cancel}
            </button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Codicon name="send" className="size-3.5" />
              {t.common.save}
            </button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};
