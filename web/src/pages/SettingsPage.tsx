/**
 * SettingsPage — the user-facing curated settings surface (/settings).
 *
 * Web counterpart of the desktop app's Settings overlay
 * (apps/desktop/src/app/settings/): a section nav on the left, curated
 * content on the right, deep-linkable via ``?section=``. Only fields a
 * user should tune from the app live here; the raw config editor
 * (/config) remains the operator surface.
 *
 * Sections grow as the screen-by-screen curation advances. Today:
 *
 *   - model — the Model Settings panel moved from the Models page
 *     (main model, auxiliary tasks, Mixture of Agents), reusing the
 *     exact same component + APIs (getAuxiliaryModels / setModelAssignment).
 */

import { Cpu } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import { useSearchParams } from "react-router";

import { api, type AuxiliaryModelsResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/contexts/usePageHeader";
import { PluginSlot } from "@/plugins";
import { ModelSettingsPanel } from "@/pages/ModelsPage";

interface SettingsSection {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  render: () => React.ReactNode;
}

/** Model section — owns the auxiliary-models state the panel renders. */
function ModelSection() {
  const [aux, setAux] = useState<AuxiliaryModelsResponse | null>(null);
  const [saveKey, setSaveKey] = useState(0);

  const refreshAux = useCallback(() => {
    api
      .getAuxiliaryModels()
      .then(setAux)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshAux();
  }, [refreshAux]);

  const onAssigned = useCallback(() => {
    refreshAux();
    setSaveKey((k) => k + 1);
  }, [refreshAux]);

  // Model assignments can change outside this page (chat /model --global,
  // CLI, config editor) — refetch when the page regains focus. Mirrors the
  // Models page behavior.
  useEffect(() => {
    let last = 0;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < 1000) return;
      last = Date.now();
      refreshAux();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshAux]);

  return (
    <ModelSettingsPanel aux={aux} refreshKey={saveKey} onSaved={onAssigned} />
  );
}

const SECTIONS: SettingsSection[] = [
  {
    id: "model",
    label: "Model",
    icon: Cpu,
    render: () => <ModelSection />,
  },
];

const DEFAULT_SECTION = SECTIONS[0].id;

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setTitle, setEnd } = usePageHeader();

  const requested = searchParams.get("section") ?? DEFAULT_SECTION;
  const active =
    SECTIONS.find((s) => s.id === requested) ??
    SECTIONS.find((s) => s.id === DEFAULT_SECTION)!;

  useEffect(() => {
    setTitle("Settings");
    setEnd(null);
    return () => {
      setTitle(null);
      setEnd(null);
    };
  }, [setEnd, setTitle]);

  const selectSection = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === DEFAULT_SECTION) next.delete("section");
          else next.set("section", id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6">
      <PluginSlot name="settings:top" />

      <div className="flex min-w-0 flex-col gap-6 md:flex-row">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-44 md:flex-col"
        >
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === active.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => selectSection(section.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-left",
                  "font-sans text-display text-xs tracking-[0.08em] uppercase",
                  "transition-colors cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
                  isActive
                    ? "bg-midground/10 text-midground"
                    : "text-text-secondary hover:text-midground hover:bg-midground/5",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 max-w-3xl flex-1">{active.render()}</div>
      </div>

      <PluginSlot name="settings:bottom" />
    </div>
  );
}
