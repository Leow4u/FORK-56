import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@work4you/ui/ui/components/button";

import { ExternalLinkButton, InlineMessage } from "./account-ui";
import type { AccountNotice } from "./account-view";
import type { AccountCopy } from "./copy";
import { runStepUp, type StepUpVerification } from "./step-up";
import { accountBillingApi, refreshAccount } from "./store";

type StepUpState =
  | { phase: "idle" }
  | { phase: "waiting" }
  | { phase: "verifying"; verification: StepUpVerification }
  | { phase: "done"; kind: "error" | "success"; message: string };

function StepUpAction({ copy }: { copy: AccountCopy }) {
  const [state, setState] = useState<StepUpState>({ phase: "idle" });
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const start = async () => {
    if (state.phase === "waiting" || state.phase === "verifying") return;
    setState({ phase: "waiting" });
    const outcome = await runStepUp(accountBillingApi, copy, (verification) => {
      if (mounted.current) setState({ phase: "verifying", verification });
    });
    if (!mounted.current) return;
    if (outcome.kind === "granted") {
      setState({ kind: "success", message: outcome.message, phase: "done" });
      void refreshAccount();
    } else {
      setState({ kind: "error", message: outcome.message, phase: "done" });
    }
  };

  if (state.phase === "verifying") {
    const { code, url } = state.verification;
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-text-secondary">
          {copy.refusal.verifyMessage(code ?? "")}
        </p>
        <ExternalLinkButton href={url}>
          {copy.refusal.openVerification}
        </ExternalLinkButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button
          size="sm"
          disabled={state.phase === "waiting"}
          onClick={() => void start()}
        >
          {state.phase === "waiting" ? copy.refusal.waiting : copy.refusal.authorize}
        </Button>
      </div>
      {state.phase === "done" && (
        <InlineMessage kind={state.kind}>{state.message}</InlineMessage>
      )}
    </div>
  );
}

interface AccountNoticeBannerProps {
  copy: AccountCopy;
  notice: AccountNotice;
  onRetry?: () => void;
}

export function AccountNoticeBanner({
  copy,
  notice,
  onRetry,
}: AccountNoticeBannerProps) {
  const { action } = notice;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 border border-warning/30 bg-warning/10 px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{notice.title}</p>
          <p className="text-xs text-text-secondary">{notice.message}</p>
        </div>
      </div>
      {action.type === "portal" && (
        <ExternalLinkButton href={action.url}>
          {copy.status.openPortal}
        </ExternalLinkButton>
      )}
      {action.type === "retry" && onRetry && (
        <div>
          <Button size="sm" outlined onClick={onRetry}>
            {copy.status.retry}
          </Button>
        </div>
      )}
      {action.type === "step_up" && <StepUpAction copy={copy} />}
    </div>
  );
}
