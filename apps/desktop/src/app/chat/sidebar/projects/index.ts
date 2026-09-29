// Public surface of the project sidebar, consumed by the sidebar root.
export { orderProjectsByIds, PROJECT_PREVIEW_COUNT, projectTreeCwd, sortProjectsForOverview } from './model'
export { ProjectOverviewRow } from './overview-row'
export { ProjectMenu } from './project-menu'
export { SidebarWorkspaceGroup } from './workspace-group'
export {
  excludeProjectSessions,
  liveSessionProjectId,
  overlayLivePreviews,
  sessionRecency,
  type SidebarProjectTree,
  type SidebarSessionGroup,
  type SidebarWorkspaceTree
} from './workspace-groups'
