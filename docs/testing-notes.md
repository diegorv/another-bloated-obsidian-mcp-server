# Testing Notes Tools

Tools: `list_notes`, `read_note`, `create_note`, `update_note`, `delete_note`

## Test 1: List All Notes

```
List all notes in the vault
```

Expected: Returns a list of markdown files with paths, names, and modification dates.

---

## Test 2: List Notes in Specific Folder

```
List all notes in the "Daily" folder (or any folder that exists in your vault)
```

Expected: Returns only notes from the specified folder.

---

## Test 3: List Notes (Non-Recursive)

```
List notes in the root folder only, without including subfolders
```

Expected: Returns only notes at the vault root level.

---

## Test 4: Create a New Note

```
Create a note called "mcp-test.md" with the following content:

# MCP Test Note

This note was created by the Obsidian MCP server.

## Features
- Automatic note creation
- Frontmatter support
- Markdown formatting

Add frontmatter with tags: ["test", "mcp"] and status: "draft"
```

Expected: Note is created with content and YAML frontmatter.

---

## Test 5: Create Note in Subfolder

```
Create a note at "Tests/nested-test.md" with content "# Nested Test\n\nThis is a nested note."
```

Expected: Creates the "Tests" folder if it doesn't exist and creates the note.

---

## Test 6: Read a Note

```
Read the content of "mcp-test.md"
```

Expected: Returns the markdown content and parsed frontmatter.

---

## Test 7: Update Note (Overwrite)

```
Update "mcp-test.md" by replacing all content with:

# Updated MCP Test

This content has been completely replaced.

Updated at: [current date]
```

Expected: Note content is completely replaced.

---

## Test 8: Update Note (Append)

```
Append the following to "mcp-test.md":

---

## Appended Section

This section was added at the end of the note.
```

Expected: New content is added at the end of the file.

---

## Test 9: Update Note (Prepend)

```
Prepend the following to "mcp-test.md":

<!-- Last modified by MCP -->

```

Expected: New content is added at the beginning of the file.

---

## Test 10: Delete a Note

```
Delete the note "mcp-test.md"
```

Expected: Note is permanently deleted.

---

---

## Test 11: Update Note - Replace Mode (First Occurrence)

```
Tool: update_note
Parameters:
{
  "path": "test-replace.md",
  "content": "NEW TEXT",
  "mode": "replace",
  "search": "old text"
}
```

Expected: Replaces only the first occurrence of "old text" with "NEW TEXT". Verify `replacements = 1`.

---

## Test 12: Update Note - Replace All Occurrences

```
Tool: update_note
Parameters:
{
  "path": "test-replace.md",
  "content": "REPLACED",
  "mode": "replace",
  "search": "word",
  "replaceAll": true
}
```

Expected: Replaces ALL occurrences of "word". Verify `replacements` equals the number of occurrences.

---

## Test 13: Update Note - Replace with Regex

```
Tool: update_note
Parameters:
{
  "path": "test-replace.md",
  "content": "DATE: $1/$2/$3",
  "mode": "replace",
  "search": "(\\d{2})-(\\d{2})-(\\d{4})",
  "useRegex": true,
  "replaceAll": true
}
```

Expected: Transforms dates from DD-MM-YYYY format to DATE: DD/MM/YYYY.

---

## Test 14: Update Note - Replace with No Match

```
Tool: update_note
Parameters:
{
  "path": "test-replace.md",
  "content": "new",
  "mode": "replace",
  "search": "non-existent text"
}
```

Expected: `replacements = 0`, file unchanged.

---

## Test 15: Update Note - Replace Mode Without Search Parameter (Error)

```
Tool: update_note
Parameters:
{
  "path": "test-replace.md",
  "content": "new",
  "mode": "replace"
}
```

Expected: Error - "search" parameter is required.

---

## Test 16: Update Note - Prepend with Frontmatter Conflict

```
Tool: update_note
Parameters:
{
  "path": "note-with-frontmatter.md",
  "content": "---\ntitle: New\n---\nContent",
  "mode": "prepend"
}
```

Expected: Error - FrontmatterConflictError. Message: "Cannot prepend content starting with '---'".

---

## Test 17: Update Note - Forced Prepend with ignoreFrontmatterConflict

```
Tool: update_note
Parameters:
{
  "path": "note-with-frontmatter.md",
  "content": "---\ntitle: New\n---\nContent",
  "mode": "prepend",
  "ignoreFrontmatterConflict": true
}
```

Expected: Success - content added even with "---" prefix.

---

## Test 18: Update Note - Normal Prepend (Without "---")

```
Tool: update_note
Parameters:
{
  "path": "note-with-frontmatter.md",
  "content": "New paragraph at the beginning\n\n",
  "mode": "prepend"
}
```

