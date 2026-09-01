import type { ReactNode } from "react";
import { Select, SelectOption } from "@work4you/ui/ui/components/select";
import { Switch } from "@work4you/ui/ui/components/switch";
import { Input } from "@work4you/ui/ui/components/input";
import { Label } from "@work4you/ui/ui/components/label";

import { cn } from "@/lib/utils";

function humanizeSchemaKey(schemaKey: string): string {
  const rawLabel = schemaKey.split(".").pop() ?? schemaKey;
  return rawLabel.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldHint({
  schema,
  schemaKey,
  showSchemaKey,
}: {
  schema: Record<string, unknown>;
  schemaKey: string;
  showSchemaKey: boolean;
}) {
  const keyPath = showSchemaKey && schemaKey.includes(".") ? schemaKey : "";
  const description = schema.description ? String(schema.description) : "";

  if (!keyPath && !description) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {keyPath && (
        <span className="text-xs font-mono text-text-tertiary">{keyPath}</span>
      )}
      {description && (
        <span className="text-xs text-text-secondary">{description}</span>
      )}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatScalar(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function NestedValueEditor({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (isRecord(value)) {
    return (
      <div className="grid gap-2 border border-border p-2">
        {Object.entries(value).map(([subKey, subVal]) => (
          <div key={subKey} className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{subKey}</Label>
            <NestedValueEditor
              fieldKey={`${fieldKey}.${subKey}`}
              value={subVal}
              onChange={(next) => onChange({ ...value, [subKey]: next })}
            />
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="grid gap-2">
        {value.map((item, index) => (
          <div key={`${fieldKey}.${index}`} className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Item {index + 1}</Label>
            <NestedValueEditor
              fieldKey={`${fieldKey}.${index}`}
              value={item}
              onChange={(next) =>
                onChange(value.map((existing, i) => (i === index ? next : existing)))
              }
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Input
      value={formatScalar(value)}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs"
    />
  );
}

export function AutoField({
  schemaKey,
  schema,
  value,
  onChange,
  showSchemaKey = true,
  row = false,
}: AutoFieldProps) {
  const label = humanizeSchemaKey(schemaKey);
  const hint = (
    <FieldHint
      schema={schema}
      schemaKey={schemaKey}
      showSchemaKey={showSchemaKey}
    />
  );

  if (isRecord(value) || (Array.isArray(value) && value.some((item) => isRecord(item)))) {
    return (
      <div className={row ? "grid gap-3 py-3" : "grid gap-3 border border-border p-3"}>
        <Label className="text-xs font-medium">{label}</Label>
        {hint}
        <NestedValueEditor fieldKey={schemaKey} value={value} onChange={onChange} />
      </div>
    );
  }

  let control: ReactNode;
  if (schema.type === "boolean") {
    control = <Switch checked={!!value} onCheckedChange={onChange} />;
  } else if (schema.type === "select") {
    const options = (schema.options as string[]) ?? [];
    control = (
      <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
        {options.map((opt) => (
          <SelectOption key={opt} value={opt}>
            {opt || "(none)"}
          </SelectOption>
        ))}
      </Select>
    );
  } else if (schema.type === "number") {
    control = (
      <Input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) {
            onChange(n);
          }
        }}
      />
    );
  } else if (schema.type === "text") {
    control = (
      <textarea
        className="flex min-h-[80px] w-full border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (schema.type === "list") {
    control = (
      <Input
        value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder="comma-separated values"
      />
    );
  } else {
    control = (
      <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
    );
  }

  const labelBlock = (
    <div className="min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      {hint}
    </div>
  );

  if (row) {
    const compactControl = schema.type === "boolean" || schema.type === "select";
    return (
      <div className="@container">
        <div
          className={cn(
            "grid gap-3 py-3",
            compactControl
              ? "@2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:items-center"
              : "@2xl:grid-cols-[minmax(0,1fr)_minmax(12rem,22rem)] @2xl:items-center",
          )}
        >
          {labelBlock}
          <div className="min-w-0 @2xl:justify-self-end">{control}</div>
        </div>
      </div>
    );
  }

  if (schema.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4">
        {labelBlock}
        {control}
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {labelBlock}
      {control}
    </div>
  );
}

interface AutoFieldProps {
  schemaKey: string;
  schema: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  /** Operator config shows the dotted schema key; Settings hides it. */
  showSchemaKey?: boolean;
  /** Settings rows: label left, control right. */
  row?: boolean;
}
