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
