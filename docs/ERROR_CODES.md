# Error Codes

Reference for all error codes returned by the Obsidian MCP Server.

## Error Format

All errors are returned in a consistent format:

```json
{
  "error": "[ERROR_CODE] Error message here"
}
```

When using the MCP protocol, errors include `isError: true`:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\": \"[NOTE_NOT_FOUND] Note not found: path/to/note.md\"}"
    }
  ],
  "isError": true
}
```

## Error Codes

### VAULT_NOT_FOUND

The specified vault does not exist or is not registered.

**Thrown by:** Vault tools, any tool requiring active vault

**Example:**
```json
{
  "error": "[VAULT_NOT_FOUND] Vault not found: work"
}
```

**Common Causes:**
- Vault name misspelled
- Vault not registered with `register_vault`
- Config file missing or corrupted

**Solutions:**
1. Use `list_vaults` to see available vaults
2. Register vault with `register_vault`
3. Check `~/.obsidian-mcp/config.json`

---

### NOTE_NOT_FOUND

The specified note does not exist in the vault.

**Thrown by:** read_note, update_note, delete_note, rename_note, move_note, frontmatter tools, tag tools, backup tools

**Example:**
```json
{
  "error": "[NOTE_NOT_FOUND] Note not found: Projects/MyProject.md"
}
```

**Common Causes:**
- Note path is incorrect
- Note was deleted or moved
- Missing `.md` extension in path

**Solutions:**
1. Verify path with `list_notes`
2. Check folder name spelling
3. Ensure `.md` extension is included

---

### PATH_TRAVERSAL

Attempted path traversal attack detected.

**Thrown by:** Any tool accepting a path parameter

**Example:**
```json
{
  "error": "[PATH_TRAVERSAL] Path traversal detected: ../../../etc/passwd"
}
```

**Common Causes:**
- Path contains `../` sequences
- Symlink points outside vault
- Absolute path outside vault

**Solutions:**
1. Use relative paths from vault root
2. Remove `../` from paths
3. Don't use symlinks pointing outside vault

---

### INVALID_PATH

The path contains invalid characters or is malformed.

**Thrown by:** Any tool accepting a path parameter

**Example:**
```json
{
  "error": "[INVALID_PATH] Invalid path \"CON.md\": Reserved system name"
}
```

**Common Causes:**
- Path contains characters: `< > : " | ? * \`
- Path uses reserved system name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
- Path is empty or contains only whitespace

**Solutions:**
1. Remove invalid characters from path
2. Rename file to avoid reserved names
3. Ensure path is not empty

---

### NOTE_EXISTS

Attempted to create a note at a path where one already exists.

**Thrown by:** create_note, create_from_template

**Example:**
```json
{
  "error": "[NOTE_EXISTS] Note already exists: Projects/MyProject.md"
}
```

**Common Causes:**
- Note already exists at target path
- Trying to create duplicate

**Solutions:**
1. Use a different path
2. Use `update_note` to modify existing note
3. Delete existing note first if replacement is intended

---

### FRONTMATTER_CONFLICT

Prepend content may conflict with existing frontmatter.

**Thrown by:** update_note (prepend mode)

**Example:**
```json
{
  "error": "[FRONTMATTER_CONFLICT] Prepend content contains \"---\" which may conflict with existing frontmatter in \"Projects/MyProject.md\". Use \"ignoreFrontmatterConflict: true\" to force the operation."
}
```

**Common Causes:**
- Prepending content that starts with `---`
- Prepending YAML frontmatter to note that has frontmatter

**Solutions:**
1. Use `update_note` with `mode: "overwrite"` instead
2. Set `ignoreFrontmatterConflict: true` to force prepend
3. Remove `---` from beginning of prepend content

---

## Tool-Specific Errors

### Batch Operations

Batch operations return per-item results:

```json
{
  "success": false,
  "total": 5,
  "succeeded": 3,
  "failed": 2,
  "results": [
    { "path": "note1.md", "success": true },
    { "path": "note2.md", "success": false, "error": "[NOTE_NOT_FOUND] Note not found: note2.md" }
  ]
}
```

### batch_delete Confirmation

```json
{
  "error": "Confirmation required. Set confirm=true to proceed with deletion."
}
```

**Solution:** Set `confirm: true` in arguments.

---

### Frontmatter Array Operations

When field exists but is not an array:

```json
{
  "error": "Field \"status\" exists but is not an array"
}
```

When field does not exist and `createIfMissing` is false:

```json
{
  "error": "Field \"tags\" does not exist"
}
```

---

### Search Errors

Invalid regex pattern:

```json
{
  "error": "Invalid regular expression: /[/: Unterminated character class"
}
```

---

### Template Errors

Template not found:

```json
{
  "error": "Template not found: NonExistent"
}
```

---

### Backup Errors

Backup folder doesn't exist:

```json
{
  "backups": [],
  "count": 0,
  "message": "Backup folder \".backups\" does not exist"
}
```

Cannot determine restore target:

```json
{
  "error": "Could not determine target path. Please specify targetPath parameter."
}
```

---

## Validation Errors

Zod schema validation errors are returned when input doesn't match expected format:

```json
{
  "error": "Expected string, received number at \"path\""
}
```

Common validation errors:
- Missing required field
- Wrong data type
- Value out of range
- Invalid enum value

---

## Generic Errors

### Tool Not Enabled

```json
{
  "error": "Tool \"search_vault\" is not enabled. Check --tools configuration."
}
```

**Solution:** Add the required tool group to `--tools` configuration.

### Unknown Tool

```json
{
  "error": "Unknown tool: invalid_tool_name"
}
```

**Solution:** Check tool name spelling or use `list_tools` to see available tools.

---

## Error Handling in Code

### Catching Specific Errors

```typescript
import { NoteNotFoundError, PathTraversalError } from './utils/errors.js';

try {
  await readNote(vaultPath, notePath);
} catch (error) {
  if (error instanceof NoteNotFoundError) {
    // Handle missing note
  } else if (error instanceof PathTraversalError) {
    // Handle security violation
  } else {
    // Handle unknown error
  }
}
```

### Error Hierarchy

```
McpError (base class)
├── VaultNotFoundError
├── NoteNotFoundError
├── PathTraversalError
├── InvalidPathError
├── NoteAlreadyExistsError
└── FrontmatterConflictError
```
