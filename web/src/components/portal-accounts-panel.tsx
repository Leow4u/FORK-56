import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { Badge } from "@work4you/ui/ui/components/badge";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@work4you/ui/ui/components/card";
import { api, type PortalStatus } from "@/lib/api";
import { LogsPanel } from "@/components/logs-panel";

/** Work4You Portal status + agent logs for Settings → Providers → Accounts. */
export function PortalAccountsPanel() {
  const [portal, setPortal] = useState<PortalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getPortal()
      .then((value) => {
        if (!cancelled) setPortal(value);
      })
      .catch(() => {
        if (!cancelled) setPortal(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Work4You Portal</CardTitle>
          </div>
          <CardDescription>
            Portal account, subscription, and tool-gateway routing for this
            cloud agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="text-xl text-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge tone={portal?.logged_in ? "success" : "secondary"}>
                  {portal?.logged_in ? "logged in" : "not logged in"}
                </Badge>
                {portal?.provider && (
                  <span className="text-sm text-muted-foreground">
                    inference provider: {portal.provider}
                  </span>
                )}
                <a
                  href={
                    portal?.subscription_url ||
                    "https://portal.work4you.ai/manage-subscription"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-primary underline"
                >
                  Manage subscription
                </a>
              </div>
              {portal?.features && portal.features.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-border pt-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Tool Gateway routing
                  </span>
                  {portal.features.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{f.label}</span>
                      <span className="text-muted-foreground">{f.state}</span>
                    </div>
                  ))}
                </div>
              )}
              {!portal?.logged_in && (
                <p className="text-xs text-muted-foreground">
                  Log in with <span className="font-mono">work4you portal</span>{" "}
                  or connect below.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-medium">Agent logs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recent activity from this cloud agent&apos;s log files.
          </p>
        </div>
        <LogsPanel embedded />
      </div>
    </div>
  );
}
