/**
 * Operator legacy route (/env) — full env monolith for URL-reachable access
 * when `dashboard.show_env_admin` is true. User-facing credentials live in
 * Settings → Providers / Tools & Keys (see env-settings-panels.tsx).
 */
import { EnvCredentialsPanel } from "@/components/env-settings-panels";

export default function EnvPage() {
  return <EnvCredentialsPanel view="operator" />;
}
