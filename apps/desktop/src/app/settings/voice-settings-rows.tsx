import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { LOCALE_META } from '@/i18n/languages'
import { Loader2, Play, Square } from '@/lib/icons'
import { prettyName } from '@/lib/text'
import { stopVoicePlayback } from '@/lib/voice-playback'
import {
  $dictationLanguage,
  appLanguageCode,
  DICTATION_LANGUAGE_NAMES,
  DICTATION_LANGUAGES,
  type DictationLanguage,
  isDictationLanguageCode,
  setDictationLanguage
} from '@/store/dictation-language'
import { notify } from '@/store/notifications'
import { speakText } from '@/work4you'

import { CONTROL_TEXT } from './constants'
import { KeybindCaps } from './keybind-settings'
import { ListRow } from './primitives'

/** The language the microphone hears, a device preference: the app
 *  language unless the user picks another (see `store/dictation-language`). */
export function DictationLanguageSetting() {
  const { locale, t } = useI18n()
  const v = t.settings.voice
  const choice = useStore($dictationLanguage)
  // Named as spoken, like the list ("Português", not the app's "Português (Brasil)").
  const appCode = appLanguageCode(locale)
  const appLanguage = isDictationLanguageCode(appCode) ? DICTATION_LANGUAGE_NAMES[appCode] : LOCALE_META[locale].name

  return (
    <ListRow
      action={
        <Select onValueChange={next => setDictationLanguage(next as DictationLanguage)} value={choice}>
          <SelectTrigger className={CONTROL_TEXT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="app">{v.dictationLanguageApp(appLanguage)}</SelectItem>
            {DICTATION_LANGUAGES.map(code => (
              <SelectItem key={code} value={code}>
                {DICTATION_LANGUAGE_NAMES[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      data-tour="field-dictation-language"
      description={v.dictationLanguageDesc}
      title={v.dictationLanguageTitle}
    />
  )
}

/** The subscription voice: OpenAI's own voices only, so a closed list read as
 *  names (Alloy, not `alloy`), with a button that speaks a line in it.
 *  `beforePreview` saves a just-picked voice first: speech reads config. */
export function SubscriptionVoiceSetting({
  beforePreview,
  label,
  onChange,
  options,
  profile,
  value
}: {
  beforePreview: () => Promise<void>
  label: string
  onChange: (voice: string) => void
  options: readonly string[]
  profile?: null | string
  value: string
}) {
  return (
    <ListRow
      action={
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <VoicePreviewButton beforePreview={beforePreview} profile={profile} />
          <div className="min-w-0 flex-1">
            <Select onValueChange={onChange} value={value}>
              <SelectTrigger className={CONTROL_TEXT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(voice => (
                  <SelectItem key={voice} value={voice}>
                    {prettyName(voice)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
      data-tour="field-tts.openai.voice"
      title={label}
    />
  )
}

type PreviewState = 'idle' | 'loading' | 'playing'

function VoicePreviewButton({
  beforePreview,
  profile
}: {
  beforePreview: () => Promise<void>
  profile?: null | string
}) {
  const { t } = useI18n()
  const v = t.settings.voice
  const [state, setState] = useState<PreviewState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setState('idle')
  }

  // Leaving the page silences the sample.
  useEffect(() => () => void audioRef.current?.pause(), [])

  const play = async () => {
    setState('loading')

    try {
      await beforePreview()
      // One voice at a time: a reply being read aloud stops for the sample.
      stopVoicePlayback()
      const { data_url } = await speakText(v.previewSample, profile)
      const audio = new Audio(data_url)
      audioRef.current = audio
      audio.addEventListener('ended', () => {
        if (audioRef.current === audio) {
          audioRef.current = null
          setState('idle')
        }
      })
      await audio.play()
      setState('playing')
    } catch {
      audioRef.current = null
      setState('idle')
      notify({ kind: 'error', message: v.previewFailed, title: v.previewVoice })
    }
  }

  return (
    <Button
      aria-label={state === 'playing' ? v.stopPreview : v.previewVoice}
      disabled={state === 'loading'}
      onClick={() => (state === 'playing' ? stop() : void play())}
      size="sm"
      type="button"
      variant="outline"
    >
      {state === 'loading' ? <Loader2 className="animate-spin" /> : state === 'playing' ? <Square /> : <Play />}
      {state === 'playing' ? v.stopPreview : v.previewVoice}
    </Button>
  )
}

/** The app's voice-conversation shortcut, rebindable here as in the keyboard
 *  shortcuts panel. Replaces `voice.record_key`, which only the terminal reads. */
export function VoiceShortcutSetting() {
  const { t } = useI18n()
  const v = t.settings.voice

  return (
    <ListRow
      action={
        <div className="flex justify-end">
          <KeybindCaps actionId="composer.voice" />
        </div>
      }
      data-tour="field-voice-shortcut"
      description={v.shortcutDesc}
      title={v.shortcutTitle}
    />
  )
}
