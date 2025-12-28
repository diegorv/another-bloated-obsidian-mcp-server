# Testing Vault Tools

Tools: `list_vaults`, `set_active_vault`, `register_vault`

> **Note**: When the MCP server starts, the vault specified in the command line is automatically registered as "default" and set as active. You don't need to register it again.

---

## Prerequisites

Before running these tests:

1. **Ensure MCP server is running**: The Obsidian MCP server must be active and connected
2. **Have at least one valid Obsidian vault**: You should have an Obsidian vault set up
3. **Know your vault path(s)**: Note the absolute path to your vault(s)
4. **Verify permissions**: Ensure you have read/write permissions to vault directories
5. **For advanced tests**: You may need to create additional vault directories

---

## Test 1: List Configured Vaults

```
List all configured Obsidian vaults
```

Expected: Returns the "default" vault (configured at startup) as active.

---

## Test 2: Verify Vault is Active

```
List all vaults and confirm which one is currently active
```

Expected: Shows the default vault as active with its path.

---

## Test 3: Error Handling - Invalid Path

```
Try to register a vault with an invalid path that doesn't exist:
register_vault with name "invalid-test" at path "/invalid/path/that/does/not/exist"
```

Expected: Should return error message "Directory does not exist: /invalid/path/that/does/not/exist"

This test validates that the system properly checks path existence before registering.

---

## Test 4: Path Validation

```
Test various path formats to understand what's supported:

1. Try registering with an absolute path: /Users/yourname/vault-test
2. Try with a path containing spaces: "/Users/yourname/My Vault Test"
3. Try with a relative path (if supported): ~/vault-test
```

Expected:
- Absolute paths should work (if directory exists)
- Paths with spaces should work if properly quoted
- Note which path formats are accepted/rejected

---

## Advanced: Register Additional Vault

> Only needed if you want to work with multiple vaults in the same session.

**Preparation**: First, create a test vault directory:

**macOS/Linux**:
```bash
mkdir -p ~/test-vault-secondary
```

**Windows**:
```cmd
mkdir %USERPROFILE%\test-vault-secondary
```

**Then run the test**:
```
Register an additional vault called "secondary" at the path you just created
(e.g., /Users/yourname/test-vault-secondary or ~/test-vault-secondary)
```

Expected:
- Confirms the new vault was registered
- Default vault remains active
- list_vaults shows both vaults

---

## Advanced: Switch Between Vaults

> Only useful if you have multiple vaults registered (requires previous test).

```
Set the vault "secondary" as the active vault
```

Expected:
- Confirms the active vault was changed
- Subsequent operations will use the "secondary" vault

---

## Test 5: Verify Vault Switch

> Requires multiple vaults registered

```
After switching vaults:
1. List all vaults again
2. Verify that "secondary" is now marked as active
3. Try creating a note to confirm operations use the new vault
```

Expected: Note is created in the secondary vault, not the default one.

---

## Test 6: Switch Back to Default

```
Set the vault "default" as the active vault again
```

Expected: Default vault becomes active again.

---

## Test 7: Cleanup (Optional)

```
After testing with multiple vaults:
1. Switch back to the "default" vault
2. Note: There is currently no unregister_vault tool
3. To remove registered vaults, restart the MCP server
4. Optional: Delete the test vault directory you created
```

Expected: After restart, only the "default" vault is registered.

---

## Quick Verification Test

```
Verify the Obsidian MCP connection:
1. List all configured vaults
2. Confirm which vault is active
3. Show the vault path
```

Expected:
- Connection is working
- At least one vault is listed
- Active vault is clearly identified with its path

---

## Troubleshooting

### Problem: "Directory does not exist" error
**Solution**:
- Verify the path exists and is an absolute path
- Check spelling and ensure no typos in the path
- On macOS/Linux, expand `~` to full path (e.g., `/Users/yourname/`)
- Ensure you have permissions to access the directory

### Problem: Cannot switch vaults
**Solution**:
- Ensure the vault is registered first with `register_vault`
- Use `list_vaults` to see all registered vault names
- Use the exact vault name (case-sensitive)

### Problem: Changes not reflecting
**Solution**:
- Check if the correct vault is active with `list_vaults`
- Verify you're looking at the correct vault directory
- Ensure the MCP server hasn't been restarted (loses non-default registrations)

### Problem: Operations fail after switching vaults
**Solution**:
- Verify the target vault exists and is a valid Obsidian vault
- Check if the vault has `.obsidian` folder
- Ensure you have read/write permissions

### Problem: Lost secondary vault after restart
**Solution**:
- This is expected behavior - only the default vault persists
- You need to re-register secondary vaults after each restart
- Consider using the default vault for primary operations

---

## Future Improvements

The following improvements could enhance the vault management system:

### 1. Unregister Vault Tool
**Current limitation**: No way to remove registered vaults without restarting

**Suggested**: Add `unregister_vault` tool
```
Tool: unregister_vault
Parameters:
{
  "name": "vault-name"
}
```

### 2. Enhanced Error Messages
**Current**: Basic error messages
```json
{"success": false, "error": "Directory does not exist: /path"}
```

**Suggested**: More helpful error responses
```json
{
  "success": false,
  "error": "Directory does not exist: /path",
  "suggestion": "Please create the directory first or check the path",
  "errorCode": "VAULT_PATH_NOT_FOUND"
}
```

### 3. Vault Validation
**Suggested**: Verify if directory is actually an Obsidian vault
- Check for `.obsidian/` folder
- Warn if it appears not to be a valid Obsidian vault
- Optionally initialize a new vault if it's an empty directory

### 4. Auto-discovery Tool
**Suggested**: Add `discover_vaults` tool to automatically find Obsidian vaults
```
Tool: discover_vaults
Parameters:
{
  "searchPaths": [
    "~/Documents/Obsidian",
    "~/Obsidian",
    "/custom/path"
  ]
}
```

### 5. Vault Information Tool
**Suggested**: Get detailed information about a vault
```
Tool: get_vault_info
Parameters:
{
  "name": "vault-name"
}

Returns:
- Number of notes
- Size on disk
- Last modified date
- Obsidian version/config info
```

### 6. Persistent Vault Registry
**Current limitation**: Secondary vaults lost on restart

**Suggested**: Option to persist vault registrations to a config file
- Automatically re-register known vaults on startup
- User can manage persistent vault list

---

## Test Results Template

Use this template to document your test results:

```
📊 VAULT MANAGEMENT TEST RESULTS
Date: [DATE]
Tester: [NAME]

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | List Configured Vaults | ✅/❌ | |
| 2 | Verify Vault is Active | ✅/❌ | |
| 3 | Error Handling - Invalid Path | ✅/❌ | |
| 4 | Path Validation | ✅/❌ | |
| 5 | Register Additional Vault | ✅/❌ | |
| 6 | Switch Between Vaults | ✅/❌ | |
| 7 | Verify Vault Switch | ✅/❌ | |
| 8 | Switch Back to Default | ✅/❌ | |
| 9 | Cleanup | ✅/❌ | |
| 10 | Quick Verification | ✅/❌ | |

Overall Status: [PASSED/FAILED/PARTIAL]
Key Issues Found: [DESCRIPTION]
Suggestions: [YOUR SUGGESTIONS]
```
