# Testing Attachment Management Tools

Tools: `list_attachments`, `get_attachment_info`, `find_unused_attachments`, `get_attachments_in_note`

## Test 1: List All Attachments

```
Tool: list_attachments
Parameters: {}
```

Expected:
- List of all attachments (images, PDFs, etc)
- `path`, `name`, `extension`, `size` for each

---

## Test 2: List Attachments - Filter by Extension

```
Tool: list_attachments
Parameters:
{
  "extensions": ["png", "jpg", "jpeg"]
}
```

Expected: Only images listed.

---

## Test 3: List Attachments - Specific Folder

```
Tool: list_attachments
Parameters:
{
  "folder": "attachments"
}
```

Expected: Only attachments from the specified folder.

---

## Test 4: Get Attachment Info

```
Tool: get_attachment_info
Parameters:
{
  "path": "attachments/image.png"
}
```

Expected:
- `path`, `name`, `extension`
- `size` (bytes)
- `modified` date

---

## Test 5: Find Unused Attachments

```
Tool: find_unused_attachments
Parameters: {}
```

Expected:
- List of attachments not referenced in any note
- Useful for vault cleanup

---

## Test 6: Find Unused Attachments - With Extensions

```
Tool: find_unused_attachments
Parameters:
{
  "extensions": ["pdf"]
}
```

Expected: Only unused PDFs.

---

## Test 7: Get Attachments in Note

```
Tool: get_attachments_in_note
Parameters:
{
  "path": "note-with-images.md"
}
```

Expected:
- List of attachments referenced in the note
- Format: ![[image.png]] or ![](path/to/image.png)

---

## Full Flow Test

```
Test attachment management:
1. Create a test note with embedded images: ![[test-image.png]]
2. Use list_attachments to see all attachments in vault
3. Use get_attachments_in_note to see attachments in the test note
4. Use get_attachment_info to get details about a specific attachment
5. Create a new attachment file that's not referenced in any note
6. Use find_unused_attachments to verify it appears in the list
7. Clean up test files
```
