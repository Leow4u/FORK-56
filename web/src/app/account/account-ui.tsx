import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

interface ExternalLinkButtonProps extends React.ComponentProps<"a"> {
  href: string;
}

export function ExternalLinkButton({
  children,
  className,
  ...props
}: ExternalLinkButtonProps) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline",
        className,
      )}
      {...props}
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

interface InlineMessageProps {
  children: React.ReactNode;
  kind: "error" | "success";
}

export function InlineMessage({ children, kind }: InlineMessageProps) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-1.5 text-xs",
        kind === "error" ? "text-destructive" : "text-success",
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

interface AccountCardProps extends Omit<React.ComponentProps<"section">, "title"> {
  action?: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
}

export function AccountCard({
  action,
  children,
  className,
  description,
  title,
  ...props
}: AccountCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 border border-midground/15 bg-background-base/80 p-4",
        className,
      )}
      {...props}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

interface UsageBarProps {
  danger?: boolean;
  fraction: number;
  label: string;
}

export function UsageBar({ danger, fraction, label }: UsageBarProps) {
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden bg-midground/10"
    >
      <div
        className={cn("h-full", danger ? "bg-destructive" : "bg-midground/60")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
