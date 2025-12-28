# Testing Tags Tools

Tools: `list_tags`, `add_tag`, `remove_tag`, `search_by_tag`

## Test 1: List All Tags

```
List all tags used across the vault
```

Expected: Returns a list of unique tags with usage counts.

---

## Test 2: List Tags with Hierarchy

```
List all tags in the vault, showing any nested tag hierarchies
```

Expected: Shows tags like #project/work, #project/personal as a hierarchy.

---

## Test 3: Add Tag to Note (Frontmatter)

```
Add the tag "important" to "some-note.md"
```

Expected: Tag is added to the note's frontmatter tags array.

---

## Test 4: Add Tag to Note (Inline)

```
Add an inline tag #review to the body of "some-note.md"
```

Expected: Tag is added inline within the note content.

---

## Test 5: Add Multiple Tags

```
Add tags ["urgent", "followup", "2024"] to "some-note.md"
```

Expected: All tags are added to the note.

---

## Test 6: Add Nested Tag

```
Add the tag "project/work/q1" to "some-note.md"
```

Expected: Nested tag is added correctly.

---

## Test 7: Remove Tag from Note

```
Remove the tag "draft" from "some-note.md"
```

Expected: Tag is removed from frontmatter or inline.

---

## Test 8: Search Notes by Tag

```
Find all notes with the tag "todo" or "#todo"
```

Expected: Returns list of notes containing the specified tag.

---

## Test 9: Search by Nested Tag

```
Find all notes tagged with "project/work"
```

Expected: Returns notes with that specific nested tag.

---

## Full Flow Test

```
Test tag management:
1. Create a test note "tag-test.md" with content "# Tag Test Note"
2. List all tags in the vault
3. Add tags ["test", "mcp", "automation"] to the test note
4. List tags again - the new tags should appear
5. Search for notes with tag "test"
6. Remove the tag "automation" from the test note
7. Get the frontmatter to verify tag was removed
8. Search by tag "mcp" to find the test note
9. Delete the test note
10. List tags again - counts should be updated
```
