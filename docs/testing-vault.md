# Testing Vault Tools

Tools: `list_vaults`, `set_active_vault`, `register_vault`

## Test 1: List Configured Vaults

```
List all configured Obsidian vaults
```

Expected: Returns a list of vaults with the active one marked.

---

## Test 2: Register a New Vault

```
Register a new vault called "test-vault" at path /Users/username/Documents/TestVault
```

Expected: Confirms the vault was registered successfully.

---

## Test 3: Set Active Vault

```
Set the vault "test-vault" as the active vault
```

Expected: Confirms the active vault was changed.

---

## Test 4: Verify Active Vault Changed

```
List all vaults and confirm which one is active
```

Expected: Shows "test-vault" as the active vault.

---

## Full Flow Test

```
Test the vault management:
1. List all configured vaults
2. Register a new vault called "demo" at /tmp/demo-vault (create the folder first if needed)
3. Set "demo" as the active vault
4. List vaults again to confirm the change
```
