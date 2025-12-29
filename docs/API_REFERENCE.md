# API Reference

Complete reference for all 47 tools provided by the Obsidian MCP Server.

## Table of Contents

- [Vault Management](#vault-management) (3 tools)
- [Notes](#notes) (7 tools)
- [Search](#search) (1 tool)
- [Frontmatter](#frontmatter) (5 tools)
- [Tags](#tags) (4 tools)
- [Links](#links) (5 tools)
- [Daily Notes](#daily-notes) (4 tools)
- [Templates](#templates) (4 tools)
- [Bases](#bases) (3 tools)
- [Batch Operations](#batch-operations) (6 tools)
- [Attachments](#attachments) (4 tools)
- [Backup](#backup) (4 tools)

---

## Vault Management

Tools for managing Obsidian vaults. Tool group: `vault`

### list_vaults

List all configured Obsidian vaults and show which one is currently active.

**Parameters**

None required.

**Returns**

```json
{
  "vaults": ["personal", "work"],
  "active": "personal",
  "details": [
    { "name": "personal", "path": "/path/to/personal" },
    { "name": "work", "path": "/path/to/work" }
  ]
}
```

**Example Request**

```json
{
  "name": "list_vaults",
  "arguments": {}
}
```

---

### set_active_vault

Set the active vault for subsequent operations.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| vault | string | Yes | - | Name of the vault to set as active |

**Returns**

```json
{
  "success": true,
  "vault": "work"
}
```

**Example Request**

```json
{
  "name": "set_active_vault",
  "arguments": {
    "vault": "work"
  }
}
```

**Error Codes**

- `VAULT_NOT_FOUND`: The specified vault does not exist

---

### register_vault

Register a new Obsidian vault with a name and path.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | Yes | - | Name to identify the vault |
| path | string | Yes | - | Absolute path to the vault directory |

**Returns**

```json
{
  "success": true,
  "message": "Vault \"research\" registered at /path/to/research"
}
```

**Example Request**

```json
{
  "name": "register_vault",
  "arguments": {
    "name": "research",
    "path": "/Users/you/Obsidian/Research"
  }
}
```

**Edge Cases**

- Path must be absolute, not relative
- Path must contain a `.obsidian` folder
- Vault name must be unique

---

## Notes

Tools for CRUD operations on notes. Tool group: `notes`

### list_notes

List markdown notes in the vault with sorting, filtering, and pagination.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| folder | string | No | - | Filter notes by folder path |
| recursive | boolean | No | true | Include notes in subfolders |
| sortBy | string | No | "modified" | Sort by: "name", "modified", or "created" |
| sortOrder | string | No | "desc" | Sort order: "asc" or "desc" |
| limit | number | No | - | Maximum number of notes to return |
| offset | number | No | 0 | Number of notes to skip (pagination) |
| namePattern | string | No | - | Filter notes by name (regex pattern) |

**Returns**

```json
{
  "notes": [
    {
      "path": "Projects/MyProject.md",
      "name": "MyProject",
      "modified": "2024-01-15T10:30:00.000Z",
      "created": "2024-01-01T08:00:00.000Z",
      "size": 2048
    }
  ],
  "count": 1,
  "total": 150,
  "hasMore": true
}
```

**Example Request**

```json
{
  "name": "list_notes",
  "arguments": {
    "folder": "Projects",
    "sortBy": "modified",
    "limit": 10
  }
}
```

---

### read_note

Read the content and frontmatter of a specific note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note (relative to vault root) |

**Returns**

```json
{
  "path": "Projects/MyProject.md",
  "content": "# My Project\n\nProject description...",
  "frontmatter": {
    "tags": ["project", "active"],
    "status": "in-progress"
  }
}
```

**Example Request**

```json
{
  "name": "read_note",
  "arguments": {
    "path": "Projects/MyProject.md"
  }
}
```

**Error Codes**

- `NOTE_NOT_FOUND`: The specified note does not exist
- `PATH_TRAVERSAL`: Attempted path traversal attack detected

---

### create_note

Create a new markdown note in the vault.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path for the new note |
| content | string | Yes | - | Markdown content for the note |
| frontmatter | object | No | - | YAML frontmatter as key-value pairs |

**Returns**

```json
{
  "success": true,
  "path": "Projects/NewProject.md"
}
```

**Example Request**

```json
{
  "name": "create_note",
  "arguments": {
    "path": "Projects/NewProject.md",
    "content": "# New Project\n\nDescription here.",
    "frontmatter": {
      "tags": ["project"],
      "status": "planning"
    }
  }
}
```

**Edge Cases**

- Parent directories are created automatically
- `.md` extension is added if not provided
- Fails if note already exists

**Error Codes**

- `NOTE_EXISTS`: A note already exists at the specified path
- `INVALID_PATH`: The path contains invalid characters

---

### update_note

Update an existing note with different modes.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| content | string | Yes | - | New content or replacement text |
| mode | string | No | "overwrite" | Update mode: "overwrite", "append", "prepend", "replace" |
| search | string | No | - | Text to search for (required for replace mode) |
| replaceAll | boolean | No | false | Replace all occurrences |
| useRegex | boolean | No | false | Treat search as regex |
| ignoreFrontmatterConflict | boolean | No | false | Force prepend even if content starts with "---" |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "mode": "append"
}
```

For replace mode:

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "mode": "replace",
  "replacements": 3
}
```

**Example Request - Append**

```json
{
  "name": "update_note",
  "arguments": {
    "path": "Projects/MyProject.md",
    "content": "\n## New Section\n\nAdditional content.",
    "mode": "append"
  }
}
```

**Example Request - Find and Replace**

```json
{
  "name": "update_note",
  "arguments": {
    "path": "Projects/MyProject.md",
    "content": "completed",
    "mode": "replace",
    "search": "in-progress",
    "replaceAll": true
  }
}
```

**Edge Cases**

- Replace mode requires the `search` parameter
- Prepend mode errors if content starts with "---" (use `ignoreFrontmatterConflict` to override)

**Error Codes**

- `NOTE_NOT_FOUND`: The note does not exist
- `FRONTMATTER_CONFLICT`: Prepend content conflicts with frontmatter

---

### delete_note

Permanently delete a note from the vault.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note to delete |

**Returns**

```json
{
  "success": true,
  "deleted": "Projects/OldProject.md"
}
```

**Example Request**

```json
{
  "name": "delete_note",
  "arguments": {
    "path": "Projects/OldProject.md"
  }
}
```

**Edge Cases**

- This action cannot be undone
- Does not update links in other notes

**Error Codes**

- `NOTE_NOT_FOUND`: The note does not exist

---

### rename_note

Rename a note and optionally update all wikilinks that reference it.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| oldPath | string | Yes | - | Current path of the note |
| newPath | string | Yes | - | New path for the note |
| updateLinks | boolean | No | true | Update wikilinks in other notes |

**Returns**

```json
{
  "success": true,
  "oldPath": "Projects/OldName.md",
  "newPath": "Projects/NewName.md",
  "linksUpdated": 5
}
```

**Example Request**

```json
{
  "name": "rename_note",
  "arguments": {
    "oldPath": "Projects/OldName.md",
    "newPath": "Projects/NewName.md",
    "updateLinks": true
  }
}
```

**Error Codes**

- `NOTE_NOT_FOUND`: The source note does not exist
- `NOTE_EXISTS`: A note already exists at the new path

---

### move_note

Move a note to a different folder.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note to move |
| destinationFolder | string | Yes | - | Destination folder (use "" for root) |
| updateLinks | boolean | No | true | Update wikilinks in other notes |

**Returns**

```json
{
  "success": true,
  "oldPath": "Inbox/Note.md",
  "newPath": "Projects/Note.md",
  "destinationFolder": "Projects",
  "linksUpdated": 2
}
```

**Example Request**

```json
{
  "name": "move_note",
  "arguments": {
    "path": "Inbox/Note.md",
    "destinationFolder": "Projects",
    "updateLinks": true
  }
}
```

---

## Search

Tools for searching vault content. Tool group: `search`

### search_vault

Search for text across all notes in the vault.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Text to search for (or regex if useRegex=true) |
| caseSensitive | boolean | No | false | Case-sensitive search |
| folder | string | No | - | Limit search to a specific folder |
| maxResults | number | No | 50 | Maximum number of files to return |
| useRegex | boolean | No | false | Treat query as regular expression |
| contextLines | number | No | 0 | Lines to include before/after each match |

**Returns**

```json
{
  "query": "project",
  "resultCount": 15,
  "results": [
    {
      "path": "Projects/MyProject.md",
      "matches": [
        {
          "line": 5,
          "content": "This is my main project for 2024.",
          "context": {
            "before": ["## Overview"],
            "after": ["It focuses on..."]
          }
        }
      ]
    }
  ]
}
```

**Example Request**

```json
{
  "name": "search_vault",
  "arguments": {
    "query": "TODO|FIXME",
    "useRegex": true,
    "contextLines": 2
  }
}
```

---

## Frontmatter

Tools for managing YAML frontmatter. Tool group: `frontmatter`

### get_frontmatter

Get the YAML frontmatter of a note as a JSON object.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |

**Returns**

```json
{
  "path": "Projects/MyProject.md",
  "frontmatter": {
    "tags": ["project", "active"],
    "status": "in-progress",
    "created": "2024-01-01"
  },
  "hasFrontmatter": true
}
```

**Example Request**

```json
{
  "name": "get_frontmatter",
  "arguments": {
    "path": "Projects/MyProject.md"
  }
}
```

---

### update_frontmatter

Update the YAML frontmatter of a note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| updates | object | Yes | - | Key-value pairs to update |
| replace | boolean | No | false | Replace all frontmatter instead of merging |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "frontmatter": {
    "tags": ["project", "active"],
    "status": "completed",
    "completed": "2024-01-15"
  }
}
```

**Example Request**

```json
{
  "name": "update_frontmatter",
  "arguments": {
    "path": "Projects/MyProject.md",
    "updates": {
      "status": "completed",
      "completed": "2024-01-15"
    }
  }
}
```

**Edge Cases**

- Set a value to `null` to remove a field
- Use `replace: true` to completely replace frontmatter

---

### remove_frontmatter_field

Remove a specific field from the frontmatter.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| field | string | Yes | - | Name of the field to remove |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "field": "status",
  "removed": true
}
```

**Example Request**

```json
{
  "name": "remove_frontmatter_field",
  "arguments": {
    "path": "Projects/MyProject.md",
    "field": "status"
  }
}
```

---

### add_to_array_field

Add values to an array field in frontmatter.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| field | string | Yes | - | Name of the array field |
| values | array | Yes | - | Values to add |
| createIfMissing | boolean | No | true | Create the field if it doesn't exist |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "field": "tags",
  "added": ["important"],
  "currentValues": ["project", "active", "important"]
}
```

**Example Request**

```json
{
  "name": "add_to_array_field",
  "arguments": {
    "path": "Projects/MyProject.md",
    "field": "tags",
    "values": ["important", "urgent"]
  }
}
```

**Edge Cases**

- Duplicates are automatically ignored
- Errors if field exists but is not an array

---

### remove_from_array_field

Remove values from an array field in frontmatter.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| field | string | Yes | - | Name of the array field |
| values | array | Yes | - | Values to remove |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "field": "tags",
  "removed": ["old-tag"],
  "currentValues": ["project", "active"]
}
```

**Example Request**

```json
{
  "name": "remove_from_array_field",
  "arguments": {
    "path": "Projects/MyProject.md",
    "field": "tags",
    "values": ["old-tag"]
  }
}
```

---

## Tags

Tools for managing tags. Tool group: `tags`

### list_tags

List all unique tags used in the vault with occurrence count.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| folder | string | No | - | Limit tag search to a specific folder |

**Returns**

```json
{
  "totalTags": 25,
  "tags": [
    { "tag": "project", "count": 15 },
    { "tag": "idea", "count": 8 },
    { "tag": "todo", "count": 5 }
  ]
}
```

**Example Request**

```json
{
  "name": "list_tags",
  "arguments": {
    "folder": "Projects"
  }
}
```

---

### add_tag

Add a tag to a note's frontmatter.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| tag | string | Yes | - | Tag to add (with or without # prefix) |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "addedTag": "important"
}
```

**Example Request**

```json
{
  "name": "add_tag",
  "arguments": {
    "path": "Projects/MyProject.md",
    "tag": "important"
  }
}
```

**Edge Cases**

- Creates the `tags` array if it doesn't exist
- Normalizes tag (removes # prefix if present)

---

### remove_tag

Remove a tag from a note's frontmatter.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |
| tag | string | Yes | - | Tag to remove |

**Returns**

```json
{
  "success": true,
  "path": "Projects/MyProject.md",
  "removedTag": "old-tag"
}
```

**Example Request**

```json
{
  "name": "remove_tag",
  "arguments": {
    "path": "Projects/MyProject.md",
    "tag": "old-tag"
  }
}
```

---

### search_by_tag

Find all notes that have a specific tag.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| tag | string | Yes | - | Tag to search for |
| folder | string | No | - | Limit search to a specific folder |

**Returns**

```json
{
  "tag": "project",
  "count": 15,
  "notes": [
    "Projects/MyProject.md",
    "Projects/OtherProject.md",
    "Archive/OldProject.md"
  ]
}
```

**Example Request**

```json
{
  "name": "search_by_tag",
  "arguments": {
    "tag": "project",
    "folder": "Projects"
  }
}
```

**Edge Cases**

- Searches both frontmatter tags and inline #tags

---

## Links

Tools for analyzing links between notes. Tool group: `links`

### get_outlinks

Get all outgoing links from a note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |

**Returns**

```json
{
  "path": "Projects/MyProject.md",
  "count": 5,
  "outlinks": [
    { "target": "People/John.md", "alias": "John", "type": "wikilink" },
    { "target": "Concepts/Design.md", "alias": null, "type": "wikilink" },
    { "target": "https://example.com", "alias": "Example", "type": "external" }
  ]
}
```

**Example Request**

```json
{
  "name": "get_outlinks",
  "arguments": {
    "path": "Projects/MyProject.md"
  }
}
```

---

### get_backlinks

Get all notes that link to a specific note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |

**Returns**

```json
{
  "path": "People/John.md",
  "count": 3,
  "backlinks": [
    { "source": "Projects/MyProject.md", "alias": "John", "type": "wikilink" },
    { "source": "Daily/2024-01-15.md", "alias": null, "type": "wikilink" }
  ]
}
```

**Example Request**

```json
{
  "name": "get_backlinks",
  "arguments": {
    "path": "People/John.md"
  }
}
```

---

### find_orphans

Find all orphan notes (notes with no incoming or outgoing links).

**Parameters**

None required.

**Returns**

```json
{
  "count": 8,
  "orphans": [
    "Archive/OldNote.md",
    "Inbox/Untitled.md"
  ]
}
```

**Example Request**

```json
{
  "name": "find_orphans",
  "arguments": {}
}
```

---

### find_broken_links

Find all broken links (links pointing to non-existent notes).

**Parameters**

None required.

**Returns**

```json
{
  "count": 3,
  "brokenLinks": [
    {
      "source": "Projects/MyProject.md",
      "target": "People/Unknown.md",
      "type": "wikilink"
    }
  ]
}
```

**Example Request**

```json
{
  "name": "find_broken_links",
  "arguments": {}
}
```

---

### get_link_graph

Get the complete link graph of the vault as nodes and edges.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| maxNodes | number | No | 500 | Maximum number of nodes to include |

**Returns**

```json
{
  "nodeCount": 150,
  "edgeCount": 300,
  "nodes": ["Projects/MyProject.md", "People/John.md"],
  "edges": [
    { "source": "Projects/MyProject.md", "target": "People/John.md", "type": "wikilink" }
  ]
}
```

**Example Request**

```json
{
  "name": "get_link_graph",
  "arguments": {
    "maxNodes": 100
  }
}
```

---

## Daily Notes

Tools for managing daily notes. Tool group: `daily`

### get_daily_note

Get the daily note for a specific date. Creates it if it doesn't exist.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| date | string | No | today | Date in YYYY-MM-DD format |

**Returns**

```json
{
  "path": "Daily/2024-01-15.md",
  "date": "2024-01-15",
  "created": false,
  "content": "# 2024-01-15\n\n## Tasks\n..."
}
```

**Example Request**

```json
{
  "name": "get_daily_note",
  "arguments": {
    "date": "2024-01-15"
  }
}
```

**Edge Cases**

- Uses vault's daily notes configuration for folder and format
- Creates the note if it doesn't exist

---

### create_daily_note

Create a daily note for a specific date if it doesn't exist.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| date | string | No | today | Date in YYYY-MM-DD format |

**Returns**

```json
{
  "success": true,
  "path": "Daily/2024-01-15.md",
  "date": "2024-01-15",
  "created": true,
  "message": "Daily note created"
}
```

**Example Request**

```json
{
  "name": "create_daily_note",
  "arguments": {
    "date": "2024-01-15"
  }
}
```

---

### list_daily_notes

List daily notes, optionally filtered by date range.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string | No | - | Start date in YYYY-MM-DD format |
| endDate | string | No | - | End date in YYYY-MM-DD format |
| limit | number | No | 30 | Maximum number of notes to return |

**Returns**

```json
{
  "count": 15,
  "totalFound": 30,
  "config": {
    "folder": "Daily",
    "format": "YYYY-MM-DD"
  },
  "notes": [
    { "path": "Daily/2024-01-15.md", "date": "2024-01-15" },
    { "path": "Daily/2024-01-14.md", "date": "2024-01-14" }
  ]
}
```

**Example Request**

```json
{
  "name": "list_daily_notes",
  "arguments": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "limit": 10
  }
}
```

---

### append_to_daily

Append content to today's daily note (or a specific date).

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| content | string | Yes | - | Content to append |
| date | string | No | today | Date in YYYY-MM-DD format |

**Returns**

```json
{
  "success": true,
  "path": "Daily/2024-01-15.md",
  "date": "2024-01-15",
  "appended": "150 characters"
}
```

**Example Request**

```json
{
  "name": "append_to_daily",
  "arguments": {
    "content": "\n## Meeting Notes\n\n- Discussed project timeline\n- Action items assigned"
  }
}
```

**Edge Cases**

- Creates the daily note if it doesn't exist

---

## Templates

Tools for managing templates. Tool group: `templates`

### list_templates

List all available templates in the vault's templates folder.

**Parameters**

None required.

**Returns**

```json
{
  "folder": "Templates",
  "count": 5,
  "templates": [
    "Meeting Notes",
    "Project",
    "Daily Note",
    "Book Review"
  ]
}
```

**Example Request**

```json
{
  "name": "list_templates",
  "arguments": {}
}
```

---

### get_template

Get the raw content of a template file.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | Yes | - | Name of the template (without .md) |

**Returns**

```json
{
  "name": "Meeting Notes",
  "content": "# {{title}}\n\nDate: {{date}}\n\n## Attendees\n\n## Agenda\n\n## Notes\n\n## Action Items"
}
```

**Example Request**

```json
{
  "name": "get_template",
  "arguments": {
    "name": "Meeting Notes"
  }
}
```

---

### apply_template

Apply a template with variables and return processed content without creating a file.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | Yes | - | Name of the template |
| title | string | No | - | Title to replace {{title}} |
| variables | object | No | - | Custom variables as key-value pairs |

**Supported Variables**

- `{{title}}` - Title parameter
- `{{date}}` - Current date (YYYY-MM-DD)
- `{{date:FORMAT}}` - Date with custom format
- `{{time}}` - Current time (HH:mm)
- `{{variable}}` - Custom variables

**Returns**

```json
{
  "name": "Meeting Notes",
  "processedContent": "# Q1 Planning\n\nDate: 2024-01-15\n\n## Attendees\n\n## Agenda\n\n## Notes\n\n## Action Items"
}
```

**Example Request**

```json
{
  "name": "apply_template",
  "arguments": {
    "name": "Meeting Notes",
    "title": "Q1 Planning",
    "variables": {
      "project": "Obsidian MCP"
    }
  }
}
```

---

### create_from_template

Create a new note from a template with variable substitution.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| template | string | Yes | - | Name of the template |
| path | string | Yes | - | Path for the new note |
| title | string | No | - | Title for the note |
| variables | object | No | - | Custom variables |

**Returns**

```json
{
  "success": true,
  "path": "Meetings/Q1-Planning.md",
  "template": "Meeting Notes"
}
```

**Example Request**

```json
{
  "name": "create_from_template",
  "arguments": {
    "template": "Meeting Notes",
    "path": "Meetings/Q1-Planning.md",
    "title": "Q1 Planning Meeting"
  }
}
```

---

## Bases

Tools for querying Obsidian Bases (databases). Tool group: `bases`

### list_bases

List all Obsidian Bases (database files) in the vault.

**Parameters**

None required.

**Returns**

```json
{
  "count": 3,
  "bases": [
    { "name": "Tasks", "path": "Databases/Tasks.base" },
    { "name": "Books", "path": "Databases/Books.base" }
  ]
}
```

**Example Request**

```json
{
  "name": "list_bases",
  "arguments": {}
}
```

---

### get_base

Get the full content of an Obsidian Base including schema and all rows.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the .base file |

**Returns**

```json
{
  "name": "Tasks",
  "path": "Databases/Tasks.base",
  "columnCount": 5,
  "rowCount": 25,
  "columns": [
    { "name": "Task", "type": "text" },
    { "name": "Status", "type": "select" },
    { "name": "Due Date", "type": "date" }
  ],
  "rows": [
    { "Task": "Review PR", "Status": "In Progress", "Due Date": "2024-01-15" }
  ]
}
```

**Example Request**

```json
{
  "name": "get_base",
  "arguments": {
    "path": "Databases/Tasks.base"
  }
}
```

---

### query_base

Query an Obsidian Base with filtering, sorting, and limiting.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the .base file |
| filter | object | No | - | Filter conditions as key-value pairs |
| sortColumn | string | No | - | Column to sort by |
| sortOrder | string | No | "asc" | Sort order: "asc" or "desc" |
| limit | number | No | - | Maximum rows to return |

**Returns**

```json
{
  "path": "Databases/Tasks.base",
  "resultCount": 5,
  "rows": [
    { "Task": "Review PR", "Status": "Done", "Due Date": "2024-01-15" }
  ]
}
```

**Example Request**

```json
{
  "name": "query_base",
  "arguments": {
    "path": "Databases/Tasks.base",
    "filter": { "Status": "Done" },
    "sortColumn": "Due Date",
    "sortOrder": "desc",
    "limit": 10
  }
}
```

---

## Batch Operations

Tools for batch operations on multiple notes. Tool group: `batch`

### batch_move

Move multiple notes to a destination folder at once.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | Array of note paths to move |
| destinationFolder | string | Yes | - | Destination folder path |
| updateLinks | boolean | No | true | Update wikilinks in other notes |

**Returns**

```json
{
  "success": true,
  "total": 5,
  "succeeded": 5,
  "failed": 0,
  "results": [
    { "path": "Inbox/Note1.md", "success": true, "details": { "newPath": "Archive/Note1.md" } },
    { "path": "Inbox/Note2.md", "success": true, "details": { "newPath": "Archive/Note2.md" } }
  ]
}
```

**Example Request**

```json
{
  "name": "batch_move",
  "arguments": {
    "paths": ["Inbox/Note1.md", "Inbox/Note2.md"],
    "destinationFolder": "Archive"
  }
}
```

---

### batch_delete

Delete multiple notes at once. Requires confirmation.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | Array of note paths to delete |
| confirm | boolean | Yes | - | Must be true to confirm deletion |

**Returns**

```json
{
  "success": true,
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    { "path": "Trash/Note1.md", "success": true },
    { "path": "Trash/Note2.md", "success": true }
  ]
}
```

**Example Request**

```json
{
  "name": "batch_delete",
  "arguments": {
    "paths": ["Trash/Note1.md", "Trash/Note2.md"],
    "confirm": true
  }
}
```

**Edge Cases**

- Fails if `confirm` is not `true`
- Individual failures don't stop other deletions

---

### batch_update_frontmatter

Update frontmatter of multiple notes at once.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | Array of note paths |
| updates | object | Yes | - | Key-value pairs to update |
| replace | boolean | No | false | Replace all frontmatter |

**Returns**

```json
{
  "success": true,
  "total": 5,
  "succeeded": 5,
  "failed": 0,
  "results": [
    { "path": "Projects/A.md", "success": true, "details": { "frontmatter": {...} } }
  ]
}
```

**Example Request**

```json
{
  "name": "batch_update_frontmatter",
  "arguments": {
    "paths": ["Projects/A.md", "Projects/B.md"],
    "updates": { "status": "archived", "archived_date": "2024-01-15" }
  }
}
```

---

### batch_add_tag

Add tags to multiple notes at once.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | Array of note paths |
| tags | string[] | Yes | - | Tags to add (without # prefix) |

**Returns**

```json
{
  "success": true,
  "total": 5,
  "succeeded": 5,
  "failed": 0,
  "results": [
    { "path": "A.md", "success": true, "details": { "addedTags": ["archived"], "currentTags": [...] } }
  ]
}
```

**Example Request**

```json
{
  "name": "batch_add_tag",
  "arguments": {
    "paths": ["Projects/A.md", "Projects/B.md"],
    "tags": ["archived", "2024"]
  }
}
```

---

### batch_remove_tag

Remove tags from multiple notes at once.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | Array of note paths |
| tags | string[] | Yes | - | Tags to remove (without # prefix) |

**Returns**

```json
{
  "success": true,
  "total": 5,
  "succeeded": 5,
  "failed": 0,
  "results": [
    { "path": "A.md", "success": true, "details": { "removedTags": ["active"], "currentTags": [...] } }
  ]
}
```

**Example Request**

```json
{
  "name": "batch_remove_tag",
  "arguments": {
    "paths": ["Projects/A.md", "Projects/B.md"],
    "tags": ["active"]
  }
}
```

---

### batch_read_notes

Read multiple notes at once (max 10).

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| paths | string[] | Yes | - | Array of note paths (max 10) |
| includeContent | boolean | No | true | Include note content |
| includeFrontmatter | boolean | No | true | Include parsed frontmatter |

**Returns**

```json
{
  "success": true,
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    {
      "path": "Projects/A.md",
      "success": true,
      "content": "# Project A\n...",
      "frontmatter": { "tags": ["project"] }
    }
  ]
}
```

**Example Request**

```json
{
  "name": "batch_read_notes",
  "arguments": {
    "paths": ["Projects/A.md", "Projects/B.md", "Projects/C.md"],
    "includeContent": true,
    "includeFrontmatter": true
  }
}
```

---

## Attachments

Tools for managing attachments. Tool group: `attachments`

### list_attachments

List all non-markdown files (images, PDFs, etc.) in the vault.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| folder | string | No | - | Folder to search |
| type | string | No | "all" | Filter by type: "image", "document", "audio", "video", "other", "all" |

**Supported File Types**

- **image**: png, jpg, jpeg, gif, bmp, svg, webp, ico, tiff
- **document**: pdf, doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp
- **audio**: mp3, wav, ogg, flac, m4a, aac, wma
- **video**: mp4, mkv, avi, mov, webm, wmv, flv
- **other**: zip, rar, 7z, tar, gz, csv, json, xml

**Returns**

```json
{
  "attachments": [
    {
      "path": "Attachments/image.png",
      "name": "image.png",
      "extension": ".png",
      "size": 102400,
      "modified": "2024-01-15T10:30:00.000Z",
      "type": "image"
    }
  ],
  "count": 25,
  "totalSize": 15728640
}
```

**Example Request**

```json
{
  "name": "list_attachments",
  "arguments": {
    "type": "image"
  }
}
```

---

### get_attachment_info

Get detailed information about an attachment.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the attachment file |

**Returns**

```json
{
  "path": "Attachments/diagram.png",
  "name": "diagram.png",
  "extension": ".png",
  "type": "image",
  "size": 102400,
  "created": "2024-01-01T08:00:00.000Z",
  "modified": "2024-01-15T10:30:00.000Z",
  "embedSyntax": "![[diagram.png]]",
  "linkSyntax": "[[diagram.png]]"
}
```

**Example Request**

```json
{
  "name": "get_attachment_info",
  "arguments": {
    "path": "Attachments/diagram.png"
  }
}
```

---

### find_unused_attachments

Find attachments that are not referenced by any note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| folder | string | No | - | Folder to search for attachments |

**Returns**

```json
{
  "unused": [
    {
      "path": "Attachments/old-image.png",
      "name": "old-image.png",
      "extension": ".png",
      "size": 51200,
      "type": "image"
    }
  ],
  "count": 5,
  "totalSize": 256000,
  "totalAttachments": 50
}
```

**Example Request**

```json
{
  "name": "find_unused_attachments",
  "arguments": {}
}
```

**Edge Cases**

- References are searched vault-wide even if folder is specified
- Checks both wikilink and markdown link formats

---

### get_attachments_in_note

Get all attachment references in a specific note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note |

**Returns**

```json
{
  "note": "Projects/MyProject.md",
  "attachments": [
    {
      "reference": "![[diagram.png]]",
      "name": "diagram.png",
      "type": "embed",
      "format": "wikilink"
    },
    {
      "reference": "[PDF](docs/spec.pdf)",
      "name": "spec.pdf",
      "type": "link",
      "format": "markdown"
    }
  ],
  "count": 2
}
```

**Example Request**

```json
{
  "name": "get_attachments_in_note",
  "arguments": {
    "path": "Projects/MyProject.md"
  }
}
```

---

## Backup

Tools for backup and restore. Tool group: `backup`

### create_note_backup

Create a backup copy of a note with timestamp.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| path | string | Yes | - | Path to the note to backup |
| backupFolder | string | No | ".backups" | Folder to store backups |

**Returns**

```json
{
  "success": true,
  "originalNote": "Projects/MyProject.md",
  "backupPath": ".backups/Projects_MyProject_2024-01-15T10-30-00-000Z.md",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Example Request**

```json
{
  "name": "create_note_backup",
  "arguments": {
    "path": "Projects/MyProject.md"
  }
}
```

---

### list_backups

List available backups, optionally filtered by note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| notePath | string | No | - | Filter backups for a specific note |
| backupFolder | string | No | ".backups" | Folder where backups are stored |

**Returns**

```json
{
  "backups": [
    {
      "path": ".backups/Projects_MyProject_2024-01-15T10-30-00-000Z.md",
      "originalNote": "Projects/MyProject.md",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "size": 2048
    }
  ],
  "count": 5
}
```

**Example Request**

```json
{
  "name": "list_backups",
  "arguments": {
    "notePath": "Projects/MyProject.md"
  }
}
```

---

### restore_backup

Restore a note from a backup.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| backupPath | string | Yes | - | Path to the backup file |
| targetPath | string | No | - | Target path (defaults to original) |
| createBackupFirst | boolean | No | true | Backup current content before restoring |

**Returns**

```json
{
  "success": true,
  "restoredTo": "Projects/MyProject.md",
  "fromBackup": ".backups/Projects_MyProject_2024-01-15T10-30-00-000Z.md",
  "previousBackupCreated": ".backups/Projects_MyProject_2024-01-16T08-00-00-000Z.md"
}
```

**Example Request**

```json
{
  "name": "restore_backup",
  "arguments": {
    "backupPath": ".backups/Projects_MyProject_2024-01-15T10-30-00-000Z.md",
    "createBackupFirst": true
  }
}
```

**Edge Cases**

- Creates backup of current note before overwriting (unless disabled)
- Backup metadata is stripped from restored content

---

### delete_old_backups

Delete old backups, keeping only the most recent ones per note.

**Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| keepLast | number | No | 5 | Number of recent backups to keep per note |
| backupFolder | string | No | ".backups" | Folder where backups are stored |
| dryRun | boolean | No | false | Only report what would be deleted |

**Returns**

```json
{
  "success": true,
  "deleted": [".backups/old_backup_1.md", ".backups/old_backup_2.md"],
  "count": 2,
  "dryRun": false
}
```

**Example Request (Dry Run)**

```json
{
  "name": "delete_old_backups",
  "arguments": {
    "keepLast": 3,
    "dryRun": true
  }
}
```

**Returns (Dry Run)**

```json
{
  "success": true,
  "deleted": [],
  "wouldDelete": [".backups/old_backup_1.md", ".backups/old_backup_2.md"],
  "count": 2,
  "dryRun": true
}
```
