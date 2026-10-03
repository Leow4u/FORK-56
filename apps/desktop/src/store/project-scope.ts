import { persistentAtom } from '@/lib/persisted'

// ── Project scope (the "you're inside a project" view, mirroring profile scope)─
// The active workspace: ALL_PROJECTS means none, a concrete id means new chats
// land in that project (or stay folder-less for Home). The sidebar lists every
// project regardless — this never narrows it. Local state (localStorage),
// distinct from the durable active-project pointer in projects.db — though
// selecting a project also makes it active, exactly as selecting a profile does.
//
// Project ids belong to ONE backend's projects.db, so switching profile or
// connection must leave the scope (store/profile, store/gateway-switch). It lives
// in this dependency-light module so those stores can reset it synchronously,
// before the fresh draft resolves its cwd from it.
export const ALL_PROJECTS = '__all_projects__'

const PROJECT_SCOPE_KEY = 'work4you.desktop.projectScope'

export const $projectScope = persistentAtom<string>(PROJECT_SCOPE_KEY, ALL_PROJECTS, {
  decode: raw => raw || ALL_PROJECTS,
  encode: value => value || ALL_PROJECTS
})

export function exitProjectScope(): void {
  $projectScope.set(ALL_PROJECTS)
}
