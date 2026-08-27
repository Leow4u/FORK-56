/** Whether the System (/system) operator nav entry should appear in the sidebar. */
export function showSystemAdminNav(
  dashboard: { show_system_admin?: unknown } | null | undefined,
): boolean {
  return dashboard?.show_system_admin === true;
}
