/**
 * Composio toolkit allowlist + Perplexity-style section buckets.
 *
 * Adding a Composio app is appending a row here. Native MCP catalog entries
 * are merged by the local dashboard (PR 2), not this service.
 */
export type DirectorySection =
  | 'developer'
  | 'data'
  | 'finance'
  | 'crm'
  | 'marketing'
  | 'social'
  | 'email'
  | 'productivity'
  | 'files'
  | 'communication'
  | 'ai'
  | 'other'

export interface AllowlistApp {
  slug: string
  name: string
  description: string
  /** Fine Composio `category` string (source of truth). */
  composioCategory: string
  section: DirectorySection
  popular?: boolean
}

/** Editorial Popular pins (Composio slugs only). Native pins merge locally. */
export const POPULAR_SLUGS: readonly string[] = [
  'gmail',
  'googlecalendar',
  'slack',
  'github',
  'hubspot',
  'canva',
]

export const SECTION_IDS: readonly DirectorySection[] = [
  'developer',
  'data',
  'finance',
  'crm',
  'marketing',
  'social',
  'email',
  'productivity',
  'files',
  'communication',
  'ai',
  'other',
]

export const ALLOWLIST: readonly AllowlistApp[] = [
  {
    slug: 'gmail',
    name: 'Gmail',
    description: 'Read, search, and send email.',
    composioCategory: 'email',
    section: 'email',
    popular: true,
  },
  {
    slug: 'googlecalendar',
    name: 'Google Calendar',
    description: 'Events, availability, and scheduling.',
    composioCategory: 'scheduling & booking',
    section: 'email',
    popular: true,
  },
  {
    slug: 'googledrive',
    name: 'Google Drive',
    description: 'Files and folders in Drive.',
    composioCategory: 'file management & storage',
    section: 'files',
  },
  {
    slug: 'outlook',
    name: 'Outlook',
    description: 'Mail and calendar from Microsoft 365.',
    composioCategory: 'email',
    section: 'email',
  },
  {
    slug: 'slack',
    name: 'Slack',
    description: 'Channels, messages, and workspace search.',
    composioCategory: 'team chat',
    section: 'communication',
    popular: true,
  },
  {
    slug: 'instagram',
    name: 'Instagram',
    description: 'Instagram Business or Creator accounts.',
    composioCategory: 'social media accounts',
    section: 'social',
  },
  {
    slug: 'github',
    name: 'GitHub',
    description: 'Repos, issues, pull requests, and reviews.',
    composioCategory: 'developer tools',
    section: 'developer',
    popular: true,
  },
  {
    slug: 'hubspot',
    name: 'HubSpot',
    description: 'CRM contacts, deals, and companies.',
    composioCategory: 'crm',
    section: 'crm',
    popular: true,
  },
  {
    slug: 'salesforce',
    name: 'Salesforce',
    description: 'Salesforce records and workflows.',
    composioCategory: 'crm',
    section: 'crm',
  },
  {
    slug: 'youtube',
    name: 'YouTube',
    description: 'Channels, videos, and captions.',
    composioCategory: 'video & audio',
    section: 'ai',
  },
  {
    slug: 'excel',
    name: 'Excel',
    description: 'Workbooks and spreadsheets.',
    composioCategory: 'spreadsheets',
    section: 'files',
  },
  {
    slug: 'monday',
    name: 'Monday',
    description: 'Boards, items, and workspace updates.',
    composioCategory: 'project management',
    section: 'productivity',
  },
  {
    slug: 'reddit',
    name: 'Reddit',
    description: 'Posts, comments, and subreddits.',
    composioCategory: 'social media accounts',
    section: 'social',
  },
  {
    slug: 'reddit_ads',
    name: 'Reddit Ads',
    description: 'Reddit advertising campaigns.',
    composioCategory: 'marketing',
    section: 'marketing',
  },
  {
    slug: 'apollo',
    name: 'Apollo',
    description: 'Prospecting and sales sequences.',
    composioCategory: 'crm',
    section: 'crm',
  },
  {
    slug: 'snowflake',
    name: 'Snowflake',
    description: 'Warehouses, queries, and data.',
    composioCategory: 'databases',
    section: 'data',
  },
  {
    slug: 'facebook',
    name: 'Facebook',
    description: 'Pages and posts.',
    composioCategory: 'social media accounts',
    section: 'social',
  },
  {
    slug: 'metaads',
    name: 'Meta Ads',
    description: 'Ads across Facebook and Instagram.',
    composioCategory: 'ads & conversion',
    section: 'marketing',
  },
  {
    slug: 'linkedin',
    name: 'LinkedIn',
    description: 'Profile, posts, and networking.',
    composioCategory: 'social media accounts',
    section: 'social',
  },
  {
    slug: 'linkedin_ads',
    name: 'LinkedIn Ads',
    description: 'LinkedIn campaign manager.',
    composioCategory: 'marketing',
    section: 'marketing',
  },
  {
    slug: 'pipedrive',
    name: 'Pipedrive',
    description: 'Deals and pipeline.',
    composioCategory: 'crm',
    section: 'crm',
  },
  {
    slug: 'googleads',
    name: 'Google Ads',
    description: 'Campaigns and performance.',
    composioCategory: 'ads & conversion',
    section: 'marketing',
  },
  {
    slug: 'captions',
    name: 'Captions',
    description: 'Captioned video generation.',
    composioCategory: 'ai content generation',
    section: 'ai',
  },
  {
    slug: 'canva_mcp',
    name: 'Canva MCP',
    description: 'Canva designs through Canva’s MCP server.',
    composioCategory: 'content & files',
    section: 'files',
  },
  {
    slug: 'canva',
    name: 'Canva',
    description: 'Designs, templates, and assets.',
    composioCategory: 'images & design',
    section: 'files',
    popular: true,
  },
  {
    slug: 'bannerbear',
    name: 'Bannerbear',
    description: 'Image and video generation from templates.',
    composioCategory: 'images & design',
    section: 'files',
  },
  {
    slug: 'calendly',
    name: 'Calendly',
    description: 'Scheduling links and event types.',
    composioCategory: 'scheduling & booking',
    section: 'email',
  },
  {
    slug: 'twitter',
    name: 'Twitter',
    description: 'Posts and account activity.',
    composioCategory: 'social media accounts',
    section: 'social',
  },
  {
    slug: 'tiktok',
    name: 'TikTok',
    description: 'TikTok account and content.',
    composioCategory: 'social media accounts',
    section: 'social',
  },
  {
    slug: 'granola_mcp',
    name: 'Granola',
    description: 'Meeting notes and transcripts.',
    composioCategory: 'productivity & project management',
    section: 'productivity',
  },
]

