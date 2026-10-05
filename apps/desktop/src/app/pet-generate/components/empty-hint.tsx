import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

interface EmptyHintProps {
  onExample: (prompt: string) => void
}

// Creative seed prompts — specifics make better pets (petdex's own advice).
// Short chips that wrap into a tight, centered cluster (capped width → 2 rows).
// The chips and the prompt they send come from the catalog, so a translated
// locale seeds prompts in the user's own language.
export function EmptyHint({ onExample }: EmptyHintProps) {
  const { t } = useI18n()
  const copy = t.ui.pets

  return (
    <div className="flex max-w-[300px] flex-wrap place-content-center place-items-center gap-2">
      {copy.examples.map(example => (
        <Button
          className="h-auto w-fit rounded-full font-normal"
          key={example}
          onClick={() => onExample(copy.examplePrompt(example))}
          size="xs"
          variant="outline"
        >
          {example}
        </Button>
      ))}
    </div>
  )
}
