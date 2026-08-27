import { useCallback, useEffect, useState } from "react";
import { Cpu, Download, HardDrive, RotateCw, Server } from "lucide-react";
import { Badge } from "@work4you/ui/ui/components/badge";
import { Button } from "@work4you/ui/ui/components/button";
import { Spinner } from "@work4you/ui/ui/components/spinner";
import { Card, CardContent } from "@work4you/ui/ui/components/card";
import { ConfirmDialog } from "@work4you/ui/ui/components/confirm-dialog";
import { api, type SystemStats, type UpdateCheckResponse } from "@/lib/api";

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

/** Host metrics for Settings → My Computer (cloud agent environment). */
export function CloudComputerPanel() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [canUpdateWork4You, setCanUpdateWork4You] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(
    null,
  );
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.getSystemStats(),
      api.getStatus(),
      api.checkWork4YouUpdate(false),
    ])
      .then(([st, status, upd]) => {
        if (st.status === "fulfilled") setStats(st.value);
        if (status.status === "fulfilled") {
          setCanUpdateWork4You(status.value.can_update_work4you !== false);
        }
        if (upd.status === "fulfilled") setUpdateInfo(upd.value);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkForUpdate = useCallback(async (force = false) => {
    if (!canUpdateWork4You) return;
    setCheckingUpdate(true);
    try {
      setUpdateInfo(await api.checkWork4YouUpdate(force));
    } finally {
      setCheckingUpdate(false);
    }
  }, [canUpdateWork4You]);

  const applyUpdate = async () => {
    setUpdateConfirmOpen(false);
    if (!canUpdateWork4You) return;
    try {
      const resp = await api.updateWork4You();
      if (!resp.ok) return;
    } catch {
      /* sidebar footer surfaces errors; this panel stays read-mostly */
    }
  };

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
        laptop or phone.
      </p>

      <ConfirmDialog
        open={canUpdateWork4You && updateConfirmOpen}
        onCancel={() => setUpdateConfirmOpen(false)}
        onConfirm={() => void applyUpdate()}
        title="Update Work4You?"
        description={
          updateInfo && updateInfo.behind && updateInfo.behind > 0
            ? `This will run 'work4you update' (${updateInfo.update_command}) and pull ${updateInfo.behind} new commit${updateInfo.behind === 1 ? "" : "s"}. The gateway restarts when the update finishes.`
            : `This will run 'work4you update' (${updateInfo?.update_command ?? "work4you update"}) and restart the gateway when it finishes.`
        }
        confirmLabel="Update now"
      />

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
                <span>v{stats?.work4you_version}</span>
                {canUpdateWork4You &&
                  updateInfo &&
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
          {canUpdateWork4You && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                size="sm"
                ghost
                disabled={checkingUpdate}
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
              {updateInfo?.update_available && updateInfo.can_apply && (
                <Button
                  size="sm"
                  prefix={<Download className="h-3.5 w-3.5" />}
                  onClick={() => setUpdateConfirmOpen(true)}
                >
                  Update now
                </Button>
              )}
              {updateInfo &&
                !updateInfo.can_apply &&
                updateInfo.update_available && (
                  <span className="text-xs text-muted-foreground">
                    Update with{" "}
                    <span className="font-mono">{updateInfo.update_command}</span>
                  </span>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
