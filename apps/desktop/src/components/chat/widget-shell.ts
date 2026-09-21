/**
 * Inline transcript widgets — the few tool results that render as a panel the
 * user reads or acts on (a clarify question, an artifact card) rather than as
 * a scaffold line.
 *
 * They share one shell so they cannot drift apart. They used to each pick their
 * own: clarify sat on a 2px radius over the chat backdrop's own color (a card
 * you could only see by its hairline), the artifact card on a hardcoded 10px
 * over nothing. One radius one rung above the composer, one mode-derived fill,
 * no border — the surface reads as a surface on the fill alone.
 */
export const WIDGET_SHELL_CLASS = 'rounded-3xl bg-(--ui-widget-surface-background) px-3.5 py-3'

/**
 * File attachment rows in the transcript. Same radius and padding as other
 * widgets, but attachments are a bordered surface (DESIGN.md) and need a well
 * that still reads when `--ui-widget-surface-background` equals the chat
 * field — otherwise the card is just floating type on the thread.
 */
export const ATTACHMENT_SHELL_CLASS =
  'rounded-3xl border border-(--ui-stroke-tertiary) bg-[color-mix(in_srgb,var(--ui-text-primary)_5%,var(--ui-chat-surface-background))] px-3.5 py-3'
