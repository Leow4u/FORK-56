import { useLayoutEffect } from "react";
import { usePageHeader } from "@/contexts/usePageHeader";
import { LogsPanel } from "@/components/logs-panel";

/**
 * Operator legacy route (/logs) — raw log tail for URL-reachable access when
 * `dashboard.show_logs_admin` is true. User-facing logs live in Settings →
 * Providers → Accounts (Work4You Portal section).
 */
export default function LogsPage() {
  const { setTitle, setEnd } = usePageHeader();

  useLayoutEffect(() => {
    setTitle("Logs");
    setEnd(null);
    return () => {
      setTitle(null);
      setEnd(null);
    };
  }, [setEnd, setTitle]);

  return <LogsPanel />;
}