Expected: Success - content added after frontmatter.

---

## Test 19: Rename Note - Simple Rename

```
Tool: rename_note
Parameters:
{
  "oldPath": "Original.md",
  "newPath": "Renamed.md"
}
```

Expected:
- File renamed
- `linksUpdated >= 0`

---

## Test 20: Rename Note - Move to Another Folder

```
Tool: rename_note
Parameters:
{
  "oldPath": "Note.md",
  "newPath": "Archive/Note.md"
}
```

Expected: Note moved to Archive folder.

---

## Test 21: Rename Note - With Link Updates

```
Preparation: Create note "Target.md" and another note with [[Target]] link

Tool: rename_note
Parameters:
{
  "oldPath": "Target.md",
  "newPath": "NewTarget.md",
  "updateLinks": true
}
```

Expected:
- `linksUpdated >= 1`
- Links [[Target]] changed to [[NewTarget]]

---

## Test 22: Rename Note - Without Link Updates

```
Tool: rename_note
Parameters:
{
  "oldPath": "Target.md",
  "newPath": "NewTarget.md",
  "updateLinks": false
}
```

Expected: `linksUpdated = 0`, links not changed.

---

## Test 23: Rename Note - Non-Existent Note (Error)

```
Tool: rename_note
Parameters:
{
  "oldPath": "DoesNotExist.md",
  "newPath": "New.md"
}
```

Expected: Error - NoteNotFoundError.

---

## Test 24: Rename Note - Target Path Already Exists (Error)

```
Tool: rename_note
Parameters:
{
  "oldPath": "Note1.md",
  "newPath": "Note2.md"  // already exists
}
```

Expected: Error - NoteAlreadyExistsError.

---

## Test 25: Move Note - To Existing Folder

```
Tool: move_note
Parameters:
{
  "path": "Inbox/Note.md",
  "destinationFolder": "Projects"
}
```

Expected:
- `newPath: "Projects/Note.md"`
- `linksUpdated >= 0`

---

## Test 26: Move Note - To Vault Root

```
Tool: move_note
Parameters:
{
  "path": "Folder/Note.md",
  "destinationFolder": ""
}
```

Expected: `newPath: "Note.md"`

---

## Test 27: Move Note - To New Folder (Auto-Created)

```
Tool: move_note
Parameters:
{
  "path": "Note.md",
  "destinationFolder": "New/Nested/Folder"
}
```

Expected:
- Folder created
- `newPath: "New/Nested/Folder/Note.md"`

---

## Test 28: Move Note - With Link Updates

```
Tool: move_note
Parameters:
{
  "path": "Source.md",
  "destinationFolder": "Archive",
  "updateLinks": true
}
```

Expected: Links updated in other notes.

---

## Test 29: List Notes - Sort by Name

```
Tool: list_notes
Parameters:
{
  "sortBy": "name",
  "sortOrder": "asc"
}
```

Expected: Notes sorted alphabetically A-Z.

---

## Test 30: List Notes - Sort by Creation Date

```
Tool: list_notes
Parameters:
{
  "sortBy": "created",
  "sortOrder": "desc"
}
```

Expected: Most recent notes first.

---

## Test 31: List Notes - Pagination

```
Tool: list_notes
Parameters:
{
  "limit": 10,
  "offset": 0
}
```

Expected:
- Maximum 10 notes returned
- `hasMore: true` (if there are more)
- `total`: total number of notes

---

## Test 32: List Notes - Second Page

```
Tool: list_notes
Parameters:
{
  "limit": 10,
  "offset": 10
}
```

Expected: Next 10 notes.

---

## Test 33: List Notes - Filter by Name Pattern (Regex)

```
Tool: list_notes
Parameters:
{
  "namePattern": "^2024"
}
```

Expected: Only notes that start with "2024".

---

## Test 34: List Notes - Invalid Regex Pattern

```
Tool: list_notes
Parameters:
{
  "namePattern": "[invalid"
}
```

Expected: Error - Invalid name pattern regex.

---

## Test 35: List Notes - Combined Filters

```
Tool: list_notes
Parameters:
{
  "folder": "Projects",
  "sortBy": "modified",
  "sortOrder": "desc",
  "limit": 5,
  "namePattern": ".*-draft$"
}
```

Expected: 5 most recent notes from Projects that end with "-draft".

---

## Full Flow Test

```
Perform a complete CRUD test:
1. Create a note "crud-test.md" with a title and some content, include frontmatter with author: "MCP" and date: today
2. Read the note to verify it was created correctly
3. Append a new section called "## Updates" with some text
4. Read the note again to verify the append worked
5. List all notes to see the new note in the list
6. Delete the test note
7. List notes again to confirm deletion
```
