import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Copy } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'

import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  ChannelActiveRow,
  ConnectionRow,
  envValue,
  EnvValueEditor,
  FactsRow,
  type PlatformDetailProps,
  SettingsBlock,
  splitList
} from './channel-settings'
import { MsgraphConnectSteps } from './msgraph-connect-steps'
import { generateMsgraphClientState, msgraphNotificationUrl } from './msgraph-endpoint'
import { validateMessagingEnv } from './validate-env'

/** Values the blocks above Advanced edit in place. */
const BLOCK_KEYS = new Set([
  'MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES',
  'MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS',
  'MSGRAPH_WEBHOOK_CLIENT_STATE'
])

/** The Microsoft Graph webhook's page: the step-by-step first setup until it
 *  is set up, then its settings as blocks — Listener (the URL Graph calls),
 *  Security (the clientState secret and the source CIDRs), Notifications
 *  accepted, Advanced — over the "Channel active" switch. */
export function MsgraphDetail({
  edits,
  fieldErrors,
  hasEdits,
  onClear,
  onEdit,
  onQuickSetupApplied,
  onSave,
  onTest,
  onToggle,
  platform,
  saving,
  scopeProfile
}: PlatformDetailProps) {
  const { t } = useI18n()
  const m = t.messaging
  const s = m.msgraphPage
  // First setup: no secret saved and the channel off. Local state, so a list
  // refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [editing, setEditing] = useState<'resources' | 'security' | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (steps) {
    return (
      <MsgraphConnectSteps
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

  const notifyUrl = msgraphNotificationUrl(platform.env_vars)
  const secretSet = Boolean(platform.env_vars.find(field => field.key === 'MSGRAPH_WEBHOOK_CLIENT_STATE')?.is_set)
  const cidrs = splitList(envValue(platform, 'MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS'))
  const resources = splitList(envValue(platform, 'MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES'))

  const saved = () => {
    setEditing(null)
    onQuickSetupApplied()
  }

  const validate = (key: string, code: string, message: (value: string) => string) => (value: string) => {
    const invalid = validateMessagingEnv(key, value)

    return invalid?.code === code ? message('value' in invalid ? String(invalid.value) : value) : null
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(notifyUrl)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  return (
    <div className="space-y-4">
      <SettingsBlock title={s.listenerBlock}>
        <ConnectionRow
          actions={
            <Button onClick={() => void copyUrl()} size="xs" variant="text">
              <Copy />
              {s.copyUrl}
            </Button>
          }
          connectedLabel={m.stateListening}
          meta={notifyUrl}
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          restartButton="needed"
          scopeProfile={scopeProfile}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={s.securityTitle}>
        {editing === 'security' ? (
          <div className="space-y-4 py-1.5">
            <EnvValueEditor
              envKey="MSGRAPH_WEBHOOK_CLIENT_STATE"
              generate={{ label: s.generateSecret, make: generateMsgraphClientState }}
              isSet={secretSet}
              label={s.secretLabel}
              onCancel={() => setEditing(null)}
              onSaved={saved}
              placeholder={secretSet ? s.secretKept : s.secretPlaceholder}
              platform={platform}
              requiredMessage={s.secretRequired}
              scopeProfile={scopeProfile}
              validate={value =>
                validateMessagingEnv('MSGRAPH_WEBHOOK_CLIENT_STATE', value) ? m.envErrors.msgraphClientState : null
              }
            />
            <EnvValueEditor
              envKey="MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS"
              help={s.cidrsHelp}
              isSet={cidrs.length > 0}
              label={s.cidrsLabel}
              onCancel={() => setEditing(null)}
              onSaved={saved}
              placeholder="52.96.0.0/14, 13.107.64.0/18"
              platform={platform}
              scopeProfile={scopeProfile}
              validate={validate('MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS', 'msgraphCidr', m.envErrors.msgraphCidr)}
              value={cidrs.join(', ')}
            />
          </div>
        ) : (
          <FactsRow
            action={
              <Button onClick={() => setEditing('security')} size="xs" variant="text">
                {m.edit}
              </Button>
            }
            facts={[
              { label: s.secretLabel, value: secretSet ? s.secretSet : s.secretNone },
              { label: s.cidrsLabel, value: cidrs.length > 0 ? cidrs.join(', ') : s.cidrsNone }
            ]}
          />
        )}
      </SettingsBlock>

      <SettingsBlock title={s.acceptedTitle}>
        {editing === 'resources' ? (
          <div className="py-1.5">
            <EnvValueEditor
              envKey="MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES"
              help={s.resourcesNote}
              isSet={resources.length > 0}
              label={s.resourcesLabel}
              onCancel={() => setEditing(null)}
              onSaved={saved}
              placeholder="communications/onlineMeetings, chats/*/messages"
              platform={platform}
              scopeProfile={scopeProfile}
              value={resources.join(', ')}
            />
          </div>
        ) : (
          <FactsRow
            action={
              <Button onClick={() => setEditing('resources')} size="xs" variant="text">
                {m.edit}
              </Button>
            }
            facts={[{ label: resources.length > 0 ? resources.join(' · ') : s.everyResource }]}
          />
        )}
      </SettingsBlock>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars.filter(field => !BLOCK_KEYS.has(field.key))}
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

      <ChannelActiveRow hint={s.activeHint} onToggle={onToggle} platform={platform} saving={saving} />
    </div>
  )
}
