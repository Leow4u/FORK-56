import styles from './Pillars.module.css'

const pillars = [
  {
    kicker: 'Channels',
    title: 'Where you — and your customers — talk to it',
    body: 'Ask from WhatsApp, Telegram, Slack, Discord, or email. It runs in real time and delivers where you want.',
    tags: ['WhatsApp', 'Telegram', 'Slack', 'Discord', 'Email'],
  },
  {
    kicker: 'Connectors',
    title: 'The accounts it uses to get work done',
    body: 'Gmail, Drive, Sheets, Calendar, Notion, HubSpot, and 1,400+ apps — connected once, reused every session.',
    tags: ['Gmail', 'Google Drive', 'Notion', 'HubSpot'],
  },
  {
    kicker: 'Artifacts',
    title: 'What it produces and hands back, done',
    body: 'Spreadsheets, decks, documents, and PDFs — finished work, not just chat replies.',
    tags: ['Excel', 'PowerPoint', 'Word', 'PDF'],
  },
]

export function Pillars() {
  return (
    <section className={styles.section} id="pillars">
      <div className="shell">
        <p className="eyebrow">Talks where you talk</p>
        <h2 className="section-title">
          Uses what you use. Delivers finished work.
        </h2>
        <p className="section-lead">
          Chat answers. Work executes — files, terminal, and cloud automations.
        </p>
        <div className={styles.grid}>
          {pillars.map((item) => (
            <article key={item.kicker} className={styles.card}>
              <p className={styles.kicker}>{item.kicker}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <ul>
                {item.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
