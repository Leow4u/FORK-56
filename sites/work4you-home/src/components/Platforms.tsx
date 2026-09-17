import styles from './Platforms.module.css'

const PLATFORMS = [
  { name: 'WhatsApp', src: '/brand/apps/whatsapp.svg' },
  { name: 'Telegram', src: '/brand/apps/telegram.svg' },
  { name: 'Slack', src: '/brand/apps/slack.svg' },
  { name: 'Discord', src: '/brand/apps/discord.svg' },
  { name: 'Gmail', src: '/brand/apps/gmail.svg' },
  { name: 'Notion', src: '/brand/apps/notion.svg' },
  { name: 'Google Drive', src: '/brand/apps/googledrive.svg' },
  { name: 'Google Calendar', src: '/brand/apps/googlecalendar.svg' },
] as const

export function Platforms() {
  return (
    <ul className={styles.list} aria-label="Canais e aplicativos">
      {PLATFORMS.map((platform) => (
        <li key={platform.name}>
          <img src={platform.src} alt={platform.name} width={20} height={20} />
        </li>
      ))}
      <li className={styles.cli} aria-label="CLI">
        CLI
      </li>
    </ul>
  )
}
