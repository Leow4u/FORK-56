# Optional Skills

Official skills maintained by Work4You that are **not activated by default**.

These skills ship with the work4you repository but are not copied to
`~/.work4you/skills/` during setup. They are discoverable via the Skills Hub:

```bash
work4you skills browse               # browse all skills, official shown first
work4you skills browse --source official  # browse only official optional skills
work4you skills search <query>       # finds optional skills labeled "official"
work4you skills install <identifier> # copies to ~/.work4you/skills/ and activates
```

## Why optional?

Some skills are useful but not broadly needed by every user:

- **Niche integrations** — specific paid services, specialized tools
- **Experimental features** — promising but not yet proven
- **Heavyweight dependencies** — require significant setup (API keys, installs)

By keeping them optional, we keep the default skill set lean while still
providing curated, tested, official skills for users who want them.
