import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
import { SlackConnectSteps, useCopySlackManifest } from './slack-connect-steps'
import { validateMessagingEnv } from './validate-env'

/** Slack's page: the step-by-step first connection until the channel is set
 *  up, then its settings as four blocks — Connection, Who can talk, What the
 *  bot does here, Advanced — over the "Channel active" switch. */
export function SlackDetail({
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
  const s = m.slackPage
  const cs = m.channelSettings
  const copyManifest = useCopySlackManifest()
  // First connection: no tokens saved and the channel off. Once set up the
  // page is the channel's settings, and the steps can be run again from it.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // Slack answers nobody without a list and its DMs get no approval codes;
  // `*` lets the whole workspace in.
  const allowed = splitList(envValue(platform, 'SLACK_ALLOWED_USERS'))
  const everyone = allowed.includes('*')

  if (steps) {
    return (
      <SlackConnectSteps
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

  const summary = everyone ? s.everyoneTitle : allowed.length > 0 ? cs.whoOnlyPeople(allowed.length) : s.whoNone

  const doesHere = [
    m.botReplies,
    routines > 0 ? m.botRoutines(routines) : null,
    platform.home_channel ? m.botAlerts : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          scopeProfile={scopeProfile}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={m.whoCanTalkTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            alternative={{ description: s.everyoneDesc, id: 'everyone', title: s.everyoneTitle }}
            envKey="SLACK_ALLOWED_USERS"
            label={m.whoCanTalkTitle}
            listDescription={s.listDesc}
            listTitle={cs.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="U01ABC2DEF3, U04XYZ9GHI7"
            platform={platform}
            requiredMessage={s.idsRequired}
            scopeProfile={scopeProfile}
            validate={list => {
              const entries = splitList(list)
              const invalid = validateMessagingEnv('SLACK_ALLOWED_USERS', entries.filter(id => id !== '*').join(','))

              if (invalid?.code === 'slackMemberId') {
                return m.envErrors.slackMemberId(invalid.value)
              }

              return entries.includes('*') ? m.envErrors.slackMemberId('*') : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={!everyone && allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => setEditing(true)}
            summary={summary}
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
          fields={platform.env_vars.filter(field => field.key !== 'SLACK_ALLOWED_USERS')}
          onClear={onClear}
          onEdit={onEdit}
          plainValues
          saving={saving}
        />
        <AdvancedActions
          extra={
            <Button onClick={() => void copyManifest()} size="xs" variant="text">
              {s.copyManifest}
            </Button>
          }
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
