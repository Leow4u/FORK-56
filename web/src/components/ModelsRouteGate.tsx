/**
 * ModelsRouteGate — the Models page's user-facing content (Model Settings)
 * moved to Settings → Model (/settings). What remains unique on /models is
 * the per-model token/cost analytics, which is an operator surface already
 * gated by ``dashboard.show_token_analytics`` (same flag as the Analytics
 * page). So: gate on → render the page (analytics + settings panel for the
 * operator); gate off → redirect to the new home in Settings.
 *
 * Same self-gating pattern as FilesRouteGate.
 */

import { lazy, useEffect, useState } from "react";
import { Navigate } from "react-router";

import { api } from "@/lib/api";

const ModelsPage = lazy(() => import("@/pages/ModelsPage"));

export function ModelsRouteGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        const dash = (cfg?.dashboard ?? {}) as {
          show_token_analytics?: unknown;
        };
        setAllowed(dash.show_token_analytics === true);
      })
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === null) return null;
  if (!allowed) return <Navigate to="/settings" replace />;
  return <ModelsPage />;
}
