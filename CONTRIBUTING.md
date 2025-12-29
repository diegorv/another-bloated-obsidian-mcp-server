# Contributing

Guidelines for contributing to the Obsidian MCP Server.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- An Obsidian vault for testing

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-mcp-server.git
cd obsidian-mcp-server

# Install dependencies
npm install

# Run in development mode
npm run dev /path/to/test/vault
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with auto-reload |
| `npm run build` | Compile TypeScript |
| `npm test` | Run tests |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run with coverage report |
| `npx tsc --noEmit` | Type check without building |

## Project Structure

```
src/
├── index.ts          # Entry point
├── tool-groups.ts    # Tool configuration
├── config.ts         # Config management
├── tools/            # Tool handlers
├── services/         # Business logic
├── utils/            # Utilities
├── types/            # TypeScript types
└── __tests__/        # Tests
```

## Adding a New Tool

### 1. Create the Tool File

Create `src/tools/my-tool.ts`:

```typescript
/**
 * My new tool
 */

import { z } from 'zod';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';

// 1. Define Zod schema
export const myToolSchema = z.object({
  param: z.string().describe('Parameter description'),
});

// 2. Create handler
export async function handleMyTool(args: z.infer<typeof myToolSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();

    // Your logic here

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, result: '...' }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

// 3. Define MCP tool
export const myTools = [
  {
    name: 'my_tool',
    description: 'Description of what the tool does',
    inputSchema: {
      type: 'object' as const,
      properties: {
        param: {
          type: 'string',
          description: 'Parameter description',
        },
      },
      required: ['param'],
    },
  },
];
```

### 2. Export from tools/index.ts

```typescript
export { myTools, handleMyTool, myToolSchema } from './my-tool.js';
```

### 3. Add to tool-groups.ts

```typescript
import { myTools } from './tools/index.js';

export type ToolGroup = '...' | 'mytool';

export const ALL_GROUPS: ToolGroup[] = [..., 'mytool'];

const toolGroupMap: Record<ToolGroup, unknown[]> = {
  // ...
  mytool: myTools,
};

const toolToGroupMap: Record<string, ToolGroup> = {
  // ...
  my_tool: 'mytool',
};
```

### 4. Add handler to index.ts

```typescript
import { handleMyTool, myToolSchema } from './tools/my-tool.js';

// In the switch statement:
case 'my_tool':
  return handleMyTool(myToolSchema.parse(args));
```

### 5. Write Tests

Create `src/__tests__/tools/my-tool.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleMyTool } from '../../tools/my-tool.js';

describe('my_tool', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do something', async () => {
    const result = await handleMyTool({ param: 'value' });
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
  });
});
```

## Code Style

### General Guidelines

- Use TypeScript strict mode
- Use `async/await` for async operations
- Use Zod for input validation
- Follow existing patterns in the codebase

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `my-tool.ts` |
| Functions | camelCase | `handleMyTool` |
| Types | PascalCase | `MyToolResult` |
| Constants | UPPER_SNAKE_CASE | `MAX_RESULTS` |
| Tool names | snake_case | `my_tool` |

### Error Handling

Always use the error handling pattern:

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

### Path Security

Always validate paths:

```typescript
import { validatePath, ensureMarkdownExtension } from '../utils/path.js';

const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);
```

## Testing

### Test Structure

```
src/__tests__/
├── tools/          # Tool tests
├── services/       # Service tests
├── utils/          # Utility tests
├── security/       # Security tests
└── helpers/        # Test fixtures
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Feature', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do X when Y', async () => {
    // Arrange
    const input = { ... };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

### Test Helpers

Use test helpers for common setup:

```typescript
import { createTestVault, cleanupTestVault } from '../helpers/test-vault.js';

let vaultPath: string;

beforeEach(async () => {
  vaultPath = await createTestVault();
});

afterEach(async () => {
  await cleanupTestVault(vaultPath);
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- my-tool.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

## Pull Request Process

### Before Submitting

1. **Run tests**: `npm test`
2. **Type check**: `npx tsc --noEmit`
3. **Test manually** with a real vault
4. **Update documentation** if needed

### PR Guidelines

- Keep changes focused and small
- Write clear commit messages
- Reference issues if applicable
- Add tests for new features
- Update docs for API changes

### Commit Messages

```
type: Short description

Longer explanation if needed.

Fixes #123
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `chore`: Maintenance

## Documentation

### Updating Docs

- API changes: Update `docs/API_REFERENCE.md`
- Config changes: Update `docs/CONFIGURATION.md`
- New errors: Update `docs/ERROR_CODES.md`
- Architecture changes: Update `docs/ARCHITECTURE.md`

### Documentation Style

- Use clear, concise language
- Include code examples
- Add tables for structured data
- Keep formatting consistent

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide clear reproduction steps for bugs
