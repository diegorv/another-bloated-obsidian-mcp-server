# Testing Vault Tools

Tools: `list_vaults`, `set_active_vault`, `register_vault`

> **Note**: When the MCP server starts, the vault specified in the command line is automatically registered as "default" and set as active. You don't need to register it again.

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

## Advanced: Register Additional Vault

> Only needed if you want to work with multiple vaults in the same session.

```
Register an additional vault called "secondary" at path /path/to/another/vault
```

Expected: Confirms the new vault was registered (but default remains active).

---

## Advanced: Switch Between Vaults

> Only useful if you have multiple vaults registered.

```
Set the vault "secondary" as the active vault
```

Expected: Confirms the active vault was changed.

---

## Quick Verification Test

```
Verify the Obsidian MCP connection:
1. List all configured vaults
2. Confirm which vault is active
3. Show the vault path
```
