/** Whether the Config operator nav entry should appear in the sidebar. */
export function showConfigAdminNav(
  dashboard: { show_config_admin?: unknown } | null | undefined,
): boolean {
  return dashboard?.show_config_admin === true;
}
