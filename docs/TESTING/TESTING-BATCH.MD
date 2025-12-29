According to the Obsidian MCP that I'm running, run the script below. At the end, list what worked and what didn't work. If you understand that there are opportunities for improvement, list them too. Don't stop the script if any error happens.

# Testing Batch Operations Tools

Tools: `batch_move`, `batch_delete`, `batch_update_frontmatter`, `batch_add_tag`, `batch_remove_tag`

## Test 1: Batch Move - Multiple Notes

```
Tool: batch_move
Parameters:
{
  "paths": ["Note1.md", "Note2.md", "Note3.md"],
  "destinationFolder": "Archive"
}
```

Expected:
- `total: 3`
- `succeeded: 3` (or fewer if some fail)
- `results`: array with status of each note

---

## Test 2: Batch Move - Partial Error

```
Tool: batch_move
Parameters:
{
  "paths": ["Exists.md", "DoesNotExist.md"],
  "destinationFolder": "Folder"
}
```

Expected:
- `succeeded: 1`
- `failed: 1`
- `results[1].error` defined

---

## Test 3: Batch Delete - Without Confirmation (Error)

```
Tool: batch_delete
Parameters:
{
  "paths": ["Note1.md", "Note2.md"],
  "confirm": false
}
```

Expected: Error - Confirmation required.

---

## Test 4: Batch Delete - With Confirmation

```
Tool: batch_delete
Parameters:
{
  "paths": ["ToDelete1.md", "ToDelete2.md"],
  "confirm": true
}
```

Expected:
- Notes deleted
- `succeeded` = number of notes deleted

---

## Test 5: Batch Update Frontmatter

```
Tool: batch_update_frontmatter
Parameters:
{
  "paths": ["Note1.md", "Note2.md"],
  "updates": {
    "status": "reviewed",
    "reviewed_date": "2024-01-15"
  }
}
```

Expected: Frontmatter updated in all notes.

---

## Test 6: Batch Update Frontmatter - Replace Mode

```
Tool: batch_update_frontmatter
Parameters:
{
  "paths": ["Note1.md"],
  "updates": { "only": "this" },
  "replace": true
}
```

Expected: All frontmatter replaced (not merged).

---

## Test 7: Batch Add Tag

```
Tool: batch_add_tag
Parameters:
{
  "paths": ["Note1.md", "Note2.md", "Note3.md"],
  "tags": ["project-x", "2024"]
}
```

Expected:
- Tags added to all notes
- `results[n].details.addedTags` shows new tags

---

## Test 8: Batch Remove Tag

```
Tool: batch_remove_tag
Parameters:
{
  "paths": ["Note1.md", "Note2.md"],
  "tags": ["obsolete", "draft"]
}
```

Expected: Tags removed from all notes.

---

## Full Flow Test

```
Test batch operations:
1. Create 5 test notes "batch-test-1.md" through "batch-test-5.md"
2. Use batch_add_tag to add ["test", "batch"] tags to all notes
3. Use batch_update_frontmatter to add status: "pending" to notes 1-3
4. Use batch_move to move notes 1-2 to "Archive" folder
5. Use batch_remove_tag to remove "test" tag from notes 3-5
6. Use batch_delete with confirm:true to delete all test notes
7. Verify all notes are deleted
```
