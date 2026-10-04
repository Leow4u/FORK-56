import { useState } from 'react'

import { useI18n } from '@/i18n'

import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  AllowlistEditor,
  BotDoesHereRow,
  ChannelActiveRow,
  ConnectionRow,
  envValue,
  PairingRows,
  type PlatformDetailProps,
  SettingsBlock,
  splitList,
  useDeliveringRoutines,
  WhoSummaryRow
} from './channel-settings'
import { SmsConnectSteps } from './sms-connect-steps'
import { validateMessagingEnv } from './validate-env'

/** The SMS (Twilio) page: the step-by-step first connection until the
 *  channel is set up, then its settings as four blocks — Connection, Who can
 *  text, What the bot does here, Advanced — over the "Channel active"
 *  switch. */
export function SmsDetail({
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
  const s = m.smsPage
  // First connection: the Twilio account not saved and the channel off. Once
  // set up the page is the channel's settings, and the steps can be run
  // again. Local state, so a list refresh behind the steps never dismisses
  // them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // A list lets only those numbers in; without one, everyone who texts gets
  // a code to approve.
  const allowed = splitList(envValue(platform, 'SMS_ALLOWED_USERS'))

  if (steps) {
    return (
      <SmsConnectSteps
        envVars={platform.env_vars}
        onApplied={onQuickSetupApplied}
        onDone={() => {
          setSteps(false)
          onQuickSetupApplied()
        }}
        platformConnected={platform.enabled && platform.state === 'connected'}
        scopeProfile={scopeProfile}
      />
    )
  }

  const doesHere = [
    s.repliesToTexts,
    routines > 0 ? m.botRoutines(routines) : null,
    platform.home_channel ? m.botAlerts : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          meta={envValue(platform, 'TWILIO_PHONE_NUMBER') || undefined}
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={s.whoCanTextTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            alternative={{ description: s.approveDesc, id: 'approve', title: s.approveTitle }}
            envKey="SMS_ALLOWED_USERS"
            label={s.whoCanTextTitle}
            listDescription={s.listDesc}
            listTitle={s.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="+5511999993977, +5511988880000"
            platform={platform}
            requiredMessage={s.numbersRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              if (splitList(list).includes('*')) {
                return m.envErrors.smsNumber('*')
              }

              const invalid = validateMessagingEnv('SMS_ALLOWED_USERS', list)

              return invalid?.code === 'smsNumber' ? m.envErrors.smsNumber(invalid.value) : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => setEditing(true)}
            summary={allowed.length > 0 ? s.whoOnlyNumbers(allowed.length) : s.approveTitle}
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
          fields={platform.env_vars.filter(field => field.key !== 'SMS_ALLOWED_USERS')}
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
