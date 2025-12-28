# Obsidian MCP Server - Testing Guide

This folder contains test scripts for each tool group. Copy and paste the prompts into Claude Desktop or Claude Code to test each functionality.

> **Note**: The vault is automatically registered when the MCP starts (from the path in your config). You don't need to register it manually.

## Quick Start

After configuring the MCP server, use this prompt to verify everything is working:

```
Test the Obsidian MCP connection:
1. List all configured vaults and show which is active
2. List the 5 most recent notes in the vault
3. Search for a common word in the vault
```

## Test Guides by Tool Group

| Group | File | Tools |
|-------|------|-------|
| Vault | [testing-vault.md](testing-vault.md) | list_vaults, set_active_vault, register_vault |
| Notes | [testing-notes.md](testing-notes.md) | list_notes, read_note, create_note, update_note, delete_note |
| Search | [testing-search.md](testing-search.md) | search_vault |
| Frontmatter | [testing-frontmatter.md](testing-frontmatter.md) | get_frontmatter, update_frontmatter |
| Tags | [testing-tags.md](testing-tags.md) | list_tags, add_tag, remove_tag, search_by_tag |
| Links | [testing-links.md](testing-links.md) | get_outlinks, get_backlinks, find_orphans, find_broken_links, get_link_graph |
| Daily Notes | [testing-daily-notes.md](testing-daily-notes.md) | get_daily_note, create_daily_note, list_daily_notes, append_to_daily |
| Templates | [testing-templates.md](testing-templates.md) | list_templates, get_template, apply_template, create_from_template |
| Bases | [testing-bases.md](testing-bases.md) | list_bases, get_base, query_base |

## Full System Test

Use this comprehensive test to verify all enabled tool groups:

```
Perform a comprehensive test of the Obsidian MCP:

1. **Vault**: List all vaults and show which is active

2. **Notes**:
   - List the 5 most recent notes
   - Create a test note "mcp-full-test.md" with heading and some content
   - Read the note back

3. **Search**: Search for "test" across the vault

4. **Cleanup**: Delete the test note "mcp-full-test.md"

Report the status of each operation.
```

## Enabling Tool Groups

To enable specific tool groups, use the `--tools` flag:

```bash
# Basic CRUD only
--tools=vault,notes,search

# Full productivity suite
--tools=vault,notes,search,daily,tags,frontmatter

# All tools
--tools=all
```

## Troubleshooting

If tests fail, check:

1. **MCP Status**: Use `/mcp` command in Claude to check connection
2. **Vault Path**: Ensure the vault path in config is correct
3. **Permissions**: Verify read/write access to the vault folder
4. **Tool Groups**: Confirm the required tool group is enabled in `--tools`
