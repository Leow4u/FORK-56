"""Static Work4You Apps catalog (Composio slugs) + native MCP section map.

Keep Composio rows in sync with ``services/work4you-connectors-api/src/allowlist.ts``.
Native MCP entries still come from ``optional-mcps/`` at merge time; this file
only assigns their directory section / Popular pin. Collision rule: native
name wins, the Composio slug is dropped.
"""

from __future__ import annotations

from typing import FrozenSet, List, Tuple, TypedDict


class ComposioCatalogApp(TypedDict, total=False):
    slug: str
    name: str
    description: str
    section: str
    popular: bool
    notes: str


SECTION_IDS: Tuple[str, ...] = (
    "developer",
    "data",
    "finance",
    "crm",
    "marketing",
    "social",
    "email",
    "productivity",
    "files",
    "communication",
    "ai",
    "other",
)

# Editorial Popular pins for native catalog names (applied at directory merge).
NATIVE_POPULAR: FrozenSet[str] = frozenset({"notion", "vercel", "stripe", "figma"})

# Native-only section buckets. Unknown native names fall through to "other".
NATIVE_SECTIONS = {
    "airtable": "data",
    "asana": "productivity",
    "atlassian": "developer",
    "comfy-cloud": "ai",
    "datadog": "data",
    "figma": "files",
    "hugging_face": "ai",
    "intercom": "communication",
    "linear": "productivity",
    "n8n": "developer",
    "netlify": "developer",
    "notion": "productivity",
    "paypal": "finance",
    "sentry": "developer",
    "square": "finance",
    "stripe": "finance",
    "supabase": "data",
    "unreal-engine": "developer",
    "vercel": "developer",
    "webflow": "developer",
}

COMPOSIO_CATALOG: List[ComposioCatalogApp] = [
    {"slug": "gmail", "name": "Gmail", "description": "Read, search, and send email.", "section": "email", "popular": True},
    {"slug": "googlecalendar", "name": "Google Calendar", "description": "Events, availability, and scheduling.", "section": "email", "popular": True},
    {"slug": "googledrive", "name": "Google Drive", "description": "Files and folders in Drive.", "section": "files"},
    {"slug": "outlook", "name": "Outlook", "description": "Mail and calendar from Microsoft 365.", "section": "email"},
    {"slug": "slack", "name": "Slack", "description": "Channels, messages, and workspace search.", "section": "communication", "popular": True},
    {
        "slug": "instagram",
        "name": "Instagram",
        "description": "Instagram Business or Creator accounts.",
        "section": "social",
        "notes": "instagram_business_creator",
    },
    {"slug": "github", "name": "GitHub", "description": "Repos, issues, pull requests, and reviews.", "section": "developer", "popular": True},
    {"slug": "hubspot", "name": "HubSpot", "description": "CRM contacts, deals, and companies.", "section": "crm", "popular": True},
    {"slug": "salesforce", "name": "Salesforce", "description": "Salesforce records and workflows.", "section": "crm"},
    {"slug": "youtube", "name": "YouTube", "description": "Channels, videos, and captions.", "section": "ai"},
    {"slug": "excel", "name": "Excel", "description": "Workbooks and spreadsheets.", "section": "files"},
    {"slug": "monday", "name": "Monday", "description": "Boards, items, and workspace updates.", "section": "productivity"},
    {"slug": "reddit", "name": "Reddit", "description": "Posts, comments, and subreddits.", "section": "social"},
    {"slug": "reddit_ads", "name": "Reddit Ads", "description": "Reddit advertising campaigns.", "section": "marketing"},
    {"slug": "apollo", "name": "Apollo", "description": "Prospecting and sales sequences.", "section": "crm"},
    {"slug": "snowflake", "name": "Snowflake", "description": "Warehouses, queries, and data.", "section": "data"},
    {"slug": "facebook", "name": "Facebook", "description": "Pages and posts.", "section": "social"},
    {"slug": "metaads", "name": "Meta Ads", "description": "Ads across Facebook and Instagram.", "section": "marketing"},
    {"slug": "linkedin", "name": "LinkedIn", "description": "Profile, posts, and networking.", "section": "social"},
    {"slug": "linkedin_ads", "name": "LinkedIn Ads", "description": "LinkedIn campaign manager.", "section": "marketing"},
    {"slug": "pipedrive", "name": "Pipedrive", "description": "Deals and pipeline.", "section": "crm"},
    {"slug": "googleads", "name": "Google Ads", "description": "Campaigns and performance.", "section": "marketing"},
    {"slug": "captions", "name": "Captions", "description": "Captioned video generation.", "section": "ai"},
    {"slug": "canva_mcp", "name": "Canva MCP", "description": "Canva designs through Canva’s MCP server.", "section": "files"},
    {"slug": "canva", "name": "Canva", "description": "Designs, templates, and assets.", "section": "files", "popular": True},
    {"slug": "bannerbear", "name": "Bannerbear", "description": "Image and video generation from templates.", "section": "files"},
    {"slug": "calendly", "name": "Calendly", "description": "Scheduling links and event types.", "section": "email"},
    {"slug": "twitter", "name": "Twitter", "description": "Posts and account activity.", "section": "social"},
    {"slug": "tiktok", "name": "TikTok", "description": "TikTok account and content.", "section": "social"},
    {"slug": "granola_mcp", "name": "Granola", "description": "Meeting notes and transcripts.", "section": "productivity"},
]

HIDDEN_DIRECTORY_NAMES: FrozenSet[str] = frozenset({"work4you_apps"})
