import {
  SiAnthropic,
  SiHuggingface,
  SiMinimax,
  SiNvidia,
  SiOllama,
  SiOpenrouter,
  SiX
} from '@icons-pack/react-simple-icons'
import type { ComponentType, SVGProps } from 'react'

import { useI18n } from '@/i18n'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'

import {
  CredentialDocsLink,
  credentialPlaceholder,
  friendlyFieldLabel,
  isKeyVar,
  KeyField,
  type KeyRowProps,
  type ProviderKeyRowGroup
} from './credential-key-ui'
import { prettyName } from './helpers'
import { ModelBrandLogo } from './model-brand-logo'
import { modelMarks } from './model-mark'
import { ListRow } from './primitives'

type SimpleIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>

const ACCOUNT_ICONS: ReadonlyArray<readonly [RegExp, SimpleIcon]> = [
  [/anthropic/, SiAnthropic],
  [/openrouter/, SiOpenrouter],
  [/huggingface|hugging face/, SiHuggingface],
  [/minimax/, SiMinimax],
  [/nvidia/, SiNvidia],
  [/ollama/, SiOllama],
  [/^xai$|\bxai\b/, SiX]
]

function AccountLogo({ name }: { name: string }) {
  const haystack = name.toLowerCase()

  if (/openai/.test(haystack)) {
    return <ModelBrandLogo brand="openai" className="size-4" />
  }

  if (/qwen|dashscope/.test(haystack)) {
    return <ModelBrandLogo brand="qwen" className="size-4" />
  }

  if (/gemini|\bgoogle\b/.test(haystack)) {
    return <ModelBrandLogo brand="gemini" className="size-4" />
  }

  for (const [pattern, Icon] of ACCOUNT_ICONS) {
    if (pattern.test(haystack)) {
      return <Icon className="size-4" color="currentColor" title="" />
    }
  }

  return <span className="text-[0.625rem] font-semibold">{modelMarks([name])[0]}</span>
}

export function ModelProviderKeyCard({
  expanded,
  group,
  onExpand,
  onToggle,
  rowProps
}: {
  expanded: boolean
  group: ProviderKeyRowGroup
  onExpand: () => void
  onToggle: () => void
  rowProps: KeyRowProps
}) {
  const { t } = useI18n()
  const docsUrl = group.docsUrl?.trim()
  const description = group.description?.trim()
  const expandable = Boolean(description || docsUrl || group.advanced.length > 0)

  return (
    <article
      className={cn(
        'rounded-(--card-radius) border border-(--ui-stroke-secondary) bg-(--ui-bg-editor) px-3.5 py-3',
        expanded && 'bg-(--ui-bg-tertiary)'
      )}
    >
      <button
        aria-expanded={expandable ? expanded : undefined}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-left"
        disabled={!expandable}
        onClick={expandable ? onToggle : undefined}
        type="button"
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full border border-(--ui-stroke-secondary) bg-(--ui-bg-primary) text-foreground"
        >
          <AccountLogo name={group.name} />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-[length:var(--conversation-text-font-size)] font-medium">
            <span className="truncate">{group.name}</span>
            <span
              className={cn(
                'text-[0.6875rem] font-medium',
                group.hasAnySet
                  ? 'rounded-full bg-(--ui-bg-primary) px-1.5 py-0.5 text-(--ui-accent)'
                  : 'text-(--ui-text-tertiary)'
              )}
            >
              {group.hasAnySet ? t.messaging.saved : t.settings.toolsets.notSet}
            </span>
          </span>
          {description && (
            <span className="mt-0.5 block truncate text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
              {description}
            </span>
          )}
        </span>
        {expandable && (
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 text-(--ui-text-tertiary) transition', expanded && 'rotate-180')}
          />
        )}
      </button>
      <div className="mt-2.5">
        <KeyField
          expanded
          info={group.primary[1]}
          placeholder={t.settings.credentials.pasteLabelKey(group.name)}
          rowProps={rowProps}
          varKey={group.primary[0]}
        />
      </div>
      {expandable && expanded && (
        <div className="mt-3 grid gap-3">
          {group.advanced.map(([key, info]) => {
            const fieldLabel = isKeyVar(key, info)
              ? prettyName(key.replace(/(?:_API_KEY|_TOKEN|_KEY)$/i, ''))
              : friendlyFieldLabel(key, info)

            return (
              <ListRow
                action={
                  <KeyField
                    expanded
                    info={info}
                    placeholder={credentialPlaceholder(key, info, fieldLabel)}
                    rowProps={rowProps}
                    varKey={key}
                  />
                }
                key={key}
                title={fieldLabel}
              />
            )
          })}
          {docsUrl && <CredentialDocsLink href={docsUrl} />}
        </div>
      )}
    </article>
  )
}
