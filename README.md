# Another bloated Obsidian MCP Server

> [!CAUTION]
> **🔴🔴🔴 EXPERIMENTAL PROJECT - DO NOT USE IN PRODUCTION 🔴🔴🔴**
>
> This is an experimental project created primarily through AI-assisted development using Claude Code, with minimal human intervention. It is intended solely for testing and learning purposes.
>
> **This project should NOT be used for:**
> - Production environments
> - Critical data or important vaults
> - Any scenario where data integrity is essential
>
> Use at your own risk. The code may contain bugs, security vulnerabilities, or unexpected behaviors.
>
> **Support notice:** This project will likely not receive attention for bugs or issues reported by third parties. If you're interested in contributing or reporting issues, you may not get a response as this project may not be maintained long-term. However, this could change after the experimentation phase.

---

A Model Context Protocol (MCP) server that provides AI assistants with secure access to Obsidian vaults. Enables reading, writing, searching, and managing notes without requiring Obsidian to be running.

## Features

- **Direct filesystem access** - Works without Obsidian running
- **Multi-vault support** - Manage multiple vaults simultaneously
- **Configurable tool groups** - Enable only the features you need
- **Full CRUD operations** - Create, read, update, delete notes
- **YAML frontmatter** - Parse and manipulate note metadata
- **Tag management** - Add, remove, and search by tags
- **Link analysis** - Backlinks, outlinks, orphans, broken links, link graph
- **Daily notes** - Create and manage daily journal entries
- **Templates** - Apply templates with variable substitution
- **Obsidian Bases** - Query dynamic note views based on filters
- **Batch operations** - Process multiple notes efficiently
- **Attachment tracking** - List and find unused attachments
- **Backup system** - Create and restore note backups
- **Security-first** - Path traversal protection, symlink escape prevention

## Requirements

- Node.js 18+
- npm or yarn

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-mcp-server.git
cd obsidian-mcp-server

# Install dependencies
npm install
# or
yarn install

# Build (optional - can run directly with tsx)
npm run build
```

## Quick Start

```bash
# Start the server with a vault
npm start /path/to/your/vault

# With specific tool groups
npm start /path/to/your/vault --tools=vault,notes,search

# With a custom vault name
npm start /path/to/your/vault my-vault
```

## Configuration

### Option 1: Claude Code CLI (Recommended)

```bash
# Add the MCP server
claude mcp add obsidian \
  --transport stdio \
  --scope user \
  -- npx tsx /path/to/obsidian-mcp-server/src/index.ts /path/to/vault

# With specific tool groups
claude mcp add obsidian \
  --transport stdio \
  --scope user \
  -- npx tsx /path/to/obsidian-mcp-server/src/index.ts /path/to/vault --tools=vault,notes,search
```

**Scope options:**
- `user` - Available in all projects (saved in `~/.claude.json`)
- `local` - Current project only
- `project` - Shared with team (saved in `.mcp.json`)

**Useful commands:**
```bash
claude mcp list          # List configured servers
claude mcp get obsidian  # View server details
claude mcp remove obsidian  # Remove server
```

### Option 2: Manual Configuration

Edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/obsidian-mcp-server/src/index.ts",
        "/path/to/your/vault",
        "--tools=vault,notes,search"
      ]
    }
  }
}
```

### Option 3: Claude Desktop App

