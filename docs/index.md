---
layout: home

hero:
  name: Another bloated Obsidian MCP Server
  text: AI-powered vault integration
  tagline: A Model Context Protocol server that provides AI assistants with secure access to Obsidian vaults
  actions:
    - theme: brand
      text: Get Started
      link: /guide/GETTING-STARTED
    - theme: alt
      text: API Reference
      link: /API_REFERENCE

features:
  - title: Direct Filesystem Access
    details: Works without Obsidian running - access your vault directly
  - title: Multi-Vault Support
    details: Manage multiple vaults simultaneously with easy switching
  - title: Full CRUD Operations
    details: Create, read, update, delete notes with full frontmatter support
  - title: Link Analysis
    details: Backlinks, outlinks, orphans, broken links, and link graph
  - title: Daily Notes & Templates
    details: Create and manage daily journal entries with template support
  - title: Security First
    details: Path traversal protection, symlink escape prevention, input validation
---

::: warning EXPERIMENTAL PROJECT
This is an experimental project created primarily through AI-assisted development. It is intended solely for testing and learning purposes. **Do not use for production or critical data.**
:::

## Quick Start

```bash
# Clone the repository
git clone https://github.com/diegorv/another-bloated-obsidian-mcp-server.git
cd another-bloated-obsidian-mcp-server

# Install dependencies
npm install

# Start the server with a vault
npm start /path/to/your/vault
```

## Tool Groups

| Group | Description |
|-------|-------------|
| `vault` | Vault management |
| `notes` | Note CRUD operations |
| `search` | Full-text search |
| `frontmatter` | YAML metadata |
| `tags` | Tag management |
| `links` | Link analysis |
| `daily` | Daily notes |
| `templates` | Template system |
| `bases` | Obsidian Bases |
| `batch` | Batch operations |
| `attachments` | Attachment management |
| `backup` | Backup system |
