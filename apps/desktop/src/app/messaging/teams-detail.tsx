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
  useDeliveringRoutines,
  WhoSummaryRow
} from './channel-settings'
import { STEP_NOTE } from './channel-steps'
import { TeamsConnectSteps } from './teams-connect-steps'
import { teamsMessagingEndpoint } from './teams-endpoint'
import { validateMessagingEnv } from './validate-env'

/** Microsoft Teams' page: the step-by-step first connection until the
 *  channel is set up, then its settings as four blocks — Connection (with the
 *  endpoint Azure calls), Who can talk, What the bot does here, Advanced —
 *  over the "Channel active" switch. */
export function TeamsDetail({
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
  const s = m.teamsPage
  const cs = m.channelSettings
  // First connection: the credentials not saved and the channel off. Once set
  // up the page is the channel's settings, and the steps can be run again.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(platform.home_channel), scopeProfile)

  // A list lets those people in at once; anyone else who writes privately
  // gets a code — with or without a list. `*` lets the whole tenant in.
  const allowed = splitList(envValue(platform, 'TEAMS_ALLOWED_USERS'))
  const everyone = allowed.includes('*')
  const endpoint = teamsMessagingEndpoint(platform.env_vars)

  if (steps) {
    return (
      <TeamsConnectSteps
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

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(endpoint)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  const summary = everyone ? s.everyoneTitle : allowed.length > 0 ? cs.whoOnlyPeople(allowed.length) : cs.whoApprove

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
        >
          <div className={`mt-2 ${BLOCK_ROW}`}>
            <span className="min-w-0 text-xs text-(--ui-text-tertiary) [overflow-wrap:anywhere]">
              {s.endpointLine(endpoint)}
            </span>
            <Button onClick={() => void copyEndpoint()} size="xs" variant="text">
              <Copy />
              {s.copyEndpoint}
            </Button>
          </div>
        </ConnectionRow>
      </SettingsBlock>

      <SettingsBlock title={m.whoCanTalkTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            allowEmpty
            alternative={{ description: s.everyoneDesc, id: 'everyone', title: s.everyoneTitle }}
            envKey="TEAMS_ALLOWED_USERS"
            label={m.whoCanTalkTitle}
            listDescription={s.listDesc}
            listTitle={cs.listTitle}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              onQuickSetupApplied()
            }}
            placeholder="6f1c2a9e-0b7d-4c55-9a51-2f3e4d5c6b7a"
            platform={platform}
            requiredMessage=""
            scopeProfile={scopeProfile}
            validate={list => {
              const entries = splitList(list)
              const invalid = validateMessagingEnv('TEAMS_ALLOWED_USERS', entries.filter(id => id !== '*').join(','))

              if (invalid?.code === 'teamsGuid') {
                return m.envErrors.teamsGuid(invalid.value)
              }

              return entries.includes('*') ? m.envErrors.teamsGuid('*') : null
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

      <p className={STEP_NOTE}>{s.graphNote}</p>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars.filter(field => field.key !== 'TEAMS_ALLOWED_USERS')}
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
