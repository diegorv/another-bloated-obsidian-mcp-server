According to the Obsidian MCP that I'm running, run the script below. At the end, list what worked and what didn't work. If you understand that there are opportunities for improvement, list them too. Don't stop the script if any error happens.

# Testing Frontmatter Tools

Tools: `get_frontmatter`, `update_frontmatter`

## Test 1: Get Frontmatter from Note

```
Get the frontmatter from a note that has YAML frontmatter
```

Expected: Returns parsed frontmatter as a JSON object.

---

## Test 2: Get Frontmatter from Note Without Frontmatter

```
Get the frontmatter from a note that doesn't have frontmatter
```

Expected: Returns empty object or indicates no frontmatter exists.

---

## Test 3: Update Frontmatter - Add New Field

```
Add a new field "status: active" to the frontmatter of "some-note.md"
```

Expected: Frontmatter is updated with the new field, existing fields preserved.

---

## Test 4: Update Frontmatter - Modify Existing Field

```
Change the "status" field to "completed" in "some-note.md"
```

Expected: The status field is updated to the new value.

---

## Test 5: Update Frontmatter - Add Tags

```
Add tags ["important", "work"] to the frontmatter of "some-note.md"
```

Expected: Tags array is added or updated in the frontmatter.

---

## Test 6: Update Frontmatter - Add Date

```
Add a "created" field with today's date to "some-note.md"
```

Expected: Date field is added in ISO format.

---

## Test 7: Update Frontmatter - Multiple Fields

```
Update the frontmatter of "some-note.md" with:
- author: "John Doe"
- category: "Documentation"
- priority: 1
- draft: false
```

Expected: All fields are added/updated in the frontmatter.

---

---

## Test 8: Remove Frontmatter Field

```
Tool: remove_frontmatter_field
Parameters:
{
  "path": "note.md",
  "field": "draft"
}
```

Expected:
- Field "draft" removed
- `removed: true` (if existed) or `false` (if didn't exist)

---

## Test 9: Add to Array Field - Add Tags

```
Tool: add_to_array_field
Parameters:
{
  "path": "note.md",
  "field": "tags",
  "values": ["new-tag", "another-tag"]
}
```

Expected:
- Tags added to array
- Duplicates ignored
- `added: ["new-tag", "another-tag"]`

---

## Test 10: Add to Array Field - Create New Field

```
Tool: add_to_array_field
Parameters:
{
  "path": "note.md",
  "field": "aliases",
  "values": ["alias1"],
  "createIfMissing": true
}
```

Expected: Field "aliases" created with value `["alias1"]`.

---

## Test 11: Add to Array Field - Field Doesn't Exist, createIfMissing=false

```
Tool: add_to_array_field
Parameters:
{
  "path": "note.md",
  "field": "nonexistent",
  "values": ["value"],
  "createIfMissing": false
}
```

Expected: Error - Field does not exist.

---

## Test 12: Add to Array Field - Field Is Not Array (Error)

```
Preparation: Note with frontmatter { title: "string" }

Tool: add_to_array_field
Parameters:
{
  "path": "note.md",
  "field": "title",
  "values": ["new"]
}
```

Expected: Error - Field is not an array.

---

## Test 13: Remove from Array Field

```
Tool: remove_from_array_field
Parameters:
{
  "path": "note.md",
  "field": "tags",
  "values": ["tag-to-remove"]
}
```

Expected:
- Tag removed from array
- `removed: ["tag-to-remove"]`

---

## Full Flow Test

```
Test frontmatter manipulation:
1. Create a new note "frontmatter-test.md" with content "# Test Note" (no frontmatter initially)
2. Get the frontmatter (should be empty)
3. Add frontmatter with: title: "Test", tags: ["test"], created: today's date
4. Get the frontmatter again to verify
5. Update the frontmatter to add: status: "reviewed", priority: 1
6. Get the frontmatter to see all fields
7. Read the full note to see how frontmatter appears in the file
8. Delete the test note
```
