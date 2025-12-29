# Architecture

Technical architecture and design patterns of the Obsidian MCP Server.

## Overview

The Obsidian MCP Server follows a layered architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                       MCP Protocol                          │
│              (Model Context Protocol SDK)                   │
├─────────────────────────────────────────────────────────────┤
│                      Tool Handlers                          │
│     (src/tools/*.ts - 12 files, 47 tools)                  │
├─────────────────────────────────────────────────────────────┤
│                      Services Layer                         │
│              (src/services/*.ts - 8 files)                  │
├─────────────────────────────────────────────────────────────┤
│                      Utilities Layer                        │
│               (src/utils/*.ts - 3 files)                   │
├─────────────────────────────────────────────────────────────┤
│                     File System / OS                        │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
obsidian-mcp-server/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── tool-groups.ts        # Tool group configuration
│   ├── config.ts             # Configuration management
│   ├── tools/                # Tool handlers (API layer)
│   │   ├── index.ts          # Tool exports
│   │   ├── vault.ts          # Vault management
│   │   ├── notes.ts          # Note CRUD
│   │   ├── search.ts         # Search functionality
│   │   ├── frontmatter.ts    # YAML metadata
│   │   ├── tags.ts           # Tag management
│   │   ├── links.ts          # Link analysis
│   │   ├── daily-notes.ts    # Daily notes
│   │   ├── templates.ts      # Template system
│   │   ├── bases.ts          # Obsidian Bases
│   │   ├── batch.ts          # Batch operations
│   │   ├── attachments.ts    # Attachment tracking
│   │   └── backup.ts         # Backup system
│   ├── services/             # Business logic
│   │   ├── vault-manager.ts  # Vault state management
│   │   ├── filesystem.ts     # File operations
│   │   ├── markdown-parser.ts # Frontmatter/link parsing
│   │   ├── search.ts         # Search engine
│   │   ├── link-analyzer.ts  # Link graph analysis
│   │   ├── daily-notes.ts    # Daily notes logic
│   │   ├── template-engine.ts # Template processing
│   │   └── bases-parser.ts   # Obsidian Bases parsing
│   ├── utils/                # Shared utilities
│   │   ├── path.ts           # Path validation/security
│   │   ├── errors.ts         # Custom error types
│   │   └── logger.ts         # Logging system
│   └── types/                # TypeScript types
│       └── index.ts          # Type definitions
├── docs/                     # Documentation
├── dist/                     # Compiled output
└── logs/                     # Application logs
```

## Component Details

### Entry Point (src/index.ts)

The main entry point handles:

1. **CLI argument parsing** - Vault path and tool groups
2. **Server initialization** - MCP SDK server instance
3. **Request handlers** - `ListToolsRequestSchema` and `CallToolRequestSchema`
4. **Transport setup** - Stdio transport for MCP communication

```typescript
// Server initialization
const server = new Server(
  { name: 'obsidian-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// Tool routing
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!isToolEnabled(name)) {
    return { error: `Tool "${name}" is not enabled` };
  }

  switch (name) {
    case 'read_note':
      return handleReadNote(readNoteSchema.parse(args));
    // ...
  }
});
```

### Tool Groups System (src/tool-groups.ts)

Enables selective enabling/disabling of tool groups:

```typescript
type ToolGroup = 'vault' | 'notes' | 'search' | 'frontmatter' |
                 'tags' | 'links' | 'daily' | 'templates' |
                 'bases' | 'batch' | 'attachments' | 'backup';

// Configuration sources (priority order):
// 1. CLI: --tools=vault,notes
// 2. Environment: OBSIDIAN_MCP_TOOLS=vault,notes
// 3. Default: all groups enabled
```

### Tool Handlers (src/tools/*.ts)

Each tool file follows a consistent pattern:

```typescript
// 1. Zod schema for input validation
export const readNoteSchema = z.object({
  path: z.string().describe('Path to the note'),
});

// 2. Handler function
export async function handleReadNote(args: z.infer<typeof readNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const note = await readNote(vaultPath, args.path);
    return {
      content: [{ type: 'text', text: JSON.stringify(note) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}

// 3. Tool definition for MCP
export const noteTools = [
  {
    name: 'read_note',
    description: 'Read the content of a note',
    inputSchema: { type: 'object', properties: {...}, required: ['path'] },
  },
];
```

### Services Layer (src/services/*.ts)

Services contain business logic and are called by tool handlers:

| Service | Responsibility |
|---------|----------------|
| `vault-manager.ts` | Active vault state, vault registration |
| `filesystem.ts` | File read/write, note CRUD operations |
| `markdown-parser.ts` | Frontmatter parsing, tag/link extraction |
| `search.ts` | Full-text search with regex support |
| `link-analyzer.ts` | Backlinks, orphans, link graph |
| `daily-notes.ts` | Daily note creation/management |
| `template-engine.ts` | Template variable substitution |
| `bases-parser.ts` | Obsidian Bases file parsing |

### Utilities Layer (src/utils/*.ts)

Shared utilities used across the application:

**path.ts** - Security-critical path handling:
```typescript
export function validatePath(relativePath: string, basePath: string): string {
  // Normalize and resolve path
  // Check for path traversal
  // Resolve symlinks
  // Verify path is within vault
}
```

**errors.ts** - Custom error hierarchy:
```typescript
class McpError extends Error {
  constructor(message: string, public code: string) { ... }
}

class VaultNotFoundError extends McpError { ... }
class NoteNotFoundError extends McpError { ... }
class PathTraversalError extends McpError { ... }
```

**logger.ts** - Logging with file rotation:
```typescript
logger.debug('Message', { data });
logger.info('Message', { data });
logger.warn('Message', { data });
logger.error('Message', error);
```

## Data Flow

### Tool Call Flow

```
1. MCP Client sends tool call
   ↓
2. CallToolRequestSchema handler receives request
   ↓
3. Check if tool is enabled (tool-groups.ts)
   ↓
4. Parse arguments with Zod schema
   ↓
5. Tool handler calls service functions
   ↓
6. Service uses utilities (path validation, error handling)
   ↓
7. Service interacts with filesystem
   ↓
8. Response formatted and returned to client
```

### Vault Resolution Flow

```
1. Tool handler calls getActiveVaultPath()
   ↓
2. vault-manager checks for active vault
   ↓
3. Returns vault path or throws VaultNotFoundError
   ↓
4. validatePath() ensures path safety
   ↓
5. Filesystem operation proceeds
```

## Key Design Patterns

### 1. Schema-First Validation

All inputs are validated using Zod schemas before processing:

```typescript
const args = readNoteSchema.parse(request.arguments);
```

### 2. Error Handling Strategy

Consistent error handling across all tools:

```typescript
try {
  // Operation
} catch (error) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: formatError(error) }) }],
    isError: true,
  };
}
```

### 3. Service Abstraction

Tool handlers delegate to services, keeping handlers thin:

```typescript
// Tool handler (thin)
export async function handleReadNote(args) {
  const vaultPath = await getActiveVaultPath();
  const note = await readNote(vaultPath, args.path); // Service call
  return formatResponse(note);
}
```

### 4. Path Security

All paths go through validation before filesystem access:

```typescript
const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);
```

## Configuration

### Tool Groups

Configuration precedence:
1. CLI argument: `--tools=vault,notes`
2. Environment: `OBSIDIAN_MCP_TOOLS=vault,notes`
3. Default: All groups enabled

### Application Config

Stored in `~/.obsidian-mcp/config.json`:

```json
{
  "vaults": {
    "personal": "/path/to/personal",
    "work": "/path/to/work"
  },
  "defaultVault": "personal"
}
```

### Logging

- Log directory: `{cwd}/logs/`
- Log format: `mcp-server-YYYY-MM-DD.log`
- Max files: 7 (7-day rotation)
- Levels: debug, info, warn, error
- Control: `LOG_LEVEL` environment variable

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `gray-matter` | YAML frontmatter parsing |
| `zod` | Schema validation |

## Testing Architecture

Tests are organized by layer:

```
src/__tests__/
├── tools/          # Tool handler tests
├── services/       # Service tests
├── utils/          # Utility tests
├── security/       # Security-focused tests
└── helpers/        # Test fixtures and utilities
```

Test features:
- In-memory filesystem (memfs) for isolation
- Security tests run on real filesystem
- Coverage reporting via v8
