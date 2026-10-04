import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Copy, Plus } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'

import { A2AConnectSteps } from './a2a-connect-steps'
import { a2aCardUrl, a2aHasInboundToken, a2aIsLocalhostOnly, generateA2AToken } from './a2a-endpoint'
import { OutboundSwitch, PeerForm, PeerRows, useA2APeers } from './a2a-peers'
import { MessagingFields } from './channel-fields'
import {
  AdvancedActions,
  AdvancedSection,
  ChannelActiveRow,
  ConnectionRow,
  EnvValueEditor,
  FactsRow,
  type PlatformDetailProps,
  SettingsBlock
} from './channel-settings'
import { validateMessagingEnv } from './validate-env'

/** A2A's page: the step-by-step first setup until there is something to
 *  show, then its settings as blocks — Be callable (the listener and its
 *  Agent Card), the peers this bot can call with the outbound tools' switch,
 *  Access (the tokens), Advanced — over the "Channel active" switch. */
export function A2ADetail({
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
  const s = m.a2aPage
  const { data, isError } = useA2APeers(scopeProfile)
  const [view, setView] = useState<'settings' | 'steps' | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingTokens, setEditingTokens] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // A2A needs no credential, so "not set up yet" is the listener off with no
  // peer. Decided once, when the peers are known, so a refresh behind the
  // steps (a peer just added) never dismisses them.
  const known = platform.enabled || data !== undefined || isError

  if (view === null && known) {
    setView(!platform.enabled && (data?.agents.length ?? 0) === 0 ? 'steps' : 'settings')
  }

  if (view === null) {
    return null
  }

  if (view === 'steps') {
    return (
      <A2AConnectSteps
        envVars={platform.env_vars}
        onApplied={onQuickSetupApplied}
        onDone={() => {
          setView('settings')
          onQuickSetupApplied()
        }}
        scopeProfile={scopeProfile}
      />
    )
  }

  const peers = data?.agents ?? []
  const cardUrl = a2aCardUrl(platform.env_vars)
  const field = (key: string) => platform.env_vars.find(entry => entry.key === key)

  const reach = [
    a2aIsLocalhostOnly(platform.env_vars) ? s.reachLocalFact : s.reachNetworkFact,
    a2aHasInboundToken(platform.env_vars) ? s.tokenRequiredFact : null
  ]
    .filter(Boolean)
    .join(' · ')

  const savedTokens = () => {
    setEditingTokens(false)
    onQuickSetupApplied()
  }

  async function copyCardUrl() {
    try {
      await navigator.clipboard.writeText(cardUrl)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  return (
    <div className="space-y-4">
      <SettingsBlock title={s.callableBlock}>
        <ConnectionRow
          actions={
            <Button onClick={() => void copyCardUrl()} size="xs" variant="text">
              <Copy />
              {s.copyCardUrl}
            </Button>
          }
          connectedLabel={m.stateListening}
          meta={reach}
          onRunSteps={() => setView('steps')}
          onTest={onTest}
          platform={platform}
          restartButton="needed"
          testing={saving === `test:${platform.id}`}
        />
      </SettingsBlock>

      <SettingsBlock title={s.peersBlock}>
        {peers.length > 0 ? (
          <PeerRows peers={peers} scopeProfile={scopeProfile} />
        ) : (
          <p className="text-[0.84375rem] text-foreground">{s.noPeers}</p>
        )}
        <OutboundSwitch className="mt-2" scopeProfile={scopeProfile}>
          <span className="flex-1" />
          {!adding && (
            <Button onClick={() => setAdding(true)} size="xs" variant="text">
              <Plus />
              {s.addPeer}
            </Button>
          )}
        </OutboundSwitch>
        {adding && (
          <PeerForm onAdded={() => setAdding(false)} onCancel={() => setAdding(false)} scopeProfile={scopeProfile} />
        )}
      </SettingsBlock>

      <SettingsBlock title={s.accessTitle}>
        {editingTokens ? (
          <div className="space-y-4 py-1.5">
            <EnvValueEditor
              envKey="A2A_BEARER_TOKEN"
              generate={{ label: s.generateToken, make: generateA2AToken }}
              help={s.tokenHelp}
              isSet={Boolean(field('A2A_BEARER_TOKEN')?.is_set)}
              label={s.sharedToken}
              onCancel={() => setEditingTokens(false)}
              onSaved={savedTokens}
              placeholder={field('A2A_BEARER_TOKEN')?.is_set ? s.tokenKept : s.tokenPlaceholder}
              platform={platform}
              scopeProfile={scopeProfile}
              validate={value => (validateMessagingEnv('A2A_BEARER_TOKEN', value) ? m.envErrors.apiServerKey : null)}
            />
            <EnvValueEditor
              envKey="A2A_PEER_TOKENS"
              help={s.peerTokensHelp}
              isSet={Boolean(field('A2A_PEER_TOKENS')?.is_set)}
              label={s.peerTokens}
              onCancel={() => setEditingTokens(false)}
              onSaved={savedTokens}
              placeholder={field('A2A_PEER_TOKENS')?.is_set ? s.tokenKept : 'alice:tok1, bob:tok2'}
              platform={platform}
              scopeProfile={scopeProfile}
              validate={value => {
                const invalid = validateMessagingEnv('A2A_PEER_TOKENS', value)

                return invalid?.code === 'a2aPeerTokens' ? m.envErrors.a2aPeerTokens(invalid.value) : null
              }}
            />
          </div>
        ) : (
          <FactsRow
            action={
              <Button onClick={() => setEditingTokens(true)} size="xs" variant="text">
                {m.edit}
              </Button>
            }
            facts={[
              { label: s.sharedToken, value: field('A2A_BEARER_TOKEN')?.is_set ? s.tokenSet : s.tokenNone },
              { label: s.peerTokens, value: field('A2A_PEER_TOKENS')?.is_set ? s.tokenSet : s.tokenNone }
            ]}
          />
        )}
      </SettingsBlock>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars.filter(
            entry => entry.key !== 'A2A_BEARER_TOKEN' && entry.key !== 'A2A_PEER_TOKENS'
          )}
          onClear={onClear}
          onEdit={onEdit}
          plainValues
          saving={saving}
        />
        <AdvancedActions
          hasEdits={hasEdits}
          onRunSteps={() => setView('steps')}
          onSave={onSave}
          platform={platform}
          saving={saving}
        />
      </AdvancedSection>

      <ChannelActiveRow hint={s.activeHint} onToggle={onToggle} platform={platform} saving={saving} />
    </div>
  )
}
