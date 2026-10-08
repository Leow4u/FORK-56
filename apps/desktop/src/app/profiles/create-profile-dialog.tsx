import { useEffect, useMemo, useState } from 'react'

import { ActionStatus } from '@/components/ui/action-status'
import { AvatarPicker } from '@/components/ui/avatar-picker'
import { BotFace } from '@/components/ui/bot-face'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldHint } from '@/components/ui/field'
import { SanitizedInput } from '@/components/ui/sanitized-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import { botAppearance } from '@/lib/bot-avatar'
import { AlertTriangle } from '@/lib/icons'
import { slug } from '@/lib/sanitize'
import { saveProfileLook } from '@/store/profile'
import type { ProfileInfo } from '@/types/work4you'
import { createProfile, updateProfileSoul } from '@/work4you'

import { isValidProfileName } from './profile-name'

/** GUI create is Fresh (blank) unless the user explicitly picks a clone source. */
export const DEFAULT_CREATE_CLONE_FROM: null | string = null

export { isValidProfileName } from './profile-name'

export type PersonaTemplateId = 'blank' | 'developer' | 'research' | 'support' | 'writer'

// Starting points for SOUL.md. Short on purpose: a template is a shape to edit
// into place, not a finished persona. Blank keeps whatever the backend seeds.
export const PERSONA_TEMPLATES: Record<PersonaTemplateId, string> = {
  blank: '',
  research:
    '# Research assistant\n\n' +
    '**Role:** researcher who answers with cited sources.\n\n' +
    '- Every factual claim comes with a link or reference.\n' +
    '- Keep answers to a few short paragraphs; lead with the finding.\n' +
    '- Say plainly when something could not be verified. Never invent data.\n' +
    '- Close with "Next steps" when there is something to act on.\n',
  writer:
    '# Writer\n\n' +
    '**Role:** editor and copywriter.\n\n' +
    '- Match the tone the user asks for; default to clear and direct.\n' +
    '- Offer two variants when the brief is open-ended.\n' +
    '- Keep sentences short. No filler, no hype words.\n',
  developer:
    '# Developer\n\n' +
    '**Role:** software engineer pairing on this codebase.\n\n' +
    '- Read the relevant code before proposing a change.\n' +
    '- Prefer the smallest diff that fixes the whole problem.\n' +
    '- Run the project’s own checks before calling work done.\n' +
    '- Explain trade-offs in one or two sentences, then decide.\n',
  support:
    '# Support\n\n' +
    '**Role:** customer support agent.\n\n' +
    '- Answer in the customer’s language, in at most three sentences.\n' +
    '- Confirm the order or account reference before any action.\n' +
    '- Escalate to a human for complaints, refunds and anything legal.\n'
}

type StartMode = 'blank' | 'copy'
type CopyScope = 'all' | 'config'

export interface ProfileCreatedOptions {
  /** True when the user asked to land in the new profile (rail only). */
  switchTo: boolean
}

