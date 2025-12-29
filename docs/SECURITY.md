# Security

Security model and protections implemented in Another bloated Obsidian MCP Server.

## Overview

Another bloated Obsidian MCP Server is designed with security as a primary concern. All file operations are validated to prevent unauthorized access outside the configured vault directories.

## Threat Model

### Protected Against

| Threat | Protection |
|--------|------------|
| Path traversal attacks | Path validation with normalization |
| Symlink escape | Realpath resolution and verification |
| Directory listing outside vault | Base path enforcement |
| Malicious input | Zod schema validation |
| System file modification | Reserved name blocking |

### Out of Scope

- Network-based attacks (server runs locally)
- Physical access attacks
- Malicious MCP clients (trust boundary is the MCP client)

## Security Layers

### 1. Path Validation

All file paths go through `validatePath()` before any filesystem access.

**Location:** `src/utils/path.ts`

```typescript
export function validatePath(relativePath: string, basePath: string): string {
  // 1. Normalize path (resolve . and ..)
  const normalizedPath = path.normalize(relativePath);

  // 2. Check for path traversal patterns
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/..')) {
    throw new PathTraversalError(relativePath);
  }

  // 3. Build full path
  const fullPath = path.join(basePath, normalizedPath);

  // 4. Resolve symlinks
  const realPath = fs.realpathSync(fullPath);

  // 5. Verify path is within vault
  if (!realPath.startsWith(fs.realpathSync(basePath))) {
    throw new PathTraversalError(relativePath);
  }

  return realPath;
}
```

### 2. Symlink Protection

Symlinks are resolved to their real paths before validation:

```typescript
// This prevents symlinks from escaping the vault
const realPath = fs.realpathSync(fullPath);
const realBasePath = fs.realpathSync(basePath);

if (!realPath.startsWith(realBasePath)) {
  throw new PathTraversalError(path);
}
```

**Attack prevented:**
```
vault/
├── notes/
│   └── escape.md -> /etc/passwd  # Blocked!
```

### 3. Input Validation

All tool inputs are validated using Zod schemas:

```typescript
export const readNoteSchema = z.object({
  path: z.string()
    .min(1)
    .describe('Path to the note'),
});

// Invalid input throws ZodError before reaching handlers
const args = readNoteSchema.parse(request.arguments);
```

### 4. Reserved Name Blocking

Reserved system names are blocked to prevent conflicts:

```typescript
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

export function validateNoteName(name: string): void {
  const baseName = path.basename(name, '.md').toUpperCase();
  if (RESERVED_NAMES.includes(baseName)) {
    throw new InvalidPathError(name, 'Reserved system name');
  }
}
```

### 5. Character Validation

Invalid filename characters are blocked:

```typescript
const INVALID_CHARS = /[<>:"|?*\\]/;

if (INVALID_CHARS.test(name)) {
  throw new InvalidPathError(name, 'Contains invalid characters');
}
```

### 6. Path Filtering

System and hidden paths are automatically ignored:

```typescript
export function shouldIgnorePath(relativePath: string): boolean {
  const parts = relativePath.split(path.sep);

  return parts.some(part =>
    part.startsWith('.') ||           // Hidden files/folders
    part === 'node_modules' ||        // Dependencies
    part === '.obsidian' ||           // Obsidian config
    part === '.git' ||                // Git
    part === '.trash'                 // Trash
  );
}
```

## Security Testing

### Test Coverage

Security tests are located in `src/__tests__/security/`:

| File | Purpose |
|------|---------|
| `security.test.ts` | General security tests |
| `symlink-escape.test.ts` | Symlink escape prevention |
| `path-injection.test.ts` | Path traversal prevention |

### Test Cases

```typescript
// Path traversal
describe('Path Traversal Prevention', () => {
  it('blocks ../etc/passwd', () => { ... });
  it('blocks /etc/passwd', () => { ... });
});

// Symlink escape
describe('Symlink Escape Prevention', () => {
  it('blocks symlinks to outside vault', () => { ... });
  it('blocks chained symlinks', () => { ... });
  it('blocks relative symlinks with ../', () => { ... });
});
```

## Configuration Security

### Config File Validation

The config file (`~/.obsidian-mcp/config.json`) is validated:

```typescript
const configSchema = z.object({
  vaults: z.record(z.string()),
  defaultVault: z.string().optional(),
});

// Vault paths are verified to exist
for (const [name, vaultPath] of Object.entries(config.vaults)) {
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault path does not exist: ${vaultPath}`);
  }
}
```

### Templates Folder Security

Template folder configuration is validated:

```typescript
function isSafeRelativePath(templatePath: string): boolean {
  const normalized = path.normalize(templatePath);
  return !normalized.startsWith('..') &&
         !path.isAbsolute(normalized);
}
```

## Best Practices

### For Users

1. **Use absolute paths** for vault configuration
2. **Keep vaults separate** from system directories
3. **Review enabled tools** - disable unused tool groups
4. **Check permissions** - ensure vault directory has proper permissions

### For Developers

1. **Always use validatePath()** before filesystem access
2. **Use Zod schemas** for all input validation
3. **Use formatError()** to sanitize error messages
4. **Add security tests** for new features

## Error Codes

| Code | Description |
|------|-------------|
| `PATH_TRAVERSAL` | Path traversal attempt detected |
| `INVALID_PATH` | Path contains invalid characters |
| `VAULT_NOT_FOUND` | Specified vault doesn't exist |

## Reporting Vulnerabilities

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email the maintainers privately
3. Include steps to reproduce
4. Allow time for a fix before disclosure

## Changelog

### v0.1.0

- Initial security implementation
- Path validation with symlink resolution
- Input validation with Zod
- Reserved name blocking
- Security test suite
