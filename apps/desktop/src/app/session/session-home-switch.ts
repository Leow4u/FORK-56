import {
  composerCloudApplyPayload,
  lastCloudApplySource,
  readRememberedComposerCloudApply
} from '@/app/chat/composer/status-stack/run-target'
import { $connection } from '@/store/session'
import { CLOUD_LIST_HOME, sessionListHomeId } from '@/store/session-homes'

/** Open the backend that owns a sidebar row. Cloud and Local are modes of one gateway. */
export async function activateSessionListHome(homeId: string): Promise<void> {
  if (sessionListHomeId($connection.get()) === homeId) {
    return
  }

  const desktop = window.work4youDesktop

  if (!desktop?.applyConnectionConfig) {
    return
  }

  if (homeId === CLOUD_LIST_HOME) {
    const saved = (await desktop.getConnectionConfig?.(null).catch(() => null)) ?? null

    const source = lastCloudApplySource({
      connection: $connection.get(),
      remembered: readRememberedComposerCloudApply(),
      saved
    })

    if (!source?.remoteUrl.trim()) {
      return
    }

    await desktop.applyConnectionConfig(composerCloudApplyPayload(source))

    return
  }

  await desktop.applyConnectionConfig({ mode: 'local' })
}
