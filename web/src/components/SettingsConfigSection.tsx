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
import { Button } from "@work4you/ui/ui/components/button";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { Toast } from "@work4you/ui/ui/components/toast";
import { useToast } from "@work4you/ui/hooks/use-toast";

export interface SettingsConfigSectionProps {
  keys: readonly string[];
}

export function SettingsConfigSection({ keys }: SettingsConfigSectionProps) {
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
    .map((key) => [key, schema[key]] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => {
      const [, fieldSchema] = entry;
      return fieldSchema != null;
    });

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