const BY_SLUG = new Map(ALLOWLIST.map((app) => [app.slug, app]))

/** Composio categories that must never be enabled on the session. */
export const BLOCKED_SESSION_SLUGS: readonly string[] = [
  'notion',
  'linear',
  'airtable',
  'asana',
  'jira',
  'figma',
  'stripe',
  'supabase',
  'vercel',
  'datadog',
  'huggingface',
  'hugging_face',
  'intercom',
  'netlify',
  'paypal',
  'sentry',
  'square',
  'webflow',
  'firecrawl',
  'exa',
]

export function getAllowlistApp(slug: string): AllowlistApp | undefined {
  return BY_SLUG.get(slug)
}

export function isAllowlisted(slug: string): boolean {
  return BY_SLUG.has(slug)
}

export function sessionToolkitSlugs(): string[] {
  return ALLOWLIST.map((app) => app.slug)
}

export function authConfigsFromEnv(
  lookup: (slug: string) => string | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const app of ALLOWLIST) {
    const id = lookup(app.slug)
    if (id) out[app.slug] = id
  }
  return out
}

/** Map a Composio fine category onto a UI section (native merge uses this too). */
export function sectionForComposioCategory(category: string): DirectorySection {
  const c = category.trim().toLowerCase()
  if (
    c === 'developer tools' ||
    c === 'developer tools & devops' ||
    c === 'model context protocol' ||
    c === 'app builder' ||
    c === 'website builders' ||
    c === 'website & app building'
  ) {
    return 'developer'
  }
  if (
    c === 'analytics' ||
    c === 'databases' ||
    c === 'business intelligence' ||
    c === 'server monitoring' ||
    c === 'ai web scraping'
  ) {
    return 'data'
  }
  if (c === 'payment processing' || c === 'accounting' || c === 'taxes' || c === 'fundraising') {
    return 'finance'
  }
  if (c === 'crm' || c === 'sales & crm' || c === 'contact management' || c === 'ai sales tools') {
    return 'crm'
  }
  if (
    c === 'marketing' ||
    c === 'marketing automation' ||
    c === 'ads & conversion' ||
    c === 'social media marketing' ||
    c === 'email newsletters'
  ) {
    return 'marketing'
  }
  if (c === 'social media accounts') return 'social'
  if (
    c === 'email' ||
    c === 'scheduling & booking' ||
    c === 'transactional email' ||
    c === 'drip emails'
  ) {
    return 'email'
  }
  if (
    c === 'project management' ||
    c === 'productivity' ||
    c === 'productivity & project management' ||
    c === 'task management' ||
    c === 'notes' ||
    c === 'team collaboration' ||
    c === 'product management'
  ) {
    return 'productivity'
  }
  if (
    c === 'file management & storage' ||
    c === 'documents' ||
    c === 'images & design' ||
    c === 'content & files' ||
    c === 'spreadsheets' ||
    c === 'signatures'
  ) {
    return 'files'
  }
  if (
    c === 'team chat' ||
    c === 'communication' ||
    c === 'customer support' ||
    c === 'video conferencing' ||
    c === 'phone & sms' ||
    c === 'notifications'
  ) {
    return 'communication'
  }
  if (
    c === 'artificial intelligence' ||
    c === 'ai content generation' ||
    c === 'ai agents' ||
    c === 'ai chatbots' ||
    c === 'ai models' ||
    c === 'ai meeting assistants' ||
    c === 'transcription' ||
    c === 'video & audio'
  ) {
    return 'ai'
  }
  return 'other'
}
