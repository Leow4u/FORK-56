import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { PetThumb } from '@/components/pet/pet-thumb'
import { BotFace } from '@/components/ui/bot-face'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { ColorSwatches } from '@/components/ui/color-swatches'
import { GlyphSpinner } from '@/components/ui/glyph-spinner'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import {
  generateAvatarImage,
  normalizeAvatarImage,
  pickAvatarFile,
  probeImageGeneration,
  readAvatarFile
} from '@/lib/avatar-image'
import {
  AVATAR_COLORS,
  AVATAR_PICKER_SHAPES,
  BLOB_KINDS,
  blobShapeString,
  defaultShapeFor,
  isBlobShape,
  parseBlobShape
} from '@/lib/bot-avatar'
import { cn } from '@/lib/utils'
import { $petGallery, $petGalleryStatus, loadPetGallery, loadPetThumb, rankedGalleryPets } from '@/store/pet-gallery'

import { useGatewayRequest } from '../gateway/hooks/use-gateway-request'

// The avatar picker of the New profile dialog: the same four ways the
// WorkBots editor offers to give a bot a face. Bot = a shape and a color
// drawn by the shared face engine; Generate = the gateway's image backend
// draws one; Upload = a picture from the device; Pet = a petdex companion's
// idle frame. The dialog owns the picked values and saves them on create.

export type AvatarTab = 'bot' | 'generate' | 'pet' | 'upload'

export interface AvatarPickerProps {
  /** Picked color, or null to let the name roll a hue. */
  color: null | string
  /** Picked picture (a data URL), or null for the drawn face. */
  image: null | string
  /** The profile name being created; the drawn face follows it. */
  name: string
  onColor: (color: null | string) => void
  onImage: (image: null | string) => void
  onShape: (shape: string) => void
  /** Picked shape, or null to let the name roll one. */
  shape: null | string
}

const TILE_CLASS = 'grid size-11 place-items-center rounded-md transition-colors hover:bg-(--chrome-action-hover)'
const HINT_CLASS = 'text-center text-[0.6875rem] leading-4 text-(--ui-text-tertiary)'

