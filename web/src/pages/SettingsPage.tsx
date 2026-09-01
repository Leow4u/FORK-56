/**
 * SettingsPage — the user-facing curated settings surface (/settings).
 *
 * Web counterpart of the desktop app's Settings overlay
 * (apps/desktop/src/app/settings/): a dedicated surface (product sidebar
 * hidden) with a section nav on the left, curated content on the right,
 * deep-linkable via ``?section=``. Only fields a
 * user should tune from the app live here; the raw config editor
 * (/config) remains the operator surface (hidden from sidebar nav unless
 * `dashboard.show_config_admin` is true; route stays URL-reachable).
 *
 * Sections grow as the screen-by-screen curation advances. Today:
 *
 *   - model — Model Settings panel (main model, auxiliary, MoA) plus
 *     model_context_length and fallback_providers (keys mirror desktop
 *     Settings → Model in apps/desktop/src/app/settings/constants.ts).
 *   - providers — OAuth accounts, provider API keys, custom endpoints
 *     (mirrors desktop Settings → Providers). Accounts includes Work4You
 *     Portal status and agent logs.
 *   - my-computer — cloud agent host metrics (CPU, disk, uptime).
 *   - keys — tool + server/gateway env vars (mirrors desktop Settings →
 *     Tools & Keys).
 *   - chat — personality, timezone, reasoning blocks, image attachments
 *     (keys mirror desktop Settings → Chat in apps/desktop/src/app/settings/constants.ts).
 *   - appearance — dashboard language, theme, and font (same pickers as the
 *     sidebar switchers; mirrors desktop Settings → Appearance).
 *   - workspace — working directory, repo discovery, code execution, file limits
 *     (keys mirror desktop Settings → Workspace).
 *   - safety — approvals, allowlist, security/browser URL policy, checkpoints
 *     (keys mirror desktop Settings → Safety).
 *   - voice — TTS/STT providers and voice tuning (keys + voiceFieldVisible
 *     mirror desktop Settings → Voice).
 *   - memory — memory toggles/budgets, provider + context engine
 *     (ProvidersCard), and compression keys (mirrors desktop Settings →
 *     Memory & Context).
 *   - advanced — toolsets, terminal backend, limits, delegation, updates
 *     (keys mirror desktop Settings → Advanced).
 */

import { Brain, Cpu, KeyRound, Lock, MessageCircle, Mic, Monitor, Palette, Server, Wrench, X, Zap } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import { useNavigate, useSearchParams } from "react-router";

import { api, type AuxiliaryModelsResponse } from "@/lib/api";
import { cn, themedBody } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";
import { AppearanceSettingsSection } from "@/components/appearance-panels";
import { FallbackModelsField } from "@/components/FallbackModelsField";
import { SettingsConfigSection } from "@/components/SettingsConfigSection";
import { ADVANCED_CONFIG_KEYS } from "@/lib/advanced-settings";
import {
  MEMORY_COMPRESSION_KEYS,
  MEMORY_TOGGLE_KEYS,
} from "@/lib/memory-context-settings";
import { MODEL_CONFIG_KEYS } from "@/lib/model-settings";
import { readSettingsReturnPath } from "@/lib/sidebar-nav";
import {
  VOICE_CONFIG_KEYS,
  VOICE_SCHEMA_FALLBACKS,
  voiceFieldVisible,
} from "@/lib/voice-settings";
import { ModelSettingsPanel } from "@/pages/ModelsPage";
import { ProvidersCard } from "@/pages/PluginsPage";
import {
  EnvCredentialsPanel,
  type EnvCredentialsView,
} from "@/components/env-settings-panels";
import { CustomEndpointsSettingsSection } from "@/components/custom-endpoints-settings";
import { CloudComputerPanel } from "@/components/cloud-computer-panel";
import { PortalAccountsPanel } from "@/components/portal-accounts-panel";
import { Button } from "@work4you/ui/ui/components/button";

const PROVIDER_VIEWS = ["accounts", "api-keys", "custom-endpoints"] as const;
type ProviderView = (typeof PROVIDER_VIEWS)[number];

const KEYS_VIEWS = ["tools", "settings"] as const;
type KeysView = (typeof KEYS_VIEWS)[number];

