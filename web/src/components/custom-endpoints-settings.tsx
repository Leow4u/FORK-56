/**
 * Settings → Providers → Custom Endpoints.
 * Web counterpart of apps/desktop/src/app/settings/custom-endpoints-settings.tsx.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Globe, Loader2, Plus, Save, Trash2, Zap } from "lucide-react";

import {
  api,
  type CustomEndpoint,
  type CustomEndpointUpdate,
} from "@/lib/api";
import { useToast } from "@work4you/ui/hooks/use-toast";
import { Button } from "@work4you/ui/ui/components/button";
import { Checkbox } from "@work4you/ui/ui/components/checkbox";
import { Input } from "@work4you/ui/ui/components/input";
import { Label } from "@work4you/ui/ui/components/label";
import { Badge } from "@work4you/ui/ui/components/badge";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@work4you/ui/ui/components/card";

interface EndpointForm {
  apiKey: string;
  baseUrl: string;
  contextLength: string;
  discoverModels: boolean;
  id: string;
  makeDefault: boolean;
  model: string;
  name: string;
}

const EMPTY_FORM: EndpointForm = {
  apiKey: "",
  baseUrl: "",
  contextLength: "",
  discoverModels: true,
  id: "",
  makeDefault: true,
  model: "",
  name: "",
};

function formFromEndpoint(endpoint: CustomEndpoint): EndpointForm {
  return {
    apiKey: "",
    baseUrl: endpoint.base_url,
    contextLength: endpoint.context_length ? String(endpoint.context_length) : "",
    discoverModels: endpoint.discover_models,
    id: endpoint.id,
    makeDefault: Boolean(endpoint.is_current),
    model: endpoint.model,
    name: endpoint.name,
  };
}

function toPayload(form: EndpointForm, models?: string[]): CustomEndpointUpdate {
  const contextLength = Number.parseInt(form.contextLength, 10);
  return {
    id: form.id.trim() || undefined,
    name: form.name.trim(),
    base_url: form.baseUrl.trim(),
    model: form.model.trim(),
    api_key: form.apiKey.trim() || undefined,
    context_length:
      Number.isFinite(contextLength) && contextLength > 0 ? contextLength : undefined,
    discover_models: form.discoverModels,
    make_default: form.makeDefault,
    models: models?.length ? models : undefined,
  };
}

export function CustomEndpointsSettingsSection() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<CustomEndpoint[]>([]);
  const [form, setForm] = useState<EndpointForm>(EMPTY_FORM);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const data = await api.getCustomEndpoints();
    setEndpoints(data.endpoints);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.getCustomEndpoints();
        if (cancelled) return;
        setEndpoints(data.endpoints);
        const current =
          data.endpoints.find((endpoint) => endpoint.is_current) ??
          data.endpoints[0];
        if (current) {
          setForm(formFromEndpoint(current));
          setDiscoveredModels(current.models);
        }
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : "Could not load custom endpoints",
          "error",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.saveCustomEndpoint(toPayload(form, discoveredModels));
      setEndpoints(response.endpoints);
      const saved = response.endpoints.find((endpoint) => endpoint.id === response.id);
      if (saved) {
        setForm(formFromEndpoint(saved));
        setDiscoveredModels(saved.models);
      }
      showToast("Custom endpoint saved.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setTesting(true);
      const response = await api.validateCustomEndpoint(toPayload(form));
      setDiscoveredModels(response.models);
      if (response.ok) {
        if (!form.model && response.models[0]) {
          setForm((current) => ({ ...current, model: response.models[0] }));
        }
        showToast(
          response.models.length
            ? `Endpoint reachable — ${response.models.length} models found.`
            : "Endpoint is reachable.",
          "success",
        );
      } else {
        showToast(response.message || "Endpoint validation failed.", "error");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Validation failed", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async (endpoint: CustomEndpoint) => {
    try {
      setActivating(endpoint.id);
      await api.activateCustomEndpoint(endpoint.id);
      await refresh();
      showToast("Endpoint activated.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Activation failed", "error");
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (endpoint: CustomEndpoint) => {
    if (!window.confirm(`Delete ${endpoint.name}?`)) return;
    try {
      setDeleting(endpoint.id);
      const response = await api.deleteCustomEndpoint(endpoint.id);
      setEndpoints(response.endpoints);
      if (form.id === endpoint.id) {
        setForm(EMPTY_FORM);
        setDiscoveredModels([]);
      }
      showToast("Endpoint deleted.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  const allModelOptions = Array.from(
    new Set([...discoveredModels, form.model].filter(Boolean)),
  );
  const canSave = form.name.trim() && form.baseUrl.trim() && form.model.trim();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Custom Endpoints</CardTitle>
            <Badge tone="secondary">{endpoints.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-0 p-0 divide-y divide-border">
          {endpoints.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No custom endpoints. Add an OpenAI-compatible endpoint below.
            </p>
          ) : (
            endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => {
                    setForm(formFromEndpoint(endpoint));
                    setDiscoveredModels(endpoint.models);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{endpoint.name}</span>
                    {endpoint.is_current && (
                      <Badge tone="success">
                        <Check className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono-ui text-xs text-text-secondary">
                    {endpoint.base_url}
                  </div>
                </button>
                <div className="flex items-center gap-2 sm:justify-end">
                  <Button
                    size="sm"
                    outlined
                    disabled={endpoint.is_current || activating === endpoint.id}
                    prefix={
                      activating === endpoint.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Zap />
                      )
                    }
                    onClick={() => void handleActivate(endpoint)}
                  >
                    Use
                  </Button>
                  {endpoint.source !== "direct-config" && (
                    <Button
                      ghost
                      size="icon"
                      destructive
                      disabled={deleting === endpoint.id}
                      aria-label="Delete endpoint"
                      onClick={() => void handleDelete(endpoint)}
                    >
                      {deleting === endpoint.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              {form.id ? "Edit Endpoint" : "Add Endpoint"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="Axet Proxy"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Provider ID</Label>
              <Input
                value={form.id}
                onChange={(e) => setForm((c) => ({ ...c, id: e.target.value }))}
                placeholder="axet-proxy"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Endpoint URL</Label>
            <Input
              value={form.baseUrl}
              onChange={(e) => setForm((c) => ({ ...c, baseUrl: e.target.value }))}
              placeholder="http://127.0.0.1:8081/v1"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="grid gap-1.5">
              <Label className="text-xs">Default Model</Label>
              <Input
                list="custom-endpoint-models"
                value={form.model}
                onChange={(e) => setForm((c) => ({ ...c, model: e.target.value }))}
                placeholder="gpt-5.4"
              />
              <datalist id="custom-endpoint-models">
                {allModelOptions.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Context</Label>
              <Input
                inputMode="numeric"
                value={form.contextLength}
                onChange={(e) =>
                  setForm((c) => ({ ...c, contextLength: e.target.value }))
                }
                placeholder="Auto"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">API Key</Label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((c) => ({ ...c, apiKey: e.target.value }))}
              placeholder={form.id ? "Leave blank to keep current key" : "Optional"}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.makeDefault}
                onCheckedChange={(checked) =>
                  setForm((c) => ({ ...c, makeDefault: checked === true }))
                }
              />
              Use for new chats
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.discoverModels}
                onCheckedChange={(checked) =>
                  setForm((c) => ({ ...c, discoverModels: checked === true }))
                }
              />
              Discover models
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              outlined
              disabled={testing || !form.baseUrl.trim()}
              prefix={testing ? <Loader2 className="animate-spin" /> : <Zap />}
              onClick={() => void handleValidate()}
            >
              Test
            </Button>
            <Button
              size="sm"
              disabled={saving || !canSave}
              prefix={saving ? <Loader2 className="animate-spin" /> : <Save />}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            {form.id && (
              <Button
                size="sm"
                ghost
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setDiscoveredModels([]);
                }}
              >
                New endpoint
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
