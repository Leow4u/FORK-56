import { useState } from 'react'

import { useI18n } from '@/i18n'
import type { MessagingEnvVarInfo } from '@/work4you'

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
import { findInvalidWhatsAppUser } from './validate-env'
import { WhatsAppConnectSteps } from './whatsapp-connect-steps'

// WhatsApp's raw settings, in the Advanced block: every field but the
// allowlist ("Who can talk" edits it), mode and DM policy first. The
// WHATSAPP_CLOUD_* keys belong to the Cloud API channel and only reach this
// card through the catalog's WHATSAPP_ prefix match.
const WHATSAPP_ADVANCED_FIRST = ['WHATSAPP_MODE', 'WHATSAPP_DM_POLICY']

function whatsAppAdvancedFields(fields: MessagingEnvVarInfo[]): MessagingEnvVarInfo[] {
  const rank = (key: string) => {
    const index = WHATSAPP_ADVANCED_FIRST.indexOf(key)

    return index === -1 ? WHATSAPP_ADVANCED_FIRST.length : index
  }

  return fields
    .filter(field => field.key !== 'WHATSAPP_ALLOWED_USERS' && !field.key.startsWith('WHATSAPP_CLOUD_'))
    .sort((a, b) => rank(a.key) - rank(b.key))
}

/** WhatsApp's page: the step-by-step first connection until the channel is
 *  set up, then its settings as four blocks — Connection, Who can talk,
 *  What the bot does here, Advanced — over the "Channel active" switch. */
export function WhatsAppDetail({
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
  const s = m.whatsappSteps
  const setup = platform.whatsapp_setup
  // First connection: nothing saved yet and the channel off. Once set up the
  // page is the channel's settings, and the steps can be run again from it.
  // Local state, so a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !setup?.mode)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  const routines = useDeliveringRoutines(platform.id, Boolean(setup?.home_channel_set), scopeProfile)

  const policy = envValue(platform, 'WHATSAPP_DM_POLICY') || 'pairing'
  const mode = setup?.mode || envValue(platform, 'WHATSAPP_MODE')
  const selfChat = mode === 'self-chat'
  const allowed = splitList(envValue(platform, 'WHATSAPP_ALLOWED_USERS'))

  if (steps) {
    return (
      <WhatsAppConnectSteps
        onAdvanced={() => {
          setSteps(false)
          setShowAdvanced(true)
        }}
        onApplied={onQuickSetupApplied}
        onDone={() => {
          setSteps(false)
          onQuickSetupApplied()
        }}
        platformConnected={platform.enabled && platform.state === 'connected'}
        savedMode={setup?.mode}
        scopeProfile={scopeProfile}
      />
    )
  }

  const summary = selfChat
    ? m.whoSelf
    : policy === 'disabled'
      ? m.whoNobody
      : policy === 'open'
        ? m.whoAnyone
        : allowed.length > 0
          ? m.whoTeam(allowed.length)
          : m.whoApprove

  const doesHere = [
    policy === 'disabled' ? m.botNoDms : m.botReplies,
    routines > 0 ? m.botRoutines(routines) : null,
    setup?.home_channel_set ? m.botAlerts : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4">
      <SettingsBlock title={m.connectionTitle}>
        <ConnectionRow
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={m.whoCanTalkTitle}>
        {editing ? (
          <AllowlistEditor
            allowed={allowed}
            alternative={{ description: s.approveDesc, id: 'approve', title: s.approveTitle }}
            envKey="WHATSAPP_ALLOWED_USERS"
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
              const invalid = findInvalidWhatsAppUser(list)

              return invalid ? m.envErrors.whatsappNumber(invalid) : null
            }}
          />
        ) : (
          <WhoSummaryRow
            detail={!selfChat && allowed.length > 0 ? allowed.join(', ') : undefined}
            onEdit={() => (selfChat ? setSteps(true) : setEditing(true))}
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

      <AdvancedSection hint={m.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          current={field => (field.key === 'WHATSAPP_MODE' ? setup?.mode : undefined)}
          edits={edits}
          fieldErrors={fieldErrors}
          fields={whatsAppAdvancedFields(platform.env_vars)}
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

      <ChannelActiveRow hint={m.whatsappActiveHint} onToggle={onToggle} platform={platform} saving={saving} />
    </div>
  )
}
