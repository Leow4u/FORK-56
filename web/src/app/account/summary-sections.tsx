import { useStore } from "@nanostores/react";

import { Button } from "@work4you/ui/ui/components/button";

import { AccountCard, ExternalLinkButton, UsageBar } from "./account-ui";
import type { AccountView } from "./account-view";
import type { AccountCopy } from "./copy";
import { $portalIdentity } from "./store";

interface SectionProps {
  copy: AccountCopy;
  view: AccountView;
}

export type AccountSectionId = "billing" | "overview" | "profile" | "usage";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function OverviewSection({
  copy,
  onNavigate,
  view,
}: SectionProps & { onNavigate: (section: AccountSectionId, plans?: boolean) => void }) {
  const identity = useStore($portalIdentity);
  const plan = view.plan;
  const autoReloadOn =
    view.autoReload?.kind === "on" || view.autoReload?.kind === "distinct";

  return (
    <div className="flex flex-col gap-4">
      {identity?.email || identity?.name ? (
        <p className="text-xs text-text-secondary">
          {copy.overview.signedInAs}{" "}
          <span className="text-foreground">{identity.name || identity.email}</span>
          {identity.name && identity.email ? ` · ${identity.email}` : null}
        </p>
      ) : null}
      <AccountCard title={view.orgName ?? copy.title}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label={copy.overview.plan}
            value={
              plan?.price ? `${plan.name} · ${plan.price}${copy.plan.perMonth}` : plan?.name
            }
          />
          <Stat label={copy.overview.balance} value={view.balance} />
          {plan?.isFree ? null : (
            <Stat
              label={copy.overview.autoReload}
              value={autoReloadOn ? copy.overview.autoReloadOn : copy.overview.autoReloadOff}
            />
          )}
        </div>
        {plan ? <p className="text-xs text-text-secondary">{plan.caption}</p> : null}
        <div className="flex flex-wrap gap-2">
          {plan?.isFree && plan.canChangeInApp ? (
            <Button size="sm" onClick={() => onNavigate("billing", true)}>
              {copy.overview.viewPlans}
            </Button>
          ) : (
            <Button size="sm" outlined onClick={() => onNavigate("billing")}>
              {copy.overview.managePlan}
            </Button>
          )}
          <Button size="sm" ghost onClick={() => onNavigate("usage")}>
            {copy.overview.seeUsage}
          </Button>
        </div>
      </AccountCard>
      <UsageSection copy={copy} view={view} />
    </div>
  );
}

export function UsageSection({ copy, view }: SectionProps) {
  if (view.usage.length === 0) return null;
  return (
    <AccountCard title={copy.usage.title}>
      <ul className="flex flex-col gap-4">
        {view.usage.map((row) => (
          <li key={row.id} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-foreground">{row.title}</span>
              <span className={row.danger ? "text-sm text-destructive" : "text-sm text-foreground"}>
                {row.value}
              </span>
            </div>
            {row.fraction != null ? (
              <UsageBar danger={row.danger} fraction={row.fraction} label={row.title} />
            ) : null}
            <span className="text-xs text-text-tertiary">{row.caption}</span>
          </li>
        ))}
      </ul>
    </AccountCard>
  );
}

export function ProfileSection({ copy, view }: SectionProps) {
  const identity = useStore($portalIdentity);
  return (
    <AccountCard
      title={copy.profile.title}
      action={<ExternalLinkButton href={view.profileUrl}>{copy.profile.edit}</ExternalLinkButton>}
    >
      <dl className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-xs text-text-tertiary">{copy.profile.name}</dt>
        <dd className="text-sm text-foreground">{identity?.name || copy.profile.noName}</dd>
        <dt className="text-xs text-text-tertiary">{copy.profile.email}</dt>
        <dd className="text-sm text-foreground">{identity?.email || "—"}</dd>
        <dt className="text-xs text-text-tertiary">{copy.profile.organization}</dt>
        <dd className="text-sm text-foreground">{view.orgName || "—"}</dd>
      </dl>
    </AccountCard>
  );
}
