import type { Locale, ResolvedTranslations } from "./types";
import { resolveTranslations } from "./resolve";

let runtimeLocale: Locale = "en";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolvePath(source: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (current, part) => (isRecord(current) ? current[part] : undefined),
      source,
    );
}

function render(value: unknown, args: unknown[]): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "function") {
    return (value as (...fnArgs: unknown[]) => string)(...args);
  }
  return null;
}

function translateFrom(
  source: (locale: Locale) => ResolvedTranslations,
  locale: Locale,
  key: string,
  args: unknown[],
): string {
  const active = render(resolvePath(source(locale), key), args);
  if (active !== null) return active;
  if (locale !== "en") {
    const fallback = render(resolvePath(source("en"), key), args);
    if (fallback !== null) return fallback;
  }
  return key;
}

const catalog = (locale: Locale): ResolvedTranslations =>
  resolveTranslations(locale);

export function setRuntimeI18nLocale(locale: Locale) {
  runtimeLocale = locale;
}

export function translateNow(key: string, ...args: unknown[]): string {
  return translateFrom(catalog, runtimeLocale, key, args);
}
