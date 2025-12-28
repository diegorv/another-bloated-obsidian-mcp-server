According to the Obsidian MCP that I'm running, run the script below. At the end, list what worked and what didn't work. If you understand that there are opportunities for improvement, list them too. Don't stop the script if any error happens.

# Testing Backup System Tools

Tools: `create_note_backup`, `list_backups`, `restore_backup`, `delete_old_backups`

## Test 1: Create Note Backup

```
Tool: create_note_backup
Parameters:
{
  "path": "important-note.md"
}
```

Expected:
- Backup created in `.backups/`
- `backupPath` returned
- Name includes timestamp

---

## Test 2: List Backups

```
Tool: list_backups
Parameters:
{
  "path": "important-note.md"
}
```

Expected:
- List of existing backups
- Sorted by date (most recent first)
- `timestamp` and `backupPath` for each

---

## Test 3: List Backups - Note Without Backups

```
Tool: list_backups
Parameters:
{
  "path": "note-without-backup.md"
}
```

Expected: `backups: []` (empty array)

---

## Test 4: Restore Backup

```
Preparation: Create backup, modify original note

Tool: restore_backup
Parameters:
{
  "path": "important-note.md",
  "backupPath": ".backups/important-note.2024-01-15T10-30-00.md"
}
```

Expected:
- Note restored to backup version
- `restored: true`

---

## Test 5: Restore Backup - Non-Existent Backup (Error)

```
Tool: restore_backup
Parameters:
{
  "path": "note.md",
  "backupPath": ".backups/non-existent.md"
}
```

Expected: Error - Backup not found.

---

## Test 6: Delete Old Backups

```
Tool: delete_old_backups
Parameters:
{
  "path": "important-note.md",
  "keepCount": 3
}
```

Expected:
- Keeps only the 3 most recent backups
- `deleted`: number of backups removed
- `remaining: 3`

---

## Test 7: Delete Old Backups - Keep All

```
Tool: delete_old_backups
Parameters:
{
  "path": "note.md",
  "keepCount": 100
}
```

Expected: `deleted: 0` (none removed if there are fewer than 100)

---

## Full Flow Test

```
Test backup system:
1. Create a new note "backup-test.md" with initial content
2. Create a backup using create_note_backup
3. Modify the original note significantly
4. Create another backup
5. List all backups using list_backups (should show 2 backups)
6. Modify the note again
7. Restore the first backup using restore_backup
8. Verify the note content matches the first backup
9. Create 3 more backups (total of 5)
10. Use delete_old_backups with keepCount: 2
11. List backups again (should show only 2)
12. Clean up test note and remaining backups
```
