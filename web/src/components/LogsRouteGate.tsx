/**
 * LogsRouteGate — keeps the Logs page out of the SPA by default.
 *
 * /logs tails the raw agent / errors / gateway log files — an operator
 * diagnostics surface, not a user one. The page is fully absent unless
 * the operator sets `dashboard.show_logs_admin: true`: hitting the URL
 * redirects to the home route instead of mounting the page. The
 * read-only /api/logs endpoint stays untouched — the desktop app's
 * Command Center tails logs through it.
 *
 * Same self-gating pattern as FilesRouteGate.
 */

import { lazy, useEffect, useState } from "react";
import { Navigate } from "react-router";

import { api } from "@/lib/api";

const LogsPage = lazy(() => import("@/pages/LogsPage"));

export function LogsRouteGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        const dash = (cfg?.dashboard ?? {}) as { show_logs_admin?: unknown };
        setAllowed(dash.show_logs_admin === true);
      })
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === null) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return <LogsPage />;
}
