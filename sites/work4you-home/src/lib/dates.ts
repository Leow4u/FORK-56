/** Datas no formato curto usado no site (pt-BR), sem depender do fuso do Intl. */
export const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
export const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** "05/10" */
export function dayMonth(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`
}

/** "08:00" */
export function clock(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "seg, 05/10 · 08:00" */
export function formatRun(date: Date): string {
  return `${WEEKDAY_SHORT[date.getDay()]}, ${dayMonth(date)} · ${clock(date)}`
}
