import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  HardDrive,
  RotateCw,
  Server,
  X,
} from "lucide-react";
import { Badge } from "@work4you/ui/ui/components/badge";
import { Button } from "@work4you/ui/ui/components/button";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { Card, CardContent } from "@work4you/ui/ui/components/card";
import { ConfirmDialog } from "@work4you/ui/ui/components/confirm-dialog";
import {
  api,
  type StatusResponse,
  type SystemStats,
  type UpdateCheckResponse,
} from "@/lib/api";
import { gatewayLine } from "@/components/SidebarStatusStrip";
import { useSystemActions } from "@/contexts/useSystemActions";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Host metrics + gateway summary + Work4You updates (Settings → My Computer). */
export function CloudComputerPanel() {
  const { t } = useI18n();
  const {
    actionStatus,
    activeAction,
    dismissLog,
    isBusy,
    isRunning,
    pendingAction,
    runAction,
  } = useSystemActions();

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(
    null,
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [updateConfirmChecking, setUpdateConfirmChecking] = useState(false);
  const [updateConfirmInfo, setUpdateConfirmInfo] =
    useState<UpdateCheckResponse | null>(null);

  const canUpdateWork4You = status?.can_update_work4you !== false;

  const load = useCallback(() => {
    setLoading(true);
    return Promise.allSettled([
      api.getSystemStats(),
      api.getStatus(),
      api.checkWork4YouUpdate(false),
    ])
      .then(([st, stStatus, upd]) => {
        if (st.status === "fulfilled") setStats(st.value);
        if (stStatus.status === "fulfilled") setStatus(stStatus.value);
        if (upd.status === "fulfilled") setUpdateInfo(upd.value);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeAction || activeAction !== "update") return;
    if (actionStatus?.running) return;
    void load();
  }, [actionStatus?.running, activeAction, load]);

  useEffect(() => {
    if (!updateConfirmOpen) {
      setUpdateConfirmInfo(null);
      return;
    }
    let cancelled = false;
    setUpdateConfirmChecking(true);
    api
      .checkWork4YouUpdate(false)
      .then((info) => {
        if (!cancelled) setUpdateConfirmInfo(info);
      })
      .catch(() => {
        if (!cancelled) setUpdateConfirmInfo(null);
      })
      .finally(() => {
        if (!cancelled) setUpdateConfirmChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [updateConfirmOpen]);

  const checkForUpdate = useCallback(async (force = false) => {
    setCheckingUpdate(true);
    try {
      setUpdateInfo(await api.checkWork4YouUpdate(force));
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  const updateConfirmDescription = useMemo(() => {
    if (updateConfirmChecking) return t.common.loading;
    const info = updateConfirmInfo ?? updateInfo;
    if (info?.message && !info.can_apply) return info.message;
    if (info?.behind && info.behind > 0) {
      const cmd = info.update_command;
      const n = info.behind;
      return `This will run 'work4you update' (${cmd}) and pull ${n} new commit${n === 1 ? "" : "s"}. The gateway restarts when the update finishes.`;
    }
    const cmd = info?.update_command ?? "work4you update";
    return (
      t.status.updateWork4YouConfirmMessage ??
      `This will run 'work4you update' (${cmd}) and restart the gateway when it finishes.`
    );
  }, [
    t.common.loading,
    t.status.updateWork4YouConfirmMessage,
    updateConfirmChecking,
    updateConfirmInfo,
    updateInfo,
  ]);

  const confirmUpdate = () => {
    setUpdateConfirmOpen(false);
    void runAction("update");
  };

  const gw = status ? gatewayLine(status, t) : null;
  const updateRunning = activeAction === "update" && isRunning;

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="text-2xl text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground max-w-prose">
        These metrics describe your{" "}
        <span className="font-medium text-foreground">cloud computer</span> —
        the remote environment where this Work4You agent runs, not your local
        laptop or phone. Restart the gateway from{" "}
        <Link to="/channels" className="underline hover:text-foreground">
          Messaging
        </Link>{" "}
        when channels need to reconnect.
      </p>

      {status && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.app.gatewayStatusLabel}
              </span>
              <div className={cn("font-medium", gw?.tone)}>{gw?.label ?? "—"}</div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.app.activeSessionsLabel}
              </span>
              <div className="tabular-nums">{status.active_sessions}</div>
            </div>
            <div className="ml-auto">
              <Link
                to="/sessions"
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                {t.app.statusOverview}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        cancelLabel={t.common.cancel}
        confirmLabel={t.status.updateWork4YouConfirmNow ?? "Update now"}
        description={updateConfirmDescription}
        loading={pendingAction === "update" || updateConfirmChecking}
        onCancel={() => setUpdateConfirmOpen(false)}
        onConfirm={confirmUpdate}
        open={updateConfirmOpen}
        title={
          t.status.updateWork4YouConfirmTitle ?? `${t.status.updateWork4You}?`
        }
      />

      {activeAction === "update" && actionStatus && (
        <div className="border border-border bg-background-base/50">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {actionStatus.running ? (
                <Spinner className="shrink-0 text-[0.875rem] text-warning" />
              ) : actionStatus.exit_code === 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
              <span className="truncate text-xs font-medium tracking-wide">
                {t.status.updateWork4You}
              </span>
              <Badge
                tone={
                  actionStatus.running
                    ? "warning"
                    : actionStatus.exit_code === 0
                      ? "success"
                      : "destructive"
                }
                className="text-xs shrink-0"
              >
                {actionStatus.running
                  ? t.status.running
                  : actionStatus.exit_code === 0
                    ? t.status.actionFinished
                    : `${t.status.actionFailed} (${actionStatus.exit_code ?? "?"})`}
              </Badge>
            </div>
            <Button
              ghost
              size="icon"
              onClick={dismissLog}
              className="shrink-0"
              aria-label={t.common.close}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <pre className="max-h-48 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {actionStatus.lines.length > 0
              ? actionStatus.lines.join("\n")
              : t.status.waitingForOutput}
          </pre>
        </div>
      )}

      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                OS
              </div>
              <div>
                {stats?.os} {stats?.os_release}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Arch
              </div>
              <div>{stats?.arch}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Host
              </div>
              <div className="truncate">{stats?.hostname}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Python
              </div>
              <div>
                {stats?.python_impl} {stats?.python_version}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Server className="h-3 w-3" /> Work4You
              </div>
              <div className="flex items-center gap-2">
                <span>v{stats?.work4you_version ?? status?.version}</span>
                {updateInfo &&
                  (updateInfo.update_available ? (
                    <Badge tone="warning">
                      {updateInfo.behind && updateInfo.behind > 0
                        ? `${updateInfo.behind} behind`
                        : "update available"}
                    </Badge>
                  ) : updateInfo.behind === 0 ? (
                    <Badge tone="success">latest</Badge>
                  ) : null)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3" /> CPU
              </div>
              <div>
                {stats?.cpu_count ?? "—"} cores
                {typeof stats?.cpu_percent === "number"
                  ? ` · ${stats.cpu_percent.toFixed(0)}%`
                  : ""}
              </div>
            </div>
            {stats?.memory && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Memory
                </div>
                <div>
                  {formatBytes(stats.memory.used)} /{" "}
                  {formatBytes(stats.memory.total)} ({stats.memory.percent}%)
                </div>
              </div>
            )}
            {stats?.disk && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> Disk
                </div>
                <div>
                  {formatBytes(stats.disk.used)} /{" "}
                  {formatBytes(stats.disk.total)} ({stats.disk.percent}%)
                </div>
              </div>
            )}
            {typeof stats?.uptime_seconds === "number" && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Uptime
                </div>
                <div>{formatDuration(stats.uptime_seconds)}</div>
              </div>
            )}
            {stats?.load_avg && stats.load_avg.length >= 3 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Load avg
                </div>
                <div>
                  {stats.load_avg.map((n) => n.toFixed(2)).join(" / ")}
                </div>
              </div>
            )}
          </div>
          {stats && !stats.psutil && (
            <p className="mt-3 text-xs text-muted-foreground">
              Install the <span className="font-mono">psutil</span> extra for
              CPU / memory / disk metrics on the cloud computer.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              size="sm"
              ghost
              disabled={checkingUpdate || updateRunning}
              prefix={
                checkingUpdate ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <RotateCw className="h-3.5 w-3.5" />
                )
              }
              onClick={() => void checkForUpdate(true)}
            >
              Check for updates
            </Button>
            {canUpdateWork4You &&
              updateInfo?.update_available &&
              updateInfo.can_apply && (
                <Button
                  size="sm"
                  disabled={isBusy}
                  prefix={<Download className="h-3.5 w-3.5" />}
                  onClick={() => setUpdateConfirmOpen(true)}
                >
                  {updateRunning
                    ? t.status.updatingWork4You
                    : t.status.updateWork4You}
                </Button>
              )}
            {updateInfo?.message && (
              <span className="text-xs text-muted-foreground max-w-prose">
                {updateInfo.message}
                {updateInfo.update_command &&
                updateInfo.update_command !== "managed outside dashboard" ? (
                  <>
                    {" "}
                    <span className="font-mono">{updateInfo.update_command}</span>
                  </>
                ) : null}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
