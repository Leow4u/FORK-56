import { useStore } from "@nanostores/react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n";
import {
  $activityDensity,
  type ActivityDensity,
  setActivityDensity,
} from "@/store/activity-density";

/**
 * How much of the agent's work the chat shows — a device preference, like the
 * desktop's Settings → Chat → Activity detail. Not a config.yaml key: it
 * changes what this browser draws, never what the agent does.
 */
export function ActivityDensityField() {
  const { t } = useI18n();
  const copy = t.settings.appearance;
  const density = useStore($activityDensity);

  const options = [
    { id: "compact", label: copy.activityDensityCompact },
    { id: "balanced", label: copy.activityDensityBalanced },
    { id: "detailed", label: copy.activityDensityDetailed },
  ] as const satisfies readonly { id: ActivityDensity; label: string }[];

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
      <div className="min-w-0 max-w-xl">
        <div className="text-sm font-medium">{copy.activityDensityTitle}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {copy.activityDensityDesc}
        </p>
      </div>
      <SegmentedControl
        onChange={setActivityDensity}
        options={options}
        value={density}
      />
    </div>
  );
}
