/**
 * Structured editor for top-level `fallback_providers` — a chain of
 * `{provider, model}` pairs tried when the default model fails.
 *
 * Ported from apps/desktop/src/app/settings/fallback-models-field.tsx.
 * The generic list AutoField stringifies objects to "[object Object]".
 */

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { Button } from "@work4you/ui/ui/components/button";
import { Select, SelectOption } from "@work4you/ui/ui/components/select";
import { Spinner } from "@work4you/ui/ui/components/spinner";

export interface FallbackEntry {
  provider: string;
  model: string;
}

/** Normalize raw config into editor rows (defensive against legacy strings). */
export function normalizeFallbackEntries(value: unknown): FallbackEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return {
        provider: String(record.provider ?? ""),
        model: String(record.model ?? ""),
      };
    }

    if (typeof item === "string") {
      const slash = item.indexOf("/");
      return slash > 0
        ? { provider: item.slice(0, slash), model: item.slice(slash + 1) }
        : { provider: "", model: item };
    }

    return { provider: "", model: "" };
  });
}

export function completeFallbackEntries(rows: FallbackEntry[]): FallbackEntry[] {
  return rows.filter((entry) => entry.provider && entry.model);
}

function entriesEqual(a: FallbackEntry[], b: FallbackEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.provider === b[index]?.provider &&
        entry.model === b[index]?.model,
    )
  );
}

const FALLBACK_EMPTY =
  "No fallback models — the default model is used unless it fails.";
const FALLBACK_ADD = "Add fallback";
const PROVIDER_PLACEHOLDER = "Provider";
const MODEL_PLACEHOLDER = "Model";

export function FallbackModelsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: FallbackEntry[]) => void;
}) {
  const [providers, setProviders] = useState<
    { name: string; slug: string; models?: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FallbackEntry[]>(() =>
    normalizeFallbackEntries(value),
  );
  const lastEmittedRef = useRef(normalizeFallbackEntries(value));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getModelOptions()
      .then((data) => {
        if (cancelled) return;
        setProviders(
          (data.providers ?? []).filter((provider) => provider.slug),
        );
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const persisted = normalizeFallbackEntries(value);
    if (entriesEqual(persisted, lastEmittedRef.current)) {
      return;
    }
    lastEmittedRef.current = persisted;
    setRows(persisted);
  }, [value]);

  const commit = (next: FallbackEntry[]) => {
    const complete = completeFallbackEntries(next);
    setRows(next);
    lastEmittedRef.current = complete;
    onChange(complete);
  };

  const updateRow = (index: number, patch: Partial<FallbackEntry>) =>
    commit(rows.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-text-tertiary">
        <Spinner />
        <span>Loading providers…</span>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-1.5">
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{FALLBACK_EMPTY}</p>
      )}
      {rows.map((entry, index) => {
        const providerRow = providers.find(
          (provider) => provider.slug === entry.provider,
        );
        const catalog = providerRow?.models ?? [];
        const modelItems =
          entry.model && !catalog.includes(entry.model)
            ? [entry.model, ...catalog]
            : catalog;

        return (
          <div className="flex flex-wrap items-center gap-2" key={index}>
            <span className="w-4 shrink-0 text-center font-mono text-[0.7rem] text-muted-foreground">
              {index + 1}
            </span>
            <Select
              value={entry.provider}
              onValueChange={(provider) =>
                updateRow(index, { provider, model: "" })
              }
              placeholder={PROVIDER_PLACEHOLDER}
              className="min-w-36 text-xs"
            >
              {providers.map((provider) => (
                <SelectOption key={provider.slug} value={provider.slug}>
                  {provider.name}
                </SelectOption>
              ))}
            </Select>
            <Select
              value={entry.model}
              onValueChange={(model) => updateRow(index, { model })}
              placeholder={MODEL_PLACEHOLDER}
              className="min-w-52 flex-1 text-xs"
            >
              {modelItems.map((model) => (
                <SelectOption key={model} value={model}>
                  {model}
                </SelectOption>
              ))}
            </Select>
            <Button
              aria-label="Remove"
              ghost
              size="icon"
              onClick={() => commit(rows.filter((_, i) => i !== index))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        );
      })}
      <div>
        <Button
          size="sm"
          onClick={() => commit([...rows, { provider: "", model: "" }])}
        >
          <Plus className="size-3.5" />
          {FALLBACK_ADD}
        </Button>
      </div>
    </div>
  );
}
