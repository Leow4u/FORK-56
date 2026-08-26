/**
 * FilesRouteGate — keeps the Files admin page out of the SPA by default.
 *
 * /files is an operator surface: a raw file manager over the instance's
 * managed data directory (uploads, deletes, downloads via /api/files*).
 * Everyday user file needs live in the chat (composer attachments, right
 * Files/Preview pane), so the page is fully absent unless the operator
 * sets `dashboard.show_files_admin: true` — hitting the URL redirects to
 * the home route instead of mounting the page. The /api/files endpoints
 * (the actual capability) remain available to the backend/operators.
 *
 * Same self-gating pattern as AnalyticsPage (config read on mount), but
 * gating the whole route rather than rendering an explanation.
 */

import { lazy, useEffect, useState } from "react";
import { Navigate } from "react-router";

import { api } from "@/lib/api";

const FilesPage = lazy(() => import("@/pages/FilesPage"));

export function FilesRouteGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        const dash = (cfg?.dashboard ?? {}) as { show_files_admin?: unknown };
        setAllowed(dash.show_files_admin === true);
      })
      .catch(() => setAllowed(false));
  }, []);

  // Config still loading — render nothing rather than flashing a redirect.
  if (allowed === null) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return <FilesPage />;
}
