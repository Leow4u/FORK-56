import { Button } from '@/components/ui/button'
import { Field, FieldHint } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tip } from '@/components/ui/tooltip'
import { type Translations, useI18n } from '@/i18n'
import { ExternalLink, Trash2 } from '@/lib/icons'
import type { MessagingEnvVarInfo, PairingUser } from '@/work4you'

import { CREDENTIAL_CONTROL_CLASS } from '../settings/credential-key-ui'

/** Stable row identity: a user id is only unique within its platform. */
export const pairingKey = (user: PairingUser) => `${user.platform}:${user.user_id}`

export const pairingLabel = (user: PairingUser) => user.user_name || user.user_id

/** Env keys with a small closed set of valid values render as a segmented
 *  picker instead of a free-text input — nobody should have to guess that
 *  "self-chat" or "pairing" are the magic words. */
const FIELD_OPTIONS: Record<string, string[]> = {
  WHATSAPP_DM_POLICY: ['pairing', 'allowlist', 'open', 'disabled'],
  WHATSAPP_MODE: ['bot', 'self-chat']
}

const FIELD_COPY: Record<string, { advanced?: boolean }> = {
  TELEGRAM_PROXY: { advanced: true },
  DISCORD_REPLY_TO_MODE: { advanced: true },
  DISCORD_ALLOW_ALL_USERS: { advanced: true },
  DISCORD_HOME_CHANNEL: { advanced: true },
  DISCORD_HOME_CHANNEL_NAME: { advanced: true },
  BLUEBUBBLES_ALLOW_ALL_USERS: { advanced: true },
  MATTERMOST_ALLOW_ALL_USERS: { advanced: true },
  MATTERMOST_HOME_CHANNEL: { advanced: true },
  QQ_ALLOW_ALL_USERS: { advanced: true },
  QQBOT_HOME_CHANNEL: { advanced: true },
  QQBOT_HOME_CHANNEL_NAME: { advanced: true },
  // Quick setup writes the bind from its "who can reach the bot" choice, so
  // the raw host/port only matter when a port is already taken.
  TEAMS_HOST: { advanced: true },
  TEAMS_PORT: { advanced: true },
  WHATSAPP_ENABLED: { advanced: true },
  WHATSAPP_MODE: { advanced: true }
}

export function fieldCopy(field: MessagingEnvVarInfo, m: Translations['messaging']) {
  const copy = FIELD_COPY[field.key] || {}
  const localized = m.fieldCopy[field.key] || {}

  return {
    label: localized.label || field.prompt || field.key,
    help: localized.help || field.description,
    placeholder: localized.placeholder || field.prompt,
    advanced: Boolean(copy.advanced || field.advanced)
  }
}

export function MessagingFields({
  current,
  edits,
  fieldErrors,
  fields,
  onClear,
  onEdit,
  plainValues = false,
  saving
}: {
  current?: (field: MessagingEnvVarInfo) => null | string | undefined
  edits: Record<string, string>
  fieldErrors: Record<string, string>
  fields: MessagingEnvVarInfo[]
  onClear: (key: string) => void
  onEdit: (key: string, value: string) => void
  /** Show a saved non-secret value as it is instead of masked. */
  plainValues?: boolean
  saving: string | null
}) {
  return (
    <div className="mt-3 grid gap-1">
      {fields.map(field => (
        <MessagingField
          current={current?.(field)}
          edits={edits}
          error={fieldErrors[field.key]}
          field={field}
          key={field.key}
          onClear={onClear}
          onEdit={onEdit}
          plainValue={plainValues}
          saving={saving}
        />
      ))}
    </div>
  )
}

function MessagingField({
  current,
  edits,
  error,
  field,
  onClear,
  onEdit,
  plainValue = false,
  saving
}: {
  current?: null | string
  edits: Record<string, string>
  error?: string
  field: MessagingEnvVarInfo
  onClear: (key: string) => void
  onEdit: (key: string, value: string) => void
  plainValue?: boolean
  saving: string | null
}) {
  const { t } = useI18n()
  const m = t.messaging
  const copy = fieldCopy(field, m)
  const fieldId = `messaging-field-${field.key}`
  const options = FIELD_OPTIONS[field.key]
  // The backend redacts every saved env value, so a picker can only highlight
  // the saved choice when the platform payload mirrors it back (`current`).
  const selected = edits[field.key] || current || ''

  return (
    <Field
      htmlFor={options ? undefined : fieldId}
      label={
        <span className="flex flex-wrap items-center gap-2">
          {copy.label}
          {field.is_set && <span className="text-[0.66rem] font-normal text-primary">{m.saved}</span>}
        </span>
      }
    >
      <div className="flex items-center gap-2">
        {options ? (
          <div aria-label={copy.label} className="flex flex-wrap items-center gap-1.5" role="group">
            {options.map(option => (
              <Button
                key={option}
                onClick={() => onEdit(field.key, option)}
                size="sm"
                variant={selected === option ? 'secondary' : 'ghost'}
              >
                {m.envOptions[field.key]?.[option] || option}
              </Button>
            ))}
          </div>
        ) : (
          <Input
            className={CREDENTIAL_CONTROL_CLASS}
            id={fieldId}
            onChange={event => onEdit(field.key, event.target.value)}
            placeholder={
              field.is_set
                ? (plainValue && !field.is_password && field.value) || field.redacted_value || m.replaceValue
                : copy.placeholder
            }
            type={field.is_password ? 'password' : 'text'}
            value={edits[field.key] || ''}
          />
        )}
        {field.url && (
          <Tip label={m.openDocs}>
            <Button asChild className="size-8 shrink-0" variant="ghost">
              <a href={field.url} rel="noreferrer" target="_blank">
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </Tip>
        )}
        {field.is_set && (
          <Tip label={m.clearField(field.key)}>
            <Button
              className="size-8 shrink-0"
              disabled={saving === `clear:${field.key}`}
              onClick={() => onClear(field.key)}
              variant="ghost"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Tip>
        )}
      </div>
      {(copy.help || error) && <FieldHint error={Boolean(error)}>{error || copy.help}</FieldHint>}
    </Field>
  )
}
