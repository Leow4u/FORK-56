import { useStore } from "@nanostores/react";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { useEffect, useState } from "react";

import { StarMap } from "@/app/starmap/star-map";
import { EmptyState } from "@/components/ui/empty-state";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";
import {
  $starmapError,
  $starmapGraph,
  $starmapLoading,
  loadStarmapGraph,
  resetStarmapGraph,
} from "@/store/starmap";
import type { StarmapGraph } from "@/types/work4you";

/**
 * Memory Graph overlay. URL-reachable at `/starmap`, not a default sidebar
 * destination. Chrome is owned by the map (timeline + legend); this page
 * supplies the Web header title and empty/error/loading shells — not Desktop
 * OverlayView/Panel.
 */
export default function StarmapPage() {
  const { t } = useI18n();
  const { profile } = useProfileScope();
  const { setTitle } = usePageHeader();
  const graph = useStore($starmapGraph);
  const loading = useStore($starmapLoading);
  const error = useStore($starmapError);
  const [imported, setImported] = useState<StarmapGraph | null>(null);

  useEffect(() => {
    setTitle(t.starmap.title);
    return () => setTitle(null);
  }, [setTitle, t.starmap.title]);

  // Drop the cached scan when the management profile changes so the next
  // open does not paint another profile's learned graph.
  useEffect(() => {
    resetStarmapGraph();
    void loadStarmapGraph(true);
  }, [profile]);

  useEffect(() => {
    setImported(null);
  }, [graph]);

  const shown = imported ?? graph;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      data-testid="starmap-page"
    >
      {error ? (
        <EmptyState
          className="min-h-0 flex-1"
          description={error}
          title={t.starmap.loadFailed}
        />
      ) : !shown && loading ? (
        <div
          aria-busy="true"
          aria-label={t.starmap.loading}
          className="flex min-h-0 flex-1 items-center justify-center"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <span>{t.starmap.loading}</span>
          </div>
        </div>
      ) : shown && shown.nodes.length === 0 && !imported ? (
        <EmptyState
          className="min-h-0 flex-1"
          description={t.starmap.emptyDesc}
          title={t.starmap.emptyTitle}
        />
      ) : shown ? (
        <StarMap
          graph={shown}
          imported={imported !== null}
          onImport={setImported}
          onResetMap={() => setImported(null)}
        />
      ) : null}
    </div>
  );
}
