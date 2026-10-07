import { useId, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { X } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { findInvalidEmailSender } from './validate-env'

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function parseTokens(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean)
}

/** Outlook-style chip field: valid addresses become removable chips. */
export function EmailAddressChipInput({
  className,
  formatInvalid,
  help,
  label,
  onChange,
  placeholder,
  removeLabel,
  value
}: {
  className?: string
  formatInvalid: (value: string) => string
  help?: string
  label: string
  onChange: (addresses: string[]) => void
  placeholder?: string
  removeLabel: (address: string) => string
  value: string[]
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const commitDraft = (raw: string) => {
    const tokens = parseTokens(raw)

    if (tokens.length === 0) {
      setDraft('')
      setError('')

      return
    }

    const next = [...value]

    for (const token of tokens) {
      if (token === '*') {
        setError(formatInvalid('*'))
        setDraft(token)

        return
      }

      const invalid = findInvalidEmailSender(token)

      if (invalid) {
        setError(formatInvalid(invalid))
        setDraft(token)

        return
      }

      if (!next.includes(token)) {
        next.push(token)
      }
    }

    onChange(next)
    setDraft('')
    setError('')
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setError('')
  }

  return (
    <div className={cn('mt-3.5 flex flex-col gap-1.5', className)}>
      <label className="text-[0.78125rem] font-medium text-(--ui-text-secondary)" htmlFor={id}>
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-(--ui-stroke-quaternary) bg-background px-2 py-1.5',
          'focus-within:border-(--ui-stroke-tertiary) focus-within:ring-2 focus-within:ring-(--ui-focus-ring)'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((address, index) => (
          <span
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-(--ui-bg-quaternary) py-0.5 pl-2 pr-1 text-xs text-foreground"
            key={address}
          >
            <span className="truncate">{address}</span>
            <button
              aria-label={removeLabel(address)}
              className="grid size-5 shrink-0 place-items-center rounded-sm text-(--ui-text-tertiary) hover:bg-(--ui-bg-tertiary) hover:text-foreground"
              onClick={event => {
                event.stopPropagation()
                removeAt(index)
              }}
              type="button"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Input
          aria-invalid={Boolean(error)}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
          id={id}
          onBlur={() => commitDraft(draft)}
          onChange={event => {
            setDraft(event.target.value)
            if (error) {
              setError('')
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              commitDraft(draft)
            } else if (event.key === 'Backspace' && !draft && value.length > 0) {
              removeAt(value.length - 1)
            }
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          ref={inputRef}
          value={draft}
        />
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      {help ? <span className="text-xs leading-4 text-(--ui-text-tertiary)">{help}</span> : null}
    </div>
  )
}
