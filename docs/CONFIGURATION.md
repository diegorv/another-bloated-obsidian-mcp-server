# Configuration Reference

Complete configuration options for the Obsidian MCP Server.

## Quick Reference

| Method | Scope | Example |
|--------|-------|---------|
| CLI argument | Session | `--tools=vault,notes` |
| Environment variable | Process | `OBSIDIAN_MCP_TOOLS=vault,notes` |
| Config file | Persistent | `~/.obsidian-mcp/config.json` |

## Command Line Arguments

### Basic Usage

```bash
npx tsx src/index.ts [vault-path] [vault-name] [options]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| vault-path | No | Absolute path to your Obsidian vault |
| vault-name | No | Name for the vault (default: "default") |

### Options

| Option | Description |
|--------|-------------|
| `--tools=GROUPS` | Comma-separated list of tool groups to enable |
| `--help`, `-h` | Show help message |

### Examples

```bash
# Enable all tools (default)
npx tsx src/index.ts /path/to/vault

# With custom vault name
npx tsx src/index.ts /path/to/vault personal

# Enable specific tool groups
npx tsx src/index.ts /path/to/vault --tools=vault,notes,search

# Minimal read-only setup
npx tsx src/index.ts /path/to/vault --tools=vault,notes,search

# Disable all tools (testing)
npx tsx src/index.ts /path/to/vault --tools=none
```

## Environment Variables

### OBSIDIAN_MCP_TOOLS

Controls which tool groups are enabled.

```bash
export OBSIDIAN_MCP_TOOLS=vault,notes,search
```

**Values:**
- Comma-separated list of group names
- `all` - Enable all groups
- `none` - Disable all groups

**Priority:** CLI `--tools` takes precedence over environment variable.

### LOG_LEVEL

Controls logging verbosity.

```bash
export LOG_LEVEL=debug
```

**Values:**
- `debug` - All messages including debug
- `info` - Info, warnings, and errors (default)
- `warn` - Warnings and errors only
- `error` - Errors only

## Tool Groups

### Available Groups

| Group | Tools | Description |
|-------|-------|-------------|
| `vault` | 3 | Vault management |
| `notes` | 7 | Note CRUD operations |
| `search` | 1 | Full-text search |
| `frontmatter` | 5 | YAML metadata |
| `tags` | 4 | Tag management |
| `links` | 5 | Link analysis |
| `daily` | 4 | Daily notes |
| `templates` | 4 | Template system |
| `bases` | 3 | Obsidian Bases |
| `batch` | 6 | Batch operations |
| `attachments` | 4 | Attachment tracking |
| `backup` | 4 | Backup/restore |

### Special Values

| Value | Description |
|-------|-------------|
| `all` | Enable all tool groups (default) |
| `none` | Disable all tool groups |

### Configuration Examples

**Read-Only Access:**
```
vault,notes,search
```

**Daily Productivity:**
```
vault,notes,search,daily,tags
```

**Knowledge Analysis:**
```
vault,notes,search,links,tags
```

**Content Creation:**
```
vault,notes,search,templates,frontmatter
```

**Full Access:**
```
all
```

## Configuration File

### Location

```
~/.obsidian-mcp/config.json
```

### Schema

```json
{
  "vaults": {
    "<vault-name>": "<absolute-path>"
  },
  "defaultVault": "<vault-name>"
}
```

### Example

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

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vaults` | object | Yes | Map of vault names to paths |
| `defaultVault` | string | No | Default vault when none specified |

## MCP Client Configuration

### Claude Code CLI

```bash
claude mcp add obsidian \
  --transport stdio \
  --scope user \
  -- npx tsx /path/to/obsidian-mcp-server/src/index.ts \
     /path/to/vault \
     --tools=vault,notes,search
```

**Scopes:**
- `user` - Available in all projects (`~/.claude.json`)
- `local` - Current project only
- `project` - Shared with team (`.mcp.json`)

### Manual Configuration (~/.claude.json)

```json
{
  "mcpServers": {
    "obsidian": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/obsidian-mcp-server/src/index.ts",
        "/path/to/vault",
        "--tools=vault,notes,search"
      ]
    }
  }
}
```

### Claude Desktop

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/obsidian-mcp-server/src/index.ts",
        "/path/to/vault",
        "--tools=vault,notes,search"
      ]
    }
  }
}
```

## Daily Notes Configuration

Daily notes use Obsidian's daily notes plugin configuration from:

```
<vault>/.obsidian/daily-notes.json
```

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `folder` | `""` (root) | Folder for daily notes |
| `format` | `YYYY-MM-DD` | Date format for filenames |
| `template` | `""` | Template file for new notes |

### Example

```json
{
  "folder": "Daily",
  "format": "YYYY-MM-DD",
  "template": "Templates/Daily Note"
}
```

## Templates Configuration

Templates are read from the vault's templates folder.

### Default Locations (checked in order)

1. `Templates/`
2. `templates/`

### Supported Variables

| Variable | Description |
|----------|-------------|
| `{{title}}` | Note title parameter |
| `{{date}}` | Current date (YYYY-MM-DD) |
| `{{date:FORMAT}}` | Date with custom format |
| `{{time}}` | Current time (HH:mm) |
| `{{variable}}` | Custom variable |

### Date Format Tokens

| Token | Description | Example |
|-------|-------------|---------|
| `YYYY` | 4-digit year | 2024 |
| `MM` | 2-digit month | 01-12 |
| `DD` | 2-digit day | 01-31 |
| `HH` | 2-digit hour (24h) | 00-23 |
| `mm` | 2-digit minute | 00-59 |
| `ss` | 2-digit second | 00-59 |

## Logging Configuration

### Log Location

```
<project-root>/logs/mcp-server-YYYY-MM-DD.log
```

### Settings

| Setting | Value |
|---------|-------|
| Max log files | 7 |
| Max age | 7 days |
| Output | File + stderr |

### Log Format

```
[2024-01-15T10:30:00.000Z] [INFO] Message here {"data": "value"}
```

## Backup Configuration

### Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `backupFolder` | `.backups` | Folder for backups |
| `keepLast` | 5 | Backups to keep per note |

### Backup Filename Format

```
[folder_]notename_YYYY-MM-DDTHH-MM-SS-sssZ.md
```

Example: `Projects_MyProject_2024-01-15T10-30-00-000Z.md`

## Security Configuration

### Path Validation

All paths are validated to prevent:
- Path traversal (`../`)
- Symlink escapes
- Absolute paths outside vault

### Ignored Paths

The following paths are automatically ignored:
- `.obsidian/`
- `.git/`
- `.trash/`
- `.DS_Store`
- `node_modules/`
- Hidden files (starting with `.`)
