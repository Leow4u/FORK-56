import { useRef, useState } from "react";

import type { SubscriptionPreviewResponse } from "@work4you/shared";
import { Badge } from "@work4you/ui/ui/components/badge";
import { Button } from "@work4you/ui/ui/components/button";
import { Input } from "@work4you/ui/ui/components/input";
import { Switch } from "@work4you/ui/ui/components/switch";
import { cn } from "@/lib/utils";

import { AccountNoticeBanner } from "./account-notice";
import { AccountCard, ExternalLinkButton, InlineMessage } from "./account-ui";
import {
  formatAccountDate,
  presentRefusal,
  validateAmount,
  validateAutoReload,
  type AccountNotice,
  type AccountTierView,
  type AccountView,
  type AutoReloadView,
  type BuyCreditsView,
} from "./account-view";
import { createChargeRunner, type ChargeOutcome } from "./charge-flow";
import type { AccountCopy } from "./copy";
import { accountBillingApi, refreshAccount } from "./store";

interface SectionProps {
  copy: AccountCopy;
  view: AccountView;
}

function PlanCard({
  copy,
  onTogglePlans,
  plansOpen,
  view,
}: SectionProps & { onTogglePlans: () => void; plansOpen: boolean }) {
  const plan = view.plan;
  const [resuming, setResuming] = useState(false);
  const [notice, setNotice] = useState<AccountNotice | null>(null);
  const busy = useRef(false);
  if (!plan) return null;

  const resume = async () => {
    if (busy.current) return;
    busy.current = true;
    setResuming(true);
    setNotice(null);
    const result = await accountBillingApi.resumeSubscription();
    if (result.ok) await refreshAccount();
    else setNotice(presentRefusal(result.refusal, copy));
    busy.current = false;
    setResuming(false);
  };

  return (
    <AccountCard
      title={copy.plan.title}
      action={
        plan.canChangeInApp ? (
          <Button size="sm" outlined onClick={onTogglePlans}>
            {plansOpen
              ? copy.plan.hidePlans
              : plan.isFree
                ? copy.plan.viewPlans
                : copy.plan.changePlan}
          </Button>
        ) : (
          <ExternalLinkButton href={plan.manageUrl}>
            {copy.plan.adjustOnPortal}
          </ExternalLinkButton>
        )
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xl font-semibold text-foreground">{plan.name}</span>
        {plan.price ? (
          <span className="text-sm text-text-secondary">
            {plan.price}
            {copy.plan.perMonth}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-text-secondary">{plan.caption}</p>
      {plan.pending ? (
        <div>
          <Button
            size="sm"
            outlined
            disabled={resuming}
            onClick={() => void resume()}
          >
            {copy.plan.undo}
          </Button>
        </div>
      ) : null}
      {notice ? <AccountNoticeBanner copy={copy} notice={notice} /> : null}
    </AccountCard>
  );
}

type DowngradeState =
  | { kind: "previewing"; tier: AccountTierView }
  | { kind: "ready"; preview: SubscriptionPreviewResponse; tier: AccountTierView }
  | { kind: "scheduling"; preview: SubscriptionPreviewResponse; tier: AccountTierView }
  | { kind: "failed"; notice: AccountNotice; tier: AccountTierView };

function PlansGrid({ copy, view }: SectionProps) {
  const [downgrade, setDowngrade] = useState<DowngradeState | null>(null);
  const runId = useRef(0);
  const scheduling = downgrade?.kind === "scheduling";

  const beginDowngrade = async (tier: AccountTierView) => {
    const id = ++runId.current;
    setDowngrade({ kind: "previewing", tier });
    const result = await accountBillingApi.previewSubscriptionChange(tier.tierId);
    if (runId.current !== id) return;
    if (!result.ok) {
      setDowngrade({ kind: "failed", notice: presentRefusal(result.refusal, copy), tier });
      return;
    }
    if (result.data.effect === "blocked") {
      setDowngrade({
        kind: "failed",
        notice: {
          action: { type: "portal", url: view.plan?.manageUrl ?? view.portalUrl },
          message: result.data.reason || copy.plan.teamManaged,
          title: copy.refusal.genericTitle,
        },
        tier,
      });
      return;
    }
    setDowngrade({ kind: "ready", preview: result.data, tier });
  };

  const confirm = async () => {
    if (downgrade?.kind !== "ready") return;
    const { preview, tier } = downgrade;
    const id = ++runId.current;
    setDowngrade({ kind: "scheduling", preview, tier });
    const result = await accountBillingApi.scheduleSubscriptionChange(tier.tierId);
    if (runId.current !== id) return;
    if (!result.ok) {
      setDowngrade({ kind: "failed", notice: presentRefusal(result.refusal, copy), tier });
      return;
    }
    await refreshAccount();
    if (runId.current === id) setDowngrade(null);
  };

  const cancel = () => {
    runId.current += 1;
    setDowngrade(null);
  };

  return (
    <AccountCard title={copy.tiers.title} description={copy.tiers.upgradeNote}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {view.tiers.map((tier) => (
          <li
            key={tier.tierId}
            className={cn(
              "flex flex-col gap-2 border p-3",
              tier.state === "current"
                ? "border-midground/40 bg-midground/5"
                : "border-midground/15",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tier.name}</p>
                {tier.price ? (
                  <p className="text-xs text-text-secondary">
                    {`${tier.price}${copy.plan.perMonth}`}
                  </p>
                ) : null}
                {tier.credits ? (
                  <p className="text-xs text-text-tertiary">{tier.credits}</p>
                ) : null}
              </div>
              {tier.state === "current" ? (
                <Badge tone="secondary" className="shrink-0 text-xs">
                  {copy.tiers.current}
                </Badge>
              ) : tier.state === "scheduled" ? (
                <Badge tone="warning" className="shrink-0 text-xs">
                  {copy.tiers.scheduled}
                </Badge>
              ) : null}
            </div>
            {tier.state === "upgrade" && tier.upgradeUrl ? (
              <ExternalLinkButton href={tier.upgradeUrl}>
                {copy.tiers.choose}
              </ExternalLinkButton>
            ) : null}
            {tier.state === "downgrade" ? (
              <div>
                <Button
                  size="sm"
                  ghost
                  disabled={scheduling || downgrade?.tier.tierId === tier.tierId}
                  onClick={() => void beginDowngrade(tier)}
                >
                  {copy.tiers.downgrade}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {downgrade ? (
        <div className="flex flex-col gap-2 border-t border-midground/15 pt-3">
          {downgrade.kind === "previewing" ? (
            <p className="text-xs text-text-secondary">{copy.tiers.previewing}</p>
          ) : downgrade.kind === "failed" ? (
            <AccountNoticeBanner copy={copy} notice={downgrade.notice} />
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {copy.tiers.confirmDowngradeTitle(downgrade.tier.name)}
              </p>
              <p className="text-xs text-text-secondary">
                {copy.tiers.confirmDowngradeBody(
                  formatAccountDate(downgrade.preview.effective_at, copy.locale),
                )}
              </p>
            </>
          )}
          <div className="flex gap-2">
            {downgrade.kind === "ready" || downgrade.kind === "scheduling" ? (
              <Button size="sm" disabled={scheduling} onClick={() => void confirm()}>
                {scheduling ? copy.tiers.scheduling : copy.tiers.confirmDowngrade}
              </Button>
            ) : null}
            <Button size="sm" ghost disabled={scheduling} onClick={cancel}>
              {copy.tiers.cancel}
            </Button>
          </div>
        </div>
      ) : null}
    </AccountCard>
  );
}

function BuyCredits({
  buy,
  copy,
  view,
}: SectionProps & { buy: BuyCreditsView }) {
  const runner = useRef(createChargeRunner(accountBillingApi, copy));
  const [phase, setPhase] = useState<"charging" | "idle" | "polling">("idle");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ChargeOutcome | null>(null);
  const busy = phase !== "idle";

  const charge = async (raw: string) => {
    if (busy) return;
    const checked = validateAmount(raw, view.bounds, copy);
    if ("error" in checked) {
      setError(checked.error);
      return;
    }
    setError(null);
    setOutcome(null);
    setPhase("charging");
    const result = await runner.current.run(checked.amount, () => setPhase("polling"));
    setOutcome(result);
    setPhase("idle");
    if (result.kind === "success") void refreshAccount();
  };

  return (
    <AccountCard title={copy.credits.title} description={copy.credits.description}>
      {buy.enabled ? (
        <>
          <div className="flex flex-wrap gap-2">
            {buy.presets.map((preset) => (
              <Button
                key={preset.amount}
                size="sm"
                outlined
                disabled={busy}
                onClick={() => void charge(preset.amount)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void charge(custom);
            }}
          >
            <Input
              aria-label={copy.credits.custom}
              inputMode="decimal"
              placeholder={copy.credits.custom}
              value={custom}
              disabled={busy}
              onChange={(event) => setCustom(event.target.value)}
              className="max-w-40"
            />
            <Button size="sm" type="submit" disabled={busy || !custom.trim()}>
              {copy.credits
                .buy(custom.trim() ? `$${custom.trim().replace(/^\$/, "")}` : "")
                .trim()}
            </Button>
          </form>
          {phase !== "idle" ? (
            <p role="status" className="text-xs text-text-secondary">
              {phase === "charging" ? copy.credits.charging : copy.credits.polling}
            </p>
          ) : null}
          {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}
          {outcome?.kind === "success" ? (
            <InlineMessage kind="success">{outcome.message}</InlineMessage>
          ) : null}
          {outcome && outcome.kind !== "success" ? (
            <AccountNoticeBanner
              copy={copy}
              notice={{
                action:
                  outcome.kind === "ambiguous"
                    ? outcome.portalUrl
                      ? { type: "portal", url: outcome.portalUrl }
                      : { type: "none" }
                    : (outcome.action ?? { type: "none" }),
                message: outcome.message,
                title: outcome.title,
              }}
            />
          ) : null}
        </>
      ) : (
        <p className="text-xs text-text-secondary">{buy.disabledReason}</p>
      )}
    </AccountCard>
  );
}

function AutoReloadEditor({
  autoReload,
  copy,
  view,
}: SectionProps & { autoReload: AutoReloadView }) {
  const enabled = autoReload.kind === "on" || autoReload.kind === "distinct";
  const [editing, setEditing] = useState(false);
  const [threshold, setThreshold] = useState(autoReload.threshold);
  const [reloadTo, setReloadTo] = useState(autoReload.reloadTo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<AccountNotice | null>(null);
  const editable = autoReload.kind !== "unavailable" && autoReload.kind !== "distinct";

  const submit = async (nextEnabled: boolean) => {
    if (saving) return;
    setError(null);
    setNotice(null);
    setSaved(false);
    let amounts = { reloadTo: autoReload.reloadTo, threshold: autoReload.threshold };
    if (nextEnabled) {
      const checked = validateAutoReload(threshold, reloadTo, view.bounds, copy);
      if ("error" in checked) {
        setError(checked.error);
        return;
      }
      amounts = checked;
    }
    setSaving(true);
    // billing.auto_reload requires both amounts even when turning it off.
    const result = await accountBillingApi.updateAutoReload({
      enabled: nextEnabled,
      reload_to_usd: amounts.reloadTo || undefined,
      threshold_usd: amounts.threshold || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setNotice(presentRefusal(result.refusal, copy));
      return;
    }
    setSaved(true);
    setEditing(false);
    void refreshAccount();
  };

  return (
    <AccountCard
      title={copy.autoReload.title}
      description={autoReload.description}
      action={
        editable ? (
          <Switch
            aria-label={copy.autoReload.title}
            checked={enabled || editing}
            disabled={saving}
            onCheckedChange={(next) => {
              if (next) {
                setEditing(true);
              } else if (enabled) {
                void submit(false);
              } else {
                setEditing(false);
              }
            }}
          />
        ) : null
      }
    >
      {autoReload.caption ? (
        <p className="text-xs text-text-secondary">{autoReload.caption}</p>
      ) : null}
      {enabled && editable && !editing ? (
        <div>
          <Button size="sm" ghost onClick={() => setEditing(true)}>
            {copy.autoReload.edit}
          </Button>
        </div>
      ) : null}
      {editing ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(true);
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            {copy.autoReload.threshold}
            <Input
              inputMode="decimal"
              value={threshold}
              disabled={saving}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            {copy.autoReload.reloadTo}
            <Input
              inputMode="decimal"
              value={reloadTo}
              disabled={saving}
              onChange={(event) => setReloadTo(event.target.value)}
            />
          </label>
          <Button size="sm" type="submit" disabled={saving}>
            {saving ? copy.autoReload.saving : copy.autoReload.save}
          </Button>
        </form>
      ) : null}
      {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}
      {saved ? <InlineMessage kind="success">{copy.autoReload.saved}</InlineMessage> : null}
      {notice ? <AccountNoticeBanner copy={copy} notice={notice} /> : null}
    </AccountCard>
  );
}

function PaymentRow({ copy, view }: SectionProps) {
  const payment = view.payment;
  if (!payment) return null;
  return (
    <AccountCard
      title={copy.payment.title}
      action={
        <ExternalLinkButton href={payment.url}>
          {payment.label ? copy.payment.update : copy.payment.add}
        </ExternalLinkButton>
      }
    >
      <p className="text-sm text-foreground">{payment.label ?? copy.payment.noCard}</p>
    </AccountCard>
  );
}

export function BillingSection({
  copy,
  onTogglePlans,
  plansOpen,
  view,
}: SectionProps & { onTogglePlans: () => void; plansOpen: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <PlanCard
        copy={copy}
        view={view}
        plansOpen={plansOpen}
        onTogglePlans={onTogglePlans}
      />
      {plansOpen && view.tiers.length > 0 ? <PlansGrid copy={copy} view={view} /> : null}
      {view.buy && !view.plan?.isFree ? (
        <BuyCredits copy={copy} view={view} buy={view.buy} />
      ) : null}
      {view.autoReload && !view.plan?.isFree ? (
        <AutoReloadEditor
          key={`${view.autoReload.threshold}:${view.autoReload.reloadTo}:${view.autoReload.kind}`}
          copy={copy}
          view={view}
          autoReload={view.autoReload}
        />
      ) : null}
      <PaymentRow copy={copy} view={view} />
    </div>
  );
}