export function AvatarPicker({ color, image, name, onColor, onImage, onShape, shape }: AvatarPickerProps) {
  const { t } = useI18n()
  const copy = t.profiles.avatar
  const { requestGateway } = useGatewayRequest()
  const [tab, setTab] = useState<AvatarTab>('bot')
  const [message, setMessage] = useState<null | string>(null)
  const faceName = name.trim() || 'agent'
  // What the shape grid highlights: the pick, else what the name rolls.
  const shownShape = shape ?? defaultShapeFor(faceName)
  const shownColor = color ?? AVATAR_COLORS[7]

  const pickShape = (next: string) => {
    onImage(null)
    onShape(next)
  }

  const upload = async () => {
    const file = await pickAvatarFile()

    if (!file) {
      return
    }

    const raw = await readAvatarFile(file)

    if (!raw) {
      setMessage(copy.imageTooLarge)

      return
    }

    setMessage(null)
    onImage(await normalizeAvatarImage(raw))
  }

  return (
    <div className="grid w-full min-w-0 justify-items-center gap-3" data-slot="avatar-picker">
      <SegmentedControl
        onChange={setTab}
        options={[
          { id: 'bot', label: copy.tabs.bot },
          { id: 'generate', label: copy.tabs.generate },
          { id: 'upload', label: copy.tabs.upload },
          { id: 'pet', label: copy.tabs.pet }
        ]}
        value={tab}
      />

      {image ? (
        <Button onClick={() => onImage(null)} size="sm" type="button" variant="ghost">
          {copy.removeImage}
        </Button>
      ) : null}

      {tab === 'bot' ? (
        isBlobShape(shape) ? (
          <BlobControls color={shownColor} name={faceName} onShape={pickShape} shape={shape} />
        ) : (
          <div className="grid justify-items-center gap-3">
            <div className="grid grid-cols-[repeat(5,2.75rem)] gap-1.5" role="group">
              {['blobatar', ...AVATAR_PICKER_SHAPES].map(option => (
                <button
                  aria-label={option === 'blobatar' ? copy.blobFace : copy.shape(option)}
                  aria-pressed={option === shownShape && !image}
                  className={cn(TILE_CLASS, option === shownShape && !image && 'ring-1 ring-(--ui-accent)')}
                  data-shape={option}
                  key={option}
                  onClick={() => pickShape(option)}
                  type="button"
                >
                  <BotFace color={shownColor} name={faceName} shape={option} size={32} />
                </button>
              ))}
            </div>
            <ColorSwatches
              clearLabel={t.profiles.autoColor}
              onChange={onColor}
              swatches={AVATAR_COLORS}
              swatchLabel={t.profiles.setColor}
              value={color}
            />
          </div>
        )
      ) : null}

      {tab === 'generate' ? (
        <GenerateTab name={faceName} onImage={onImage} onMessage={setMessage} request={requestGateway} />
      ) : null}

      {tab === 'upload' ? (
        <Button className="w-full justify-center" onClick={() => void upload()} type="button" variant="secondary">
          <Codicon className="mr-1 text-[0.8rem]" name="device-camera" />
          {copy.chooseImage}
        </Button>
      ) : null}

      {tab === 'pet' ? <PetTab onImage={onImage} onMessage={setMessage} request={requestGateway} /> : null}

      {message ? (
        <p className={cn(HINT_CLASS, 'text-destructive')} role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}

// ── blob faces: six silhouettes, a random seed, and a lock ──────────────────

function BlobControls({
  color,
  name,
  onShape,
  shape
}: {
  color: string
  name: string
  onShape: (shape: string) => void
  shape: string
}) {
  const { t } = useI18n()
  const copy = t.profiles.avatar
  const { kind, seedPart } = parseBlobShape(shape, name)
  const locked = Boolean(seedPart)

  return (
    <div className="grid justify-items-center gap-3">
      <div className="grid grid-cols-[repeat(4,2.75rem)] gap-1.5" role="group">
        {['' as const, ...BLOB_KINDS].map(option => (
          <button
            aria-label={option || copy.blobAutoHint}
            aria-pressed={option === kind}
            className={cn(TILE_CLASS, option === kind && 'ring-1 ring-(--ui-accent)')}
            key={option || 'auto'}
            onClick={() => onShape(blobShapeString(seedPart, option))}
            type="button"
          >
            {option ? (
              <BotFace color={color} name={name} shape={blobShapeString(seedPart, option)} size={32} />
            ) : (
              <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.blobAuto}</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Button
          onClick={() => onShape(blobShapeString(Math.random().toString(36).slice(2, 10), kind))}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Codicon className="mr-1 text-[0.8rem]" name="refresh" />
          {copy.randomize}
        </Button>
        <Button
          onClick={() => onShape(blobShapeString(locked ? '' : name, kind))}
          size="sm"
          title={locked ? copy.unlockHint : copy.lockHint}
          type="button"
          variant="ghost"
        >
          <Codicon className="mr-1 text-[0.8rem]" name={locked ? 'unlock' : 'lock'} />
          {locked ? copy.unlockFace : copy.lockFace}
        </Button>
      </div>
      <p className={HINT_CLASS}>{locked ? copy.faceLocked : copy.faceFollowsName}</p>
      <Button
        className="text-(--ui-text-secondary)"
        onClick={() => onShape(defaultShapeFor(name))}
        size="sm"
        type="button"
        variant="ghost"
      >
        {copy.classicShapes}
      </Button>
    </div>
  )
}

// ── generate: the gateway's image backend draws the face ────────────────────

type ImagenState = 'checking' | 'missing' | 'ready'

function GenerateTab({
  name,
  onImage,
  onMessage,
  request
}: {
  name: string
  onImage: (image: string) => void
  onMessage: (message: null | string) => void
  request: ReturnType<typeof useGatewayRequest>['requestGateway']
}) {
  const { t } = useI18n()
  const copy = t.profiles.avatar
  const [imagen, setImagen] = useState<ImagenState>('checking')
  const [describe, setDescribe] = useState('')
  const [busy, setBusy] = useState(false)

  // Probed on every visit: the gateway may have restarted with an image
  // backend since the last look.
  useEffect(() => {
    let alive = true

    void probeImageGeneration(request).then(available => {
      if (alive) {
        setImagen(available ? 'ready' : 'missing')
      }
    })

    return () => {
      alive = false
    }
  }, [request])

  const generate = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    onMessage(null)

    try {
      const image = await generateAvatarImage(request, { describe, name })

      onImage(await normalizeAvatarImage(image))
    } catch (error) {
      onMessage(`${copy.generateFailed}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  if (imagen !== 'ready') {
    return (
      <p className={cn(HINT_CLASS, 'px-2 py-3')} role="status">
        {imagen === 'missing' ? copy.noImageModel : copy.checkingImageModel}
      </p>
    )
  }

  return (
    <div className="grid w-full gap-2">
      <Textarea
        aria-label={copy.describe}
        className="min-h-16 text-xs"
        onChange={event => setDescribe(event.target.value)}
        placeholder={copy.describe}
        value={describe}
      />
      <Button
        className="w-full justify-center"
        disabled={busy}
        onClick={() => void generate()}
        type="button"
        variant="secondary"
      >
        {busy ? (
          <GlyphSpinner className="mr-1 text-[0.8rem]" spinner="breathe" />
        ) : (
          <Codicon className="mr-1 text-[0.8rem]" name="sparkle" />
        )}
        {busy ? copy.generating : copy.generate}
      </Button>
      {describe.trim() ? null : <p className={HINT_CLASS}>{copy.generateHint}</p>}
    </div>
  )
}

// ── pet: a petdex companion's idle frame as the picture ─────────────────────

function PetTab({
  onImage,
  onMessage,
  request
}: {
  onImage: (image: string) => void
  onMessage: (message: null | string) => void
  request: ReturnType<typeof useGatewayRequest>['requestGateway']
}) {
  const { t } = useI18n()
  const copy = t.profiles.avatar
  const gallery = useStore($petGallery)
  const status = useStore($petGalleryStatus)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<null | string>(null)

  useEffect(() => {
    void loadPetGallery(request)
  }, [request])

  const pets = rankedGalleryPets(gallery, query)

  if (status === 'loading' && !gallery) {
    return (
      <div className="flex justify-center py-4">
        <GlyphSpinner className="text-(--ui-text-tertiary)" spinner="breathe" />
      </div>
    )
  }

  if (!gallery?.pets.length) {
    return <p className={cn(HINT_CLASS, 'px-2 py-3')}>{copy.noPets}</p>
  }

  const pick = async (slug: string, url?: string) => {
    setSelected(slug)
    onMessage(null)

    const frame = await loadPetThumb(request, slug, url)

    if (frame) {
      onImage(frame)
    } else {
      setSelected(null)
      onMessage(copy.petFailed)
    }
  }

  return (
    <div className="grid w-full gap-2">
      <p className={HINT_CLASS}>{copy.petPick}</p>
      <Input
        aria-label={copy.petSearch(gallery.pets.length)}
        className="h-7 text-xs"
        onChange={event => setQuery(event.target.value)}
        placeholder={copy.petSearch(gallery.pets.length)}
        value={query}
      />
      {pets.length === 0 ? (
        <p className={cn(HINT_CLASS, 'py-3')}>{copy.noPetsMatch}</p>
      ) : (
        <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto" role="group">
          {pets.map(pet => (
            <button
              aria-pressed={selected === pet.slug}
              className={cn(
                'grid justify-items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-(--chrome-action-hover)',
                selected === pet.slug && 'ring-1 ring-(--ui-accent)'
              )}
              key={pet.slug}
              onClick={() => void pick(pet.slug, pet.spritesheetUrl)}
              type="button"
            >
              <PetThumb
                alt={pet.displayName}
                load={(slug, url) => loadPetThumb(request, slug, url)}
                slug={pet.slug}
                url={pet.spritesheetUrl}
              />
              <span className="w-full truncate text-center text-[0.625rem] text-(--ui-text-tertiary)">
                {pet.displayName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
