/** Whether the Keys (/env) operator nav entry should appear in the sidebar. */
export function showEnvAdminNav(
  dashboard: { show_env_admin?: unknown } | null | undefined,
): boolean {
  return dashboard?.show_env_admin === true;
}
