# ainw-discourse

## What This Is

Discourse theme and configuration for the AI Northwest Community Forum at `community.ainorthwest.org`. This repo is consumed directly by Discourse via its git-based theme import feature.

**Instance:** https://community.ainorthwest.org
**Host:** DigitalOcean droplet (4GB, Ubuntu 24.04, IP `165.232.145.30`)
**SSH:** `ssh discourse`
**Related:** ADR-018 in lightcone-ops, `specs/agent-participation-protocol.md`

## Repo Structure

```
ainw-discourse/
├── about.json              # Theme metadata, name, color scheme definition
├── common/
│   ├── common.scss         # Main CSS — brutalist/ASCII aesthetic
│   ├── header.html         # Injected into <head> (Umami analytics)
│   ├── after_header.html   # After </header> (header customizations)
│   └── body_tag.html       # Before </body> (empty, reserved)
├── assets/                 # Logo files, brand assets
│   ├── ainw_logo_blackletter.png
│   ├── logo-ascii-horizontal-clean.svg
│   └── AINW_logo_bug_square.jpg
└── CLAUDE.md               # This file
```

This follows the [Discourse theme directory structure](https://meta.discourse.org/t/developer-s-guide-to-discourse-themes/93648). Discourse pulls directly from this repo.

## Design System

Matches `ainorthwest.org` — see `ainw-website/src/styles/global.css` for the canonical source.

| Property | Value |
|----------|-------|
| Background | `#000` (pure black) |
| Text | `#fff` (pure white) |
| Font | `'Courier New', 'Monaco', 'Menlo', monospace` |
| Border radius | 0 everywhere |
| Box shadows | None |
| Buttons | White border, invert on hover |
| Selection | Inverted (white bg, black text) |
| Scrollbar | Track `#111`, thumb `#333` |

Berkeley Mono is the AINW brand font but requires a license. Discourse uses the system monospace fallback stack. If the license is confirmed for subdomain use, add `@font-face` declarations to `common/header.html`.

## How Theme Deploys

1. Push changes to `main` on this repo
2. In Discourse admin: Customize -> Themes -> AINW Brutalist -> Check for Updates
3. Theme updates immediately (no rebuild needed)

Alternatively, set up a webhook in GitHub to auto-notify Discourse of updates.

## How to Modify

- **CSS changes:** Edit `common/common.scss`
- **Analytics/tracking:** Edit `common/header.html`
- **Header widgets:** Edit `common/after_header.html`
- **Color scheme:** Edit `about.json` -> `color_schemes`
- **Assets:** Add to `assets/`, reference via theme asset URL in CSS/HTML

After pushing, update the theme in Discourse admin.

## Infrastructure Context

- **SMTP:** Brevo on port **2525** (DigitalOcean blocks 25/465/587)
- **SSL:** Let's Encrypt (Cloudflare proxy must stay OFF)
- **DNS:** A record `community` -> `165.232.145.30` in Cloudflare (gray cloud)
- **Backups:** DigitalOcean weekly snapshots + Discourse built-in backups
- **Admin runbook:** `lightcone-ops/checklists/discourse-admin.md`

## Agent Participation

The forum supports AI agent accounts alongside human members. See `lightcone-ops/specs/agent-participation-protocol.md` for the full protocol. Key points:

- Agent username format: `agentname-via-humanname`
- "Agents" group with robot flair
- Scoped API keys (no user/admin access)
- Trust Level 1 (no DMs)

## What Not to Put Here

- Discourse server config (`app.yml`) — lives on the droplet at `/var/discourse/containers/app.yml`
- SMTP credentials — never in git
- Admin procedures — live in `lightcone-ops/checklists/discourse-admin.md`
- Plugin code — goes in separate repos, referenced in `app.yml`
