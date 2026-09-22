import type { ApprovalMode, ApprovalModeRequester } from '@/store/approval-mode'
import { parseApprovalMode } from '@/store/approval-mode'

/**
 * Pin one conversation's approval mode. `session_id` keeps the write off the
 * profile `approvals.mode` that Settings and the status bar share.
 */
export async function setSessionApprovalMode(
  requestGateway: ApprovalModeRequester,
  sessionId: string,
  mode: ApprovalMode
): Promise<ApprovalMode> {
  const result = (await requestGateway('config.set', {
    key: 'approvals.mode',
    session_id: sessionId,
    value: mode
  })) as { value?: string }

  const applied = parseApprovalMode(result?.value)

  if (!applied) {
    throw new Error('approval mode rejected')
  }

  return applied
}