Edit the config file at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/obsidian-mcp-server/src/index.ts",
        "/path/to/your/vault",
        "--tools=vault,notes,search"
      ]
    }
  }
}
```

## Tool Groups

| Group | Tools | Description |
|-------|-------|-------------|
| `vault` | list_vaults, set_active_vault, register_vault | Vault management |
| `notes` | list_notes, read_note, create_note, update_note, delete_note, rename_note, move_note | Note CRUD operations |
| `search` | search_vault | Full-text search |
| `frontmatter` | get_frontmatter, update_frontmatter, remove_frontmatter_field, add_to_array_field, remove_from_array_field | YAML metadata |
| `tags` | list_tags, add_tag, remove_tag, search_by_tag | Tag management |
| `links` | get_outlinks, get_backlinks, find_orphans, find_broken_links, get_link_graph | Link analysis |
| `daily` | get_daily_note, create_daily_note, list_daily_notes, append_to_daily | Daily notes |
| `templates` | list_templates, get_template, apply_template, create_from_template | Template system |
| `bases` | list_bases, get_base, query_base | Obsidian Bases |
| `batch` | batch_move, batch_delete, batch_update_frontmatter, batch_add_tag, batch_remove_tag, batch_read_notes | Batch operations |
| `attachments` | list_attachments, get_attachment_info, find_unused_attachments, get_attachments_in_note | Attachment management |
| `backup` | create_note_backup, list_backups, restore_backup, delete_old_backups | Backup system |

**Special values:**
- `all` - Enable all tool groups (default)
- `none` - Disable all tools (for testing)

## Configuration Examples

### Read-Only Access
```bash
--tools=vault,notes,search
```
Safe for exploration without modifying notes.

### Daily Productivity
```bash
--tools=vault,notes,search,daily,tags
```
Quick capture, daily notes, and tag organization.

### Knowledge Analysis
```bash
--tools=vault,notes,search,links,tags
```
Explore connections, find orphans, analyze the knowledge graph.

### Content Creation
```bash
--tools=vault,notes,search,templates,frontmatter
```
Create notes from templates, manage metadata.

### Full Access
```bash
--tools=all
```
All features enabled.

## Multi-Vault Setup

Create `~/.obsidian-mcp/config.json`:

```json
{
  "vaults": {
    "personal": "/Users/you/Obsidian/Personal",
    "work": "/Users/you/Obsidian/Work",
    "research": "/Users/you/Obsidian/Research"
  },
  "defaultVault": "personal"
}
```

Switch between vaults using `set_active_vault` tool.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OBSIDIAN_MCP_TOOLS` | Comma-separated list of tool groups |
| `LOG_LEVEL` | Logging level: debug, info, warn, error |

## CLI Reference

```bash
# Show help
npm start -- --help

# Start with vault
npm start /path/to/vault [vault-name] [--tools=groups]

# Examples
npm start /path/to/vault                    # All tools
npm start /path/to/vault my-vault           # With custom name
npm start /path/to/vault --tools=vault,notes  # Specific groups
```

## Troubleshooting

### Server doesn't connect

1. Verify the vault path exists and is absolute
2. Check Node.js version: `node --version` (requires 18+)
3. Test manually: `npm start /path/to/vault`
4. For Claude Code: use `/mcp` to check status and errors
5. For Claude Desktop: check logs in `~/Library/Logs/Claude/mcp*.log`

### "Tool X is not enabled" error

The tool you're trying to use is not in your enabled groups. Check your `--tools` configuration and add the required group.

### Permission errors

Ensure the user running the MCP server has read/write access to the vault directory.

### Path not found

- Use absolute paths, not relative
- Ensure the vault contains a `.obsidian` folder
- Check for typos in the path

## Development

```bash
# Development mode (auto-reload)
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Documentation

- [API Reference](docs/API_REFERENCE.md) - Complete tool documentation
- [Architecture](docs/ARCHITECTURE.md) - System design
- [Configuration](docs/CONFIGURATION.md) - All configuration options
- [Security](docs/SECURITY.md) - Security model
- [Error Codes](docs/ERROR_CODES.md) - Error reference
- [Contributing](CONTRIBUTING.md) - Development guide

## Security

This server implements multiple security measures:

- **Path validation** - Prevents path traversal attacks
- **Symlink protection** - Blocks symlink escape attempts
- **Input validation** - All inputs validated with Zod schemas
- **Reserved name blocking** - Prevents system file conflicts

See [SECURITY.md](docs/SECURITY.md) for details.

## Inspiration

This project is inspired by [mcp-obsidian](https://mcp-obsidian.org/).

## License

MIT
