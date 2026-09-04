import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type ToolsetInfo } from "@/lib/api";
import { SETTINGS_IMAGE_VIDEO_TOOLSETS } from "@/lib/desktop-toolsets";
import { ToolsetConfigDrawer } from "@/components/ToolsetConfigDrawer";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { useI18n } from "@/i18n";

/** Settings → Image & Video — the same Subscription + toggle surface that
 *  used to live in Capabilities → Tools for `image_gen` / `video_gen`. */
export function ImageVideoSettings() {
  const { t } = useI18n();
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadToolsets = useCallback(() => {
    return api
      .getToolsets()
      .then(setToolsets)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadToolsets();
  }, [loadToolsets]);

  const rows = useMemo(
    () =>
      SETTINGS_IMAGE_VIDEO_TOOLSETS.map((name) =>
        toolsets.find((ts) => ts.name === name),
      ).filter((ts): ts is ToolsetInfo => Boolean(ts)),
    [toolsets],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {t.skills.noToolsetsMatch}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {rows.map((toolset) => (
        <ToolsetConfigDrawer
          key={toolset.name}
          toolset={toolset}
          embedded
          onChanged={() => void loadToolsets()}
        />
      ))}
    </div>
  );
}
