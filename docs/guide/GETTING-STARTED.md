# Getting Started

## Requirements

- Node.js 18+
- npm or yarn

## Installation

```bash
# Clone the repository
git clone https://github.com/diegorv/another-bloated-obsidian-mcp-server.git
cd another-bloated-obsidian-mcp-server

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
