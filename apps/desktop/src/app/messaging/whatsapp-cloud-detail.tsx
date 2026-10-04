import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Copy } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'

import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  AllowlistEditor,
  BLOCK_ROW,
  BotDoesHereRow,
  ChannelActiveRow,
  ConnectionRow,
  envValue,
  PairingRows,
  type PlatformDetailProps,
  SettingsBlock,
  splitList,
  WhoSummaryRow
} from './channel-settings'
import { validateMessagingEnv } from './validate-env'
import { WhatsAppCloudConnectSteps } from './whatsapp-cloud-connect-steps'
import { whatsappCloudCallbackUrl } from './whatsapp-cloud-endpoint'

/** The WhatsApp Cloud API page: the step-by-step first connection until the
 *  channel is set up, then its settings as four blocks — Connection (with the
 *  callback Meta calls), Who can talk, What the bot does here, Advanced —
 *  over the "Channel active" switch. */
export function WhatsAppCloudDetail({
  approved,
  approving,
  edits,
  fieldErrors,
  hasEdits,
  onApprove,
  onClear,
  onEdit,
  onQuickSetupApplied,
  onRevoke,
  onSave,
  onTest,
  onToggle,
  pending,
  platform,
  saving,
  scopeProfile
}: PlatformDetailProps) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.whatsappCloudPage
  // First connection: the credentials not saved and the channel off. Once set
  // up the page is the channel's settings, and the steps can be run again.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)

  // The Cloud API sends no approval codes: only the numbers on the list get
  // a reply, and nobody does without one.
  const allowed = splitList(envValue(platform, 'WHATSAPP_CLOUD_ALLOWED_USERS'))
  const callbackUrl = whatsappCloudCallbackUrl(platform.env_vars)

  if (steps) {
    return (
      <WhatsAppCloudConnectSteps
        envVars={platform.env_vars}
        onApplied={onQuickSetupApplied}
        onDone={() => {
          setSteps(false)
          onQuickSetupApplied()
        }}
        scopeProfile={scopeProfile}
      />
    )
  }

  async function copyCallback() {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  // Routines do not deliver here yet: the scheduler does not take this
  // channel as a delivery target, so none is counted.
  const doesHere = [m.botReplies, platform.home_channel ? m.botAlerts : null].filter((item): item is string =>
    Boolean(item)
  )

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          testing={saving === `test:${platform.id}`}
        >
          <div className={`mt-2 ${BLOCK_ROW}`}>
            <span className="min-w-0 text-xs text-(--ui-text-tertiary) [overflow-wrap:anywhere]">
              {s.callbackLine(callbackUrl)}
            </span>
            <Button onClick={() => void copyCallback()} size="xs" variant="text">
              <Copy />
              {t.common.copy}
            </Button>
          </div>
        </ConnectionRow>
      </SettingsBlock>

      <SettingsBlock title={m.whoCanTalkTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            envKey="WHATSAPP_CLOUD_ALLOWED_USERS"
            label={m.whoCanTalkTitle}
            listDescription={s.listDesc}
            listTitle={s.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="5511999993977, 5511988880000"
            platform={platform}
            requiredMessage={s.numbersRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              const entries = splitList(list)

              if (entries.includes('*')) {
                return m.envErrors.whatsappNumber('*')
              }

              const invalid = validateMessagingEnv('WHATSAPP_CLOUD_ALLOWED_USERS', list)

              return invalid?.code === 'whatsappNumber' ? m.envErrors.whatsappNumber(invalid.value) : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => setEditing(true)}
            summary={allowed.length > 0 ? s.whoOnlyNumbers(allowed.length) : s.whoNone}
          />
        )}
        <PairingRows
          approved={approved}
          approving={approving}
          onApprove={onApprove}
          onRevoke={onRevoke}
          pending={pending}
        />
      </SettingsBlock>

      <SettingsBlock title={m.botDoesTitle}>
        <BotDoesHereRow items={doesHere} />
      </SettingsBlock>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars.filter(field => field.key !== 'WHATSAPP_CLOUD_ALLOWED_USERS')}
          onClear={onClear}
          onEdit={onEdit}
          plainValues
          saving={saving}
        />
        <AdvancedActions
          hasEdits={hasEdits}
          onRunSteps={() => setSteps(true)}
          onSave={onSave}
          platform={platform}
          saving={saving}
        />
      </AdvancedSection>

      <ChannelActiveRow hint={m.channelActiveHint} onToggle={onToggle} platform={platform} saving={saving} />
    </div>
  )
}
