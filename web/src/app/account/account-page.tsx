import { BarChart3, CreditCard, LayoutDashboard, RefreshCw, User, X } from "lucide-react";
import { useCallback, useEffect, type ComponentType } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@work4you/ui/ui/components/button";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { readSettingsReturnPath } from "@/lib/sidebar-nav";
import { cn } from "@/lib/utils";

import { AccountNoticeBanner } from "./account-notice";
import { BillingSection } from "./billing-section";
import type { AccountCopy } from "./copy";
import { refreshAccount } from "./store";
import {
  OverviewSection,
  ProfileSection,
  UsageSection,
  type AccountSectionId,
} from "./summary-sections";
import { useAccountView } from "./use-account";

const SECTIONS: {
  icon: ComponentType<{ className?: string }>;
  id: AccountSectionId;
  label: (copy: AccountCopy) => string;
}[] = [
  { icon: LayoutDashboard, id: "overview", label: (c) => c.sections.overview },
  { icon: CreditCard, id: "billing", label: (c) => c.sections.billing },
  { icon: BarChart3, id: "usage", label: (c) => c.sections.usage },
  { icon: User, id: "profile", label: (c) => c.sections.profile },
];

const DEFAULT_SECTION: AccountSectionId = "overview";

export function AccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { copy, refreshing, view } = useAccountView();

  const requested = searchParams.get("section");
  const active =
    SECTIONS.find((section) => section.id === requested)?.id ?? DEFAULT_SECTION;
  const plansOpen = searchParams.get("view") === "plans";

  const close = useCallback(() => {
    navigate(readSettingsReturnPath("/chat"));
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const goTo = useCallback(
    (section: AccountSectionId, plans = false) => {
      setSearchParams(
        () => {
          const next = new URLSearchParams();
          if (section !== DEFAULT_SECTION) next.set("section", section);
          if (plans) next.set("view", "plans");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const body = (() => {
    if (view.status === "loading") {
      return (
        <div className="flex items-center gap-2 py-10 text-sm text-text-secondary">
          <Spinner className="text-base" />
          {copy.status.loading}
        </div>
      );
    }
    if (view.status !== "normal") {
      return view.notice ? (
        <AccountNoticeBanner
          copy={copy}
          notice={view.notice}
          onRetry={() => void refreshAccount()}
        />
      ) : null;
    }
    switch (active) {
      case "overview":
        return <OverviewSection copy={copy} view={view} onNavigate={goTo} />;
      case "billing":
        return (
          <BillingSection
            copy={copy}
            view={view}
            plansOpen={plansOpen}
            onTogglePlans={() => goTo("billing", !plansOpen)}
          />
        );
      case "usage":
        return <UsageSection copy={copy} view={view} />;
      case "profile":
        return <ProfileSection copy={copy} view={view} />;
    }
  })();

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background-base"
      data-account-surface=""
      role="region"
      aria-label={copy.title}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-current/10 px-3">
        <h1 className="truncate text-sm font-medium text-foreground">{copy.title}</h1>
        <div className="flex items-center gap-1">
          <Button
            ghost
            size="icon"
            aria-label={copy.status.refresh}
            disabled={refreshing}
            onClick={() => void refreshAccount()}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button ghost size="icon" aria-label={copy.status.close} onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] overflow-hidden max-[47.5rem]:grid-cols-1 max-[47.5rem]:grid-rows-[auto_minmax(0,1fr)]">
        <nav
          aria-label={copy.title}
          className="flex min-h-0 flex-col gap-0.5 overflow-y-auto border-current/10 bg-midground/5 px-2.5 py-3 max-[47.5rem]:flex-row max-[47.5rem]:overflow-x-auto max-[47.5rem]:border-b min-[47.5rem]:border-r"
        >
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => goTo(section.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm",
                  "cursor-pointer transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
                  isActive
                    ? "bg-midground/10 font-medium text-foreground"
                    : "text-text-secondary hover:bg-midground/5 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{section.label(copy)}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-[clamp(1.25rem,4vw,4rem)] pb-20 pt-4">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
