import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Copy, ExternalLink } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'

import { ApiServerConnectSteps } from './api-server-connect-steps'
import {
  apiServerBaseUrl,
  apiServerIsNetworkExposed,
  apiServerModelName,
  generateApiServerKey,
  OPEN_WEBUI_GUIDE_URL
} from './api-server-endpoint'
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
import { validateMessagingEnv } from './validate-env'

/** The API server's page: the step-by-step first setup until it is set up,
 *  then its settings as blocks — Endpoint (the base URL to copy), Access (the
 *  key and the browser apps allowed to call it), Connect your tool, Advanced —
 *  over the "Channel active" switch. Nobody talks to it, so there is no "Who
 *  can talk" here: the key is the access. */
export function ApiServerDetail({
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
  const s = m.apiServerPage
  // First setup: nothing saved and the channel off. Once set up the page is
  // the endpoint's settings, and the steps can be run again. Local state, so
  // a list refresh behind the steps never dismisses them.
  const [steps, setSteps] = useState(!platform.enabled && !platform.configured)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState<'key' | 'origins' | null>(null)

  if (steps) {
    return (
      <ApiServerConnectSteps
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

  const baseUrl = apiServerBaseUrl(platform.env_vars)
  const model = apiServerModelName(platform.env_vars, scopeProfile)
  const key = platform.env_vars.find(field => field.key === 'API_SERVER_KEY')
  const origins = splitList(envValue(platform, 'API_SERVER_CORS_ORIGINS'))

  const saved = () => {
    setEditing(null)
    onQuickSetupApplied()
  }

  async function copyBaseUrl() {
    try {
      await navigator.clipboard.writeText(baseUrl)
      notify({ kind: 'success', message: t.common.copied })
    } catch (copyError) {
      notifyError(copyError, t.common.copyFailed)
    }
  }

  return (
    <div className="space-y-4">
      <SettingsBlock title={s.endpointTitle}>
        <ConnectionRow
          actions={
            <Button onClick={() => void copyBaseUrl()} size="xs" variant="text">
              <Copy />
              {s.copyBaseUrl}
            </Button>
          }
          connectedLabel={m.stateListening}
          meta={baseUrl}
          onRunSteps={() => setSteps(true)}
          onTest={onTest}
          platform={platform}
          restartButton="restart"
          testing={saving === `test:${platform.id}`}
        >
          {apiServerIsNetworkExposed(platform.env_vars) && (
            <p className="mt-2 text-xs leading-4 text-amber-500">{s.networkExposed}</p>
          )}
        </ConnectionRow>
      </SettingsBlock>

      <SettingsBlock title={s.accessTitle}>
        {/* Two facts, one line each, like the other blocks; an editor opens
            in place of its line. */}
        <div>
          {editing === 'key' ? (
            <div className="py-1.5">
              <EnvValueEditor
                envKey="API_SERVER_KEY"
                generate={{ label: s.generateKey, make: generateApiServerKey }}
                help={s.keyHelp}
                isSet={Boolean(key?.is_set)}
                label={s.keyLabel}
                onCancel={() => setEditing(null)}
                onSaved={saved}
                placeholder={s.keyPlaceholder}
                platform={platform}
                requiredMessage={s.keyRequired}
                scopeProfile={scopeProfile}
                validate={value => (validateMessagingEnv('API_SERVER_KEY', value) ? m.envErrors.apiServerKey : null)}
              />
            </div>
          ) : (
            <FactsRow
              action={
                <Button onClick={() => setEditing('key')} size="xs" variant="text">
                  {s.replaceKey}
                </Button>
              }
              facts={[{ label: s.keyLabel, value: key?.redacted_value ?? undefined }]}
            />
          )}
          {editing === 'origins' ? (
            <div className="py-1.5">
              <EnvValueEditor
                envKey="API_SERVER_CORS_ORIGINS"
                help={s.originsHelp}
                isSet={origins.length > 0}
                label={s.originsLabel}
                onCancel={() => setEditing(null)}
                onSaved={saved}
                placeholder="https://chat.example.com"
                platform={platform}
                scopeProfile={scopeProfile}
                validate={value => {
                  const invalid = validateMessagingEnv('API_SERVER_CORS_ORIGINS', value)

                  return invalid?.code === 'apiServerCorsOrigin' ? m.envErrors.apiServerCorsOrigin(invalid.value) : null
                }}
                value={origins.join(', ')}
              />
            </div>
          ) : (
            <FactsRow
              action={
                <Button onClick={() => setEditing('origins')} size="xs" variant="text">
                  {m.edit}
                </Button>
              }
              facts={[{ label: s.browserApps, value: origins.length > 0 ? origins.join(', ') : s.browserAppsNone }]}
            />
          )}
        </div>
      </SettingsBlock>

      <SettingsBlock title={s.connectTitle}>
        <FactsRow
          action={
            <Button onClick={() => openExternalLink(OPEN_WEBUI_GUIDE_URL)} size="xs" variant="text">
              <ExternalLink />
              {s.openGuide}
            </Button>
          }
          facts={[{ label: s.modelLabel, value: model }, { label: s.openAiCompatible }]}
        />
      </SettingsBlock>

      <AdvancedSection hint={s.advancedHint} onOpenChange={setShowAdvanced} open={showAdvanced}>
        <MessagingFields
          edits={edits}
          fieldErrors={fieldErrors}
          fields={platform.env_vars.filter(field => field.key !== 'API_SERVER_KEY')}
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
