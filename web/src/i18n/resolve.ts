import { desktopSections } from "./desktop-sections.raw";
import { en } from "./en";
import type { Locale, ResolvedTranslations, Translations } from "./types";

import { af } from "./af";
import { ar } from "./ar";
import { de } from "./de";
import { es } from "./es";
import { fr } from "./fr";
import { ga } from "./ga";
import { hu } from "./hu";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { pt } from "./pt";
import { ru } from "./ru";
import { tr } from "./tr";
import { uk } from "./uk";
import { zh } from "./zh";
import { zhHant } from "./zh-hant";

const TRANSLATIONS: Record<Locale, Translations> = {
  en,
  zh,
  "zh-hant": zhHant,
  ja,
  de,
  es,
  fr,
  tr,
  uk,
  af,
  ko,
  it,
  ga,
  pt,
  ru,
  hu,
  ar,
};

export function resolveTranslations(locale: Locale): ResolvedTranslations {
  return { ...desktopSections, ...TRANSLATIONS[locale] } as ResolvedTranslations;
}
