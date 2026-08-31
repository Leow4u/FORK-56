import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@work4you/ui/ui/components/button";
import { Input } from "@work4you/ui/ui/components/input";
import { Segmented } from "@work4you/ui/ui/components/segmented";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { Toast } from "@work4you/ui/ui/components/toast";
import { useToast } from "@work4you/ui/hooks/use-toast";
import { api } from "@/lib/api";
import {
  ARTIFACT_FILTERS,
  type ArtifactFilter,
  type ArtifactRecord,
  artifactImageSrc,
  isHttpArtifact,
  loadArtifactsForSessions,
} from "@/lib/artifact-utils";
import { filePathFromMediaPath } from "@/lib/media";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useProfileScope } from "@/contexts/useProfileScope";
import { useI18n } from "@/i18n";
import { PluginSlot } from "@/plugins";

function formatArtifactTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function downloadDataUrl(dataUrl: string, name: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function ArtifactsPage() {
  const { t } = useI18n();
  const a = t.artifacts;
  const navigate = useNavigate();
  const { profile } = useProfileScope();
  const { setEnd } = usePageHeader();
  const { toast, showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [artifacts, setArtifacts] = useState<ArtifactRecord[] | null>(null);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const refreshInFlightRef = useRef(false);

  const tabParam = searchParams.get("tab");
  const kindFilter: ArtifactFilter = ARTIFACT_FILTERS.includes(
    tabParam as ArtifactFilter,
  )
    ? (tabParam as ArtifactFilter)
    : "all";

  const setKindFilter = useCallback(
    (next: ArtifactFilter) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "all") {
            params.delete("tab");
          } else {
            params.set("tab", next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const refreshArtifacts = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setRefreshing(true);

    try {
      const { sessions } = await api.getSessions(
        30,
        0,
        profile || undefined,
        "recent",
      );
      const { artifacts: nextArtifacts, failures } =
        await loadArtifactsForSessions(sessions, async (session) => {
          const res = await api.getSessionMessages(session.id, profile);
          return res.messages;
        });

      if (failures.length > 0) {
        showToast(
          `Skipped ${failures.length} of ${sessions.length} recent sessions while indexing artifacts.`,
          "error",
        );
      }

      setArtifacts(
        nextArtifacts.sort((left, right) => right.timestamp - left.timestamp),
      );
    } catch (err) {
      showToast(
        `${a.failedLoad}: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
      setArtifacts([]);
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
    }
  }, [a.failedLoad, profile, showToast]);

  useEffect(() => {
    void refreshArtifacts();
  }, [refreshArtifacts]);

  useEffect(() => {
    setEnd(
      <Button
        ghost
        size="sm"
        disabled={refreshing}
        onClick={() => void refreshArtifacts()}
        aria-label={refreshing ? a.refreshing : a.refresh}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        <span className="hidden sm:inline">
          {refreshing ? a.refreshing : a.refresh}
        </span>
      </Button>,
    );
    return () => setEnd(null);
  }, [a.refresh, a.refreshing, refreshing, refreshArtifacts, setEnd]);

  const visibleArtifacts = useMemo(() => {
    if (!artifacts) {
      return [];
    }

    const q = normalize(query);

    return artifacts.filter((artifact) => {
      if (kindFilter !== "all" && artifact.kind !== kindFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      return (
        artifact.label.toLowerCase().includes(q) ||
        artifact.value.toLowerCase().includes(q) ||
        artifact.sessionTitle.toLowerCase().includes(q)
      );
    });
  }, [artifacts, kindFilter, query]);

  const counts = useMemo(() => {
    const all = artifacts || [];
    return {
      all: all.length,
      image: all.filter((artifact) => artifact.kind === "image").length,
      file: all.filter((artifact) => artifact.kind === "file").length,
      link: all.filter((artifact) => artifact.kind === "link").length,
    };
  }, [artifacts]);

  const openArtifact = useCallback(
    async (artifact: ArtifactRecord) => {
      try {
        if (isHttpArtifact(artifact.href) || artifact.kind === "link") {
          window.open(artifact.href, "_blank", "noopener,noreferrer");
          return;
        }

        const path = filePathFromMediaPath(artifact.value);
        const { dataUrl } = await api.readFsDataUrl(path);
        downloadDataUrl(dataUrl, artifact.label);
      } catch (err) {
        showToast(
          `${a.openFailed}: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
    [a.openFailed, showToast],
  );

  const openChat = useCallback(
    (sessionId: string) => {
      navigate(`/chat?resume=${encodeURIComponent(sessionId)}`);
    },
    [navigate],
  );

  const markImageFailed = useCallback((id: string) => {
    setFailedImageIds((current) => {
      if (current.has(id)) {
        return current;
      }
      return new Set(current).add(id);
    });
  }, []);

  const imageArtifacts = visibleArtifacts.filter(
    (artifact) => artifact.kind === "image",
  );
  const fileArtifacts = visibleArtifacts.filter(
    (artifact) => artifact.kind !== "image",
  );

  return (
    <div className="flex flex-col gap-4">
      <PluginSlot name="artifacts:top" />
      <Toast toast={toast} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            {
              value: "all",
              label: artifacts ? `${a.tabAll} (${counts.all})` : a.tabAll,
            },
            {
              value: "image",
              label: artifacts
                ? `${a.tabImages} (${counts.image})`
                : a.tabImages,
            },
            {
              value: "file",
              label: artifacts ? `${a.tabFiles} (${counts.file})` : a.tabFiles,
            },
            {
              value: "link",
              label: artifacts ? `${a.tabLinks} (${counts.link})` : a.tabLinks,
            },
          ]}
        />
        {counts.all > 0 && (
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={a.search}
            aria-label={a.search}
            className="sm:max-w-xs"
          />
        )}
      </div>

      {!artifacts ? (
        <div
          className="flex min-h-[12rem] items-center justify-center gap-2 text-sm text-muted-foreground"
          aria-busy="true"
        >
          <Spinner />
          <span>{a.indexing}</span>
        </div>
      ) : visibleArtifacts.length === 0 ? (
        <div className="grid min-h-[12rem] place-items-center px-6 text-center">
          <div>
            <div className="text-sm font-medium">{a.noArtifactsTitle}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {a.noArtifactsDesc}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {imageArtifacts.length > 0 && (
            <section>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
                {imageArtifacts.map((artifact) => (
                  <ArtifactImageCard
                    artifact={artifact}
                    failedImage={failedImageIds.has(artifact.id)}
                    key={artifact.id}
                    onImageError={markImageFailed}
                    onOpen={() => void openArtifact(artifact)}
                    onOpenChat={openChat}
                  />
                ))}
              </div>
            </section>
          )}

          {fileArtifacts.length > 0 && (
            <section className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {kindFilter === "link"
                        ? a.colTitleLink
                        : kindFilter === "file"
                          ? a.colTitleFile
                          : a.colTitleDefault}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {kindFilter === "link"
                        ? a.colLocationLink
                        : kindFilter === "file"
                          ? a.colLocationFile
                          : a.colLocationDefault}
                    </th>
                    <th className="px-3 py-2 font-medium">{a.colSession}</th>
                  </tr>
                </thead>
                <tbody>
                  {fileArtifacts.map((artifact) => (
                    <tr
                      className="border-b border-border/40 last:border-0"
                      key={artifact.id}
                    >
                      <td className="px-3 py-2 align-middle">
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2 text-left hover:underline"
                          onClick={() => void openArtifact(artifact)}
                          title={artifact.label}
                        >
                          {artifact.kind === "link" ? (
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">{artifact.label}</span>
                          {artifact.kind === "link" && (
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span
                          className="block truncate font-mono text-xs text-muted-foreground"
                          title={artifact.value}
                        >
                          {artifact.value}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <button
                          type="button"
                          className="flex min-w-0 flex-col text-left hover:underline"
                          onClick={() => openChat(artifact.sessionId)}
                          title={artifact.sessionTitle}
                        >
                          <span className="truncate">{artifact.sessionTitle}</span>
                          <span className="truncate text-[0.7rem] text-muted-foreground">
                            {formatArtifactTime(artifact.timestamp)}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ArtifactImageCard({
  artifact,
  failedImage,
  onImageError,
  onOpen,
  onOpenChat,
}: {
  artifact: ArtifactRecord;
  failedImage: boolean;
  onImageError: (id: string) => void;
  onOpen: () => void;
  onOpenChat: (sessionId: string) => void;
}) {
  const { t } = useI18n();
  const a = t.artifacts;
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    setSrc("");
    void artifactImageSrc(artifact.value)
      .then((nextSrc) => {
        if (active) {
          setSrc(nextSrc);
        }
      })
      .catch(() => {
        if (active) {
          onImageError(artifact.id);
        }
      });
    return () => {
      active = false;
    };
  }, [artifact.id, artifact.value, onImageError]);

  return (
    <article className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <button
        type="button"
        className="relative flex h-40 w-full items-center justify-center overflow-hidden border-b border-border/60 bg-muted/20"
        onClick={onOpen}
        aria-label={artifact.label}
      >
        {!failedImage && src ? (
          <img
            alt={artifact.label}
            className="max-h-40 max-w-full object-contain"
            decoding="async"
            loading="lazy"
            onError={() => onImageError(artifact.id)}
            src={src}
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
      </button>
      <div className="space-y-1.5 p-2">
        <div className="truncate text-sm font-medium">{artifact.label}</div>
        <div className="truncate text-[0.7rem] text-muted-foreground">
          {artifact.sessionTitle} · {formatArtifactTime(artifact.timestamp)}
        </div>
        <Button
          ghost
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onOpenChat(artifact.sessionId)}
        >
          <FolderOpen className="h-3 w-3" />
          {a.chat}
        </Button>
      </div>
    </article>
  );
}
