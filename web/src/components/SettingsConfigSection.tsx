/**
 * Curated settings slice backed by config.yaml + the schema API.
 *
 * Reuses the same AutoField renderer as /config, but scoped to an explicit
 * key list (mirrors desktop Settings → ConfigSettings sections).
 */

import { useCallback, useEffect, useState } from "react";

import { AutoField } from "@/components/AutoField";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { getNestedValue, setNestedValue } from "@/lib/nested";
import { inferFieldSchema } from "@/lib/voice-settings";
import { Button } from "@work4you/ui/ui/components/button";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { Toast } from "@work4you/ui/ui/components/toast";
import { useToast } from "@work4you/ui/hooks/use-toast";

export interface SettingsConfigSectionProps {
  keys: readonly string[];
  /** When set, only matching keys render (e.g. desktop voiceFieldVisible). */
  visibleKey?: (key: string, config: Record<string, unknown>) => boolean;
  /** Schema entries omitted from /api/config/schema but curated in Settings. */
  schemaFallback?: Record<string, Record<string, unknown>>;
}

function resolveFieldSchema(
  key: string,
  schema: Record<string, Record<string, unknown>>,
  config: Record<string, unknown>,
  schemaFallback?: Record<string, Record<string, unknown>>,
): Record<string, unknown> | undefined {
  if (schema[key]) {
    return schema[key];
  }
  if (schemaFallback?.[key]) {
    return schemaFallback[key];
  }
  const value = getNestedValue(config, key);
  if (value !== undefined) {
    return inferFieldSchema(value);
  }
  return undefined;
}

export function SettingsConfigSection({
  keys,
  visibleKey,
  schemaFallback,
}: SettingsConfigSectionProps) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [schema, setSchema] = useState<Record<
    string,
    Record<string, unknown>
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch(() => {});
    api
      .getSchema()
      .then((resp) => {
        setSchema(resp.fields as Record<string, Record<string, unknown>>);
      })
      .catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.saveConfig(config);
      showToast(t.config.configSaved, "success");
    } catch (e) {
      showToast(`${t.config.failedToSave}: ${e}`, "error");
    } finally {
      setSaving(false);
    }
  }, [config, showToast, t.config.configSaved, t.config.failedToSave]);

  if (!config || !schema) {
    return (
      <div className="flex items-center gap-2 py-8 text-xs text-text-tertiary">
        <Spinner />
        <span>{t.common.loading}</span>
      </div>
    );
  }

  const fields = keys
    .filter((key) => !visibleKey || visibleKey(key, config))
    .map((key) => {
      const fieldSchema = resolveFieldSchema(
        key,
        schema,
        config,
        schemaFallback,
      );
      return fieldSchema ? ([key, fieldSchema] as const) : null;
    })
    .filter((entry): entry is [string, Record<string, unknown>] => entry != null);

  return (
    <div className="flex flex-col gap-4">
      <Toast toast={toast} />

      <p className="text-xs text-muted-foreground">
        {t.skills.cacheNote ?? "Changes apply to new sessions."}
      </p>

      <div className="flex flex-col gap-4">
        {fields.map(([key, fieldSchema]) => (
          <AutoField
            key={key}
            schemaKey={key}
            schema={fieldSchema}
            value={getNestedValue(config, key)}
            onChange={(value) =>
              setConfig(setNestedValue(config, key, value))
            }
          />
        ))}
      </div>

      <Button
        className="w-fit uppercase"
        size="sm"
        disabled={saving}
        onClick={() => void handleSave()}
        prefix={saving ? <Spinner /> : undefined}
      >
        {saving ? t.common.saving : t.common.save}
      </Button>
    </div>
  );
}