function SettingsSubNav({
  items,
  activeId,
  onSelect,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Section views"
      className="mb-4 flex flex-wrap gap-1 border-b border-border pb-3"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          aria-current={item.id === activeId ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
            item.id === activeId
              ? "bg-midground/10 font-medium text-foreground"
              : "text-text-secondary hover:bg-midground/5 hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function providerPanelView(view: ProviderView): EnvCredentialsView {
  if (view === "accounts") return "providers-accounts";
  if (view === "api-keys") return "providers-api-keys";
  return "providers-api-keys";
}

function keysPanelView(view: KeysView): EnvCredentialsView {
  return view === "tools" ? "keys-tools" : "keys-settings";
}

/** Desktop Settings → Chat keys (apps/desktop/src/app/settings/constants.ts). */
const CHAT_CONFIG_KEYS = [
  "display.personality",
  "timezone",
  "display.show_reasoning",
  "agent.image_input_mode",
] as const;

/** Desktop Settings → Workspace keys (apps/desktop/src/app/settings/constants.ts). */
const WORKSPACE_CONFIG_KEYS = [
  "terminal.cwd",
  "desktop.repo_scan_enabled",
  "desktop.repo_scan_roots",
  "desktop.repo_scan_exclude_paths",
  "code_execution.mode",
  "terminal.persistent_shell",
  "terminal.env_passthrough",
  "file_read_max_chars",
] as const;

/** Desktop Settings → Safety keys (apps/desktop/src/app/settings/constants.ts). */
const SAFETY_CONFIG_KEYS = [
  "approvals.mode",
  "approvals.timeout",
  "approvals.mcp_reload_confirm",
  "command_allowlist",
  "security.redact_secrets",
  "security.allow_private_urls",
  "browser.allow_private_urls",
  "browser.auto_local_for_private_urls",
  "checkpoints.enabled",
] as const;

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
    <div className="flex flex-col gap-6">
      <ModelSettingsPanel aux={aux} refreshKey={saveKey} onSaved={onAssigned} />
      <SettingsConfigSection
        keys={MODEL_CONFIG_KEYS}
        renderField={({ schemaKey, schema, value, onChange }) => {
          if (schemaKey !== "fallback_providers") {
            return null;
          }
          const rawLabel = schemaKey.split(".").pop() ?? schemaKey;
          const label = rawLabel
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const description = schema.description
            ? String(schema.description)
            : undefined;
          return (
            <div className="@container">
              <div className="grid gap-3 py-3 @xl:grid-cols-[minmax(0,1fr)_minmax(12rem,22rem)] @xl:items-center">
                <div className="min-w-0">
                  <div className={cn(themedBody, "text-sm font-medium")}>{label}</div>
                  {description && (
                    <span className="mt-1 block text-xs text-text-secondary">
                      {description}
                    </span>
                  )}
                </div>
                <div className="min-w-0 @xl:justify-self-end">
                  <FallbackModelsField
                    value={value}
                    onChange={(next) => onChange(next)}
                  />
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

/** Providers — accounts, API keys, custom endpoints (desktop parity). */
function ProvidersSection({
  view,
  highlightKey,
  onViewChange,
}: {
  view: ProviderView;
  highlightKey: string | null;
  onViewChange: (view: ProviderView) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingsSubNav
        activeId={view}
        onSelect={(id) => onViewChange(id as ProviderView)}
        items={[
          { id: "accounts", label: "Accounts" },
          { id: "api-keys", label: "API keys" },
          { id: "custom-endpoints", label: "Custom endpoints" },
        ]}
      />
      {view === "custom-endpoints" ? (
        <CustomEndpointsSettingsSection />
      ) : view === "accounts" ? (
        <>
          <PortalAccountsPanel />
          <EnvCredentialsPanel
            view={providerPanelView(view)}
            highlightKey={highlightKey}
          />
        </>
      ) : (
        <EnvCredentialsPanel
          view={providerPanelView(view)}
          highlightKey={highlightKey}
        />
      )}
    </div>
  );
}

/** Tools & Keys — tool API keys + server/gateway env (desktop parity). */
function KeysSection({
  view,
  highlightKey,
  onViewChange,
}: {
  view: KeysView;
  highlightKey: string | null;
  onViewChange: (view: KeysView) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SettingsSubNav
        activeId={view}
        onSelect={(id) => onViewChange(id as KeysView)}
        items={[
          { id: "tools", label: "Tools" },
          { id: "settings", label: "Settings" },
        ]}
      />
      <EnvCredentialsPanel view={keysPanelView(view)} highlightKey={highlightKey} />
    </div>
  );
}

/** Memory & Context — config toggles/budgets + provider card + compression. */
function MemoryContextSection() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsConfigSection keys={MEMORY_TOGGLE_KEYS} />
      <ProvidersCard />
      <SettingsConfigSection keys={MEMORY_COMPRESSION_KEYS} />
    </div>
  );
}

const SECTIONS: SettingsSection[] = [
  {
    id: "model",
    label: "Model",
    icon: Cpu,
    render: () => <ModelSection />,
  },
  {
    id: "my-computer",
    label: "My Computer",
    icon: Server,
    render: () => <CloudComputerPanel />,
  },
  {
    id: "providers",
    label: "Providers",
    icon: Zap,
    render: () => null,
  },
  {
    id: "keys",
    label: "Tools & Keys",
    icon: KeyRound,
    render: () => null,
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageCircle,
    render: () => <SettingsConfigSection keys={CHAT_CONFIG_KEYS} />,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    render: () => <AppearanceSettingsSection />,
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: Monitor,
    render: () => <SettingsConfigSection keys={WORKSPACE_CONFIG_KEYS} />,
  },
  {
    id: "safety",
    label: "Safety",
    icon: Lock,
    render: () => <SettingsConfigSection keys={SAFETY_CONFIG_KEYS} />,
  },
  {
    id: "voice",
    label: "Voice",
    icon: Mic,
    render: () => (
      <SettingsConfigSection
        keys={VOICE_CONFIG_KEYS}
        visibleKey={voiceFieldVisible}
        schemaFallback={VOICE_SCHEMA_FALLBACKS}
      />
    ),
  },
  {
    // Where the agent keeps memory + which context engine compacts it —
    // moved here from the Plugins page, matching the desktop app's
    // Settings → Memory & Context.
    id: "memory",
    label: "Memory & Context",
    icon: Brain,
    render: () => <MemoryContextSection />,
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: Wrench,
    render: () => (
      <SettingsConfigSection
        keys={ADVANCED_CONFIG_KEYS}
        guardToolsetsWipe
      />
    ),
  },
];

const DEFAULT_SECTION = SECTIONS[0].id;

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const requested = searchParams.get("section") ?? DEFAULT_SECTION;
  const active =
    SECTIONS.find((s) => s.id === requested) ??
    SECTIONS.find((s) => s.id === DEFAULT_SECTION)!;

  const rawView = searchParams.get("view");
  const providerView: ProviderView = PROVIDER_VIEWS.includes(
    rawView as ProviderView,
  )
    ? (rawView as ProviderView)
    : "accounts";
  const keysView: KeysView = KEYS_VIEWS.includes(rawView as KeysView)
    ? (rawView as KeysView)
    : "tools";
  const highlightKey = searchParams.get("key");

  const closeSettings = useCallback(() => {
    navigate(readSettingsReturnPath("/chat"));
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSettings]);

  const selectSection = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === DEFAULT_SECTION) next.delete("section");
          else next.set("section", id);
          next.delete("view");
          next.delete("key");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setNestedView = useCallback(
    (view: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (
            (view === "accounts" && active.id === "providers") ||
            (view === "tools" && active.id === "keys")
          ) {
            next.delete("view");
          } else {
            next.set("view", view);
          }
          return next;
        },
        { replace: true },
      );
    },
    [active.id, setSearchParams],
  );

  const sectionContent =
    active.id === "providers" ? (
      <ProvidersSection
        view={providerView}
        highlightKey={highlightKey}
        onViewChange={setNestedView}
      />
    ) : active.id === "keys" ? (
      <KeysSection
        view={keysView}
        highlightKey={highlightKey}
        onViewChange={setNestedView}
      />
    ) : (
      active.render()
    );

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background-base"
      data-settings-surface=""
      role="region"
      aria-label={t.app.nav.settings}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-current/10 px-3">
        <h1 className="truncate text-sm font-medium text-foreground">
          {t.app.nav.settings}
        </h1>
        <Button
          ghost
          size="icon"
          aria-label={t.common.close}
          onClick={closeSettings}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] overflow-hidden max-[47.5rem]:grid-cols-1 max-[47.5rem]:grid-rows-[auto_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="flex min-h-0 flex-col gap-0.5 overflow-y-auto border-current/10 bg-midground/5 px-2.5 py-3 max-[47.5rem]:flex-row max-[47.5rem]:overflow-x-auto max-[47.5rem]:border-b min-[47.5rem]:border-r"
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
                  "flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm",
                  "transition-colors cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
                  isActive
                    ? "bg-midground/10 font-medium text-foreground"
                    : "text-text-secondary hover:bg-midground/5 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-[clamp(1.25rem,4vw,4rem)] pb-20 pt-4">
            <PluginSlot name="settings:top" />
            {sectionContent}
            <PluginSlot name="settings:bottom" />
          </div>
        </div>
      </div>
    </div>
  );
}
