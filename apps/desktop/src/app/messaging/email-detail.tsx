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
import { EmailConnectSteps } from './email-connect-steps'
import { findInvalidEmailSender } from './validate-env'

/** Email's page: the step-by-step first connection until the channel is set
 *  up, then its settings as four blocks — Connection, Who can write, What the
 *  bot does here, Advanced — over the "Channel active" switch. */
export function EmailDetail({
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
  const s = m.emailPage
  // First connection: the mailbox not saved and the channel off. Once set up
  // the page is the channel's settings, and the steps can be run again.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // Email has no approval codes: only the addresses on the list get a reply,
  // and nobody does without one.
  const allowed = splitList(envValue(platform, 'EMAIL_ALLOWED_USERS'))

  if (steps) {
    return (
      <EmailConnectSteps
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
    s.repliesToEmail,
    routines > 0 ? m.botRoutines(routines) : null,
    platform.home_channel ? m.botAlerts : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          connectedLabel={s.connectedLabel}
          meta={envValue(platform, 'EMAIL_ADDRESS') || undefined}
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={s.whoCanWriteTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            envKey="EMAIL_ALLOWED_USERS"
            label={s.whoCanWriteTitle}
            listDescription={s.allowedHelp}
            listTitle={s.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="ana@example.com, bruno@example.com"
            platform={platform}
            requiredMessage={s.addressesRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              // `*` would drop every email, so it is never a list entry here.
              const invalid = splitList(list).includes('*') ? '*' : findInvalidEmailSender(list)

              return invalid ? m.envErrors.emailAddress(invalid) : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => setEditing(true)}
            summary={allowed.length > 0 ? s.whoOnlyAddresses(allowed.length) : s.whoNone}
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
          fields={platform.env_vars.filter(field => field.key !== 'EMAIL_ALLOWED_USERS')}
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
