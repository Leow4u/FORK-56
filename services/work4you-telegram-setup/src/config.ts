/** Runtime config for the Work4You Telegram setup service. */

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

export const config = {
  port: Number(process.env.PORT || 8080),
  /** The manager bot's token. Unset, the service runs and every new pairing answers 503. */
  managerBotToken: process.env.TELEGRAM_MANAGER_BOT_TOKEN?.trim() || '',
  /** Only a local run against a fake Bot API changes this. */
  telegramApiBase: optional('TELEGRAM_API_BASE', 'https://api.telegram.org').replace(/\/+$/, ''),
}