// Self-contained create flow: name, persona (templates + free text), the bot's
// look (shape + color, a generated or uploaded picture, or a pet), and what to
// start from. Owns the createProfile/updateProfileSoul calls plus the look
// save, so every caller just refreshes/selects via onCreated. SOUL left blank
// keeps the cloned or seeded persona untouched; a look left untouched keeps
// the face the name rolls, the same one the rail and the roster draw.
export function CreateProfileDialog({
  onClose,
  onCreated,
  open,
  profiles = [],
  showSwitchOption = false
}: {
  onClose: () => void
  onCreated?: (name: string, options: ProfileCreatedOptions) => Promise<void> | void
  open: boolean
  profiles?: ProfileInfo[]
  /** Offer "switch to it after creating" (default on). The rail wants it; the
   *  Manage overlay just selects the new row. */
  showSwitchOption?: boolean
}) {
  const { t } = useI18n()
  const p = t.profiles
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<PersonaTemplateId>('blank')
  const [soul, setSoul] = useState('')
  const [shape, setShape] = useState<null | string>(null)
  const [color, setColor] = useState<null | string>(null)
  const [image, setImage] = useState<null | string>(null)
  const [startMode, setStartMode] = useState<StartMode>('blank')
  const [cloneFrom, setCloneFrom] = useState<null | string>(DEFAULT_CREATE_CLONE_FROM)
  const [copyScope, setCopyScope] = useState<CopyScope>('config')
  const [switchTo, setSwitchTo] = useState(true)
  const [status, setStatus] = useState<'done' | 'idle' | 'saving'>('idle')
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setName('')
    setTemplate('blank')
    setSoul('')
    setShape(null)
    setColor(null)
    setImage(null)
    setStartMode('blank')
    setCloneFrom(DEFAULT_CREATE_CLONE_FROM)
    setCopyScope('config')
    setSwitchTo(true)
    setError(null)
    setStatus('idle')
  }, [open])

  const trimmed = name.trim()
  const invalid = trimmed !== '' && !isValidProfileName(trimmed)
  const busy = status === 'saving' || status === 'done'
  const copying = startMode === 'copy'
  // The preview is the bot the profile will be, drawn by the same engine as the
  // rail: a pick wins, else the typed name rolls the shape and the hue.
  const previewName = trimmed || 'agent'
  const preview = botAppearance(previewName, { color, custom: true, image, shape })
  const lookPicked = shape !== null || color !== null || image !== null

  const templateOptions = useMemo(
    () =>
      (Object.keys(PERSONA_TEMPLATES) as PersonaTemplateId[]).map(id => ({
        id,
        label: p.personaTemplates[id]
      })),
    [p]
  )

  const applyTemplate = (id: PersonaTemplateId) => {
    setTemplate(id)
    setSoul(PERSONA_TEMPLATES[id])
  }

  // Switching to "Copy from" preselects the default profile (else the first
  // one) so the common "start from my default" case is one click, not two.
  const changeStartMode = (mode: StartMode) => {
    setStartMode(mode)

    if (mode === 'copy' && !cloneFrom) {
      setCloneFrom(profiles.find(profile => profile.is_default)?.name ?? profiles[0]?.name ?? null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!trimmed || invalid) {
      setError(invalid ? p.invalidName(p.nameHint) : p.nameRequired)

      return
    }

    if (copying && !cloneFrom) {
      setError(p.startCopy)

      return
    }

    setStatus('saving')
    setError(null)

    try {
      await createProfile({
        name: trimmed,
        clone_from: copying ? cloneFrom : null,
        clone_all: copying && copyScope === 'all',
        no_skills: false
      })

      if (soul.trim()) {
        await updateProfileSoul(trimmed, soul)
      }

      if (lookPicked) {
        await saveProfileLook(trimmed, { color, image, shape })
      }

      await onCreated?.(trimmed, { switchTo: showSwitchOption && switchTo })
      setStatus('done')
      window.setTimeout(onClose, 800)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : p.failedCreate)
    }
  }

  return (
    <Dialog onOpenChange={value => !value && !busy && onClose()} open={open}>
      <DialogContent bodyClassName="profile-creation-shell" data-profile-creation="">
        <DialogHeader className="profile-creation-header">
          <DialogTitle>{p.newProfile}</DialogTitle>
          <DialogDescription>{p.createDesc}</DialogDescription>
        </DialogHeader>
        <form className="profile-creation-form" onSubmit={handleSubmit}>
          <fieldset className="profile-creation-body profile-creation-columns" disabled={busy}>
            <div className="profile-creation-appearance">
              <div aria-hidden="true" className="profile-creation-preview" data-slot="profile-preview">
                <BotFace
                  color={preview.color}
                  image={preview.image}
                  name={previewName}
                  shape={preview.shape}
                  size={144}
                />
              </div>
              <AvatarPicker
                color={color}
                image={image}
                name={trimmed}
                onColor={setColor}
                onImage={setImage}
                onShape={setShape}
                presentation="creation"
                shape={shape}
              />
              <FieldHint>{p.createAppearanceHint}</FieldHint>
            </div>
            <div className="profile-creation-fields">
              <Field htmlFor="new-profile-name" label={p.nameLabel}>
                <SanitizedInput
                  aria-invalid={invalid}
                  autoFocus
                  id="new-profile-name"
                  onValueChange={setName}
                  placeholder="my-profile"
                  sanitize={slug}
                  value={name}
                />
                <FieldHint error={invalid}>{p.nameHint}</FieldHint>
              </Field>
              <Field label={p.startFrom}>
                <SegmentedControl
                  className="profile-creation-choice"
                  onChange={changeStartMode}
                  options={[
                    { id: 'blank', label: p.startBlank },
                    { id: 'copy', label: p.startCopy }
                  ]}
                  value={startMode}
                />
                {copying && (
                  <>
                    <Select onValueChange={setCloneFrom} value={cloneFrom ?? undefined}>
                      <SelectTrigger aria-label={p.startCopy} id="new-profile-clone-from">
                        <SelectValue placeholder={p.cloneFromNone} />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map(profile => (
                          <SelectItem key={profile.name} value={profile.name}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <SegmentedControl
                      onChange={setCopyScope}
                      options={[
                        { id: 'config', label: p.copyScope.config },
                        { id: 'all', label: p.copyScope.all }
                      ]}
                      value={copyScope}
                    />
                    <FieldHint>{p.copyHint}</FieldHint>
                  </>
                )}
              </Field>
              <Field htmlFor="new-profile-soul" label={p.personaLabel} optional optionalLabel={p.soulOptional}>
                <div className="profile-creation-templates flex flex-wrap gap-2">
                  {templateOptions.map(option => (
                    <Button
                      aria-pressed={template === option.id}
                      key={option.id}
                      onClick={() => applyTemplate(option.id)}
                      size="sm"
                      type="button"
                      variant={template === option.id ? 'default' : 'outline'}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  className="profile-creation-persona"
                  id="new-profile-soul"
                  onChange={event => setSoul(event.target.value)}
                  placeholder={p.personaPrompt}
                  value={soul}
                />
              </Field>
            </div>
          </fieldset>
          <div className="profile-creation-bottom">
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <DialogFooter className="items-center sm:justify-between">
              {showSwitchOption ? (
                <label className="flex items-center gap-2 text-xs text-(--ui-text-secondary)">
                  <Checkbox
                    aria-label={p.switchAfterCreate}
                    checked={switchTo}
                    disabled={busy}
                    onCheckedChange={checked => setSwitchTo(checked === true)}
                  />
                  {p.switchAfterCreate}
                </label>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button disabled={busy} onClick={onClose} type="button" variant="ghost">
                  {t.common.cancel}
                </Button>
                <Button disabled={busy || !trimmed || invalid || (copying && !cloneFrom)} type="submit">
                  <ActionStatus busy={p.creating} done={p.created} idle={p.createAction} state={status} />
                </Button>
              </div>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
