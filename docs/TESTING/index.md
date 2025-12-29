# Live Testing Guide

This section contains **interactive test scripts** designed to be run directly in an AI assistant (like Claude Code) that has the Obsidian MCP server configured.

## What are these tests?

These are structured test scenarios that you can paste directly into your AI assistant conversation. Each test script:

- Contains step-by-step instructions for the AI to execute
- Tests specific MCP tools and their parameters
- Includes expected results for validation
- Reports what worked and what didn't at the end

## How to use

1. **Configure the MCP server** in your AI assistant (see [Getting Started](/guide/GETTING-STARTED))
2. **Open any test file** from the list below
3. **Copy the entire content** of the test file
4. **Paste it into your AI assistant** (Claude Code, Claude Desktop, etc.)
5. The AI will execute each test and provide a summary of results

::: tip
The tests are designed to run without stopping on errors. At the end, the AI will list what worked, what failed, and suggest improvements if any are identified.
:::

## Test Categories

| Test | Description | Tools Covered |
|------|-------------|---------------|
| [Vault](/TESTING/TESTING-VAULT) | Vault structure and information | `get_vault_info`, `list_folders`, `create_folder`, `delete_folder` |
| [Notes](/TESTING/TESTING-NOTES) | CRUD operations on notes | `list_notes`, `read_note`, `create_note`, `update_note`, `delete_note`, `rename_note`, `move_note` |
| [Search](/TESTING/TESTING-SEARCH) | Full-text search capabilities | `search_notes` |
| [Frontmatter](/TESTING/TESTING-FRONTMATTER) | YAML frontmatter manipulation | `get_frontmatter`, `update_frontmatter` |
| [Tags](/TESTING/TESTING-TAGS) | Tag management | `list_tags`, `get_notes_by_tag`, `rename_tag` |
| [Links](/TESTING/TESTING-LINKS) | Link analysis and management | `list_links`, `get_outgoing_links`, `get_incoming_links`, `get_orphan_notes` |
| [Daily Notes](/TESTING/TESTING-DAILY-NOTES) | Daily notes functionality | `create_daily_note`, `get_daily_note`, `list_daily_notes` |
| [Templates](/TESTING/TESTING-TEMPLATES) | Template system | `list_templates`, `apply_template` |
| [Bases](/TESTING/TESTING-BASES) | Database-like queries | `query_notes` |
| [Batch](/TESTING/TESTING-BATCH) | Batch operations | `batch_create_notes`, `batch_update_notes`, `batch_delete_notes` |
| [Attachments](/TESTING/TESTING-ATTACHMENTS) | File attachments | `list_attachments`, `get_attachment`, `attach_file` |
| [Backup](/TESTING/TESTING-BACKUP) | Backup and restore | `backup_vault`, `restore_backup` |

## Example Usage

Here's how a typical test session looks:

```
User: [pastes content of TESTING-NOTES.MD]

AI: I'll run through the Notes testing script...

## Test 1: List All Notes ✓
Successfully listed 47 notes in the vault.

## Test 2: List Notes in Specific Folder ✓
Found 12 notes in the "Daily" folder.

[... continues through all tests ...]

## Summary
- Tests passed: 32/35
- Tests failed: 3
  - Test 24: NoteAlreadyExistsError not thrown (possible bug)
  - ...

## Suggestions for Improvement
- Consider adding better error messages for...
```

## Writing Your Own Tests

Feel free to modify these tests or create your own! The format is simple:

1. Start with instructions for the AI
2. Define each test with clear inputs and expected outputs
3. Use markdown code blocks for tool parameters
4. Include a summary section request

::: warning
These tests may create, modify, or delete files in your vault. Use a **test vault** or ensure you have backups before running destructive tests.
:::
