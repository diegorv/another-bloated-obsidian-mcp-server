/**
 * Frontmatter management tools
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { validatePath, ensureMarkdownExtension } from '../utils/path.js';
import { formatError, NoteNotFoundError } from '../utils/errors.js';
import { updateFrontmatter } from '../services/markdown-parser.js';
import matter from 'gray-matter';

// Schema definitions
export const getFrontmatterSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
});

export const updateFrontmatterSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
  updates: z.record(z.unknown()).describe('Key-value pairs to update in frontmatter'),
  replace: z.boolean().optional().default(false).describe('If true, replace all frontmatter instead of merging'),
});

export const removeFrontmatterFieldSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
  field: z.string().describe('Name of the field to remove'),
});

export const addToArrayFieldSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
  field: z.string().describe('Name of the array field (e.g., "tags", "aliases")'),
  values: z.array(z.unknown()).describe('Values to add to the array'),
  createIfMissing: z.boolean().optional().default(true).describe('Create the field if it does not exist'),
});

export const removeFromArrayFieldSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
  field: z.string().describe('Name of the array field (e.g., "tags", "aliases")'),
  values: z.array(z.unknown()).describe('Values to remove from the array'),
});

// Tool implementations
export async function handleGetFrontmatter(args: z.infer<typeof getFrontmatterSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              path: args.path,
              frontmatter: parsed.data,
              hasFrontmatter: Object.keys(parsed.data).length > 0,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Note not found: ${args.path}` }),
          },
        ],
        isError: true,
      };
    }
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

export async function handleUpdateFrontmatter(args: z.infer<typeof updateFrontmatterSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);

    let newFrontmatter: Record<string, unknown>;
    if (args.replace) {
      newFrontmatter = args.updates;
    } else {
      newFrontmatter = { ...parsed.data, ...args.updates };
    }

    // Remove null/undefined values (allows deletion by setting to null)
    Object.keys(newFrontmatter).forEach((key) => {
      if (newFrontmatter[key] === null || newFrontmatter[key] === undefined) {
        delete newFrontmatter[key];
      }
    });

    const newContent = matter.stringify(parsed.content, newFrontmatter);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: args.path,
            frontmatter: newFrontmatter,
          }),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Note not found: ${args.path}` }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleRemoveFrontmatterField(args: z.infer<typeof removeFrontmatterFieldSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);

    const hadField = args.field in parsed.data;
    delete parsed.data[args.field];

    const newContent = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: args.path,
            field: args.field,
            removed: hadField,
          }),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Note not found: ${args.path}` }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleAddToArrayField(args: z.infer<typeof addToArrayFieldSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);

    let currentValue = parsed.data[args.field];

    // Check if field exists and is not an array
    if (currentValue !== undefined && !Array.isArray(currentValue)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Field "${args.field}" exists but is not an array`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Create array if missing
    if (currentValue === undefined) {
      if (!args.createIfMissing) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Field "${args.field}" does not exist`,
              }),
            },
          ],
          isError: true,
        };
      }
      currentValue = [];
    }

    // Add values that don't already exist
    const added: unknown[] = [];
    for (const value of args.values) {
      const stringValue = JSON.stringify(value);
      const exists = currentValue.some((v: unknown) => JSON.stringify(v) === stringValue);
      if (!exists) {
        currentValue.push(value);
        added.push(value);
      }
    }

    parsed.data[args.field] = currentValue;
    const newContent = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: args.path,
            field: args.field,
            added,
            currentValues: currentValue,
          }),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Note not found: ${args.path}` }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleRemoveFromArrayField(args: z.infer<typeof removeFromArrayFieldSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);

    const currentValue = parsed.data[args.field];

    // Check if field exists
    if (currentValue === undefined) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Field "${args.field}" does not exist`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Check if field is an array
    if (!Array.isArray(currentValue)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Field "${args.field}" is not an array`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Remove values
    const removed: unknown[] = [];
    const valuesToRemove = new Set(args.values.map((v) => JSON.stringify(v)));
    const newArray = currentValue.filter((v: unknown) => {
      const stringValue = JSON.stringify(v);
      if (valuesToRemove.has(stringValue)) {
        removed.push(v);
        return false;
      }
      return true;
    });

    parsed.data[args.field] = newArray;
    const newContent = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: args.path,
            field: args.field,
            removed,
            currentValues: newArray,
          }),
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Note not found: ${args.path}` }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

// Tool definitions for MCP
export const frontmatterTools = [
  {
    name: 'get_frontmatter',
    description: 'Get the YAML frontmatter of a note as a JSON object',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note (e.g., "Projects/MyProject.md")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'update_frontmatter',
    description:
      'Update the YAML frontmatter of a note. By default merges with existing frontmatter. Set replace=true to replace all frontmatter. Set a value to null to remove a field.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
        updates: {
          type: 'object',
          description: 'Key-value pairs to update (e.g., {"status": "done", "priority": 1})',
        },
        replace: {
          type: 'boolean',
          description: 'If true, replace all frontmatter instead of merging (default: false)',
          default: false,
        },
      },
      required: ['path', 'updates'],
    },
  },
  {
    name: 'remove_frontmatter_field',
    description: 'Remove a specific field from the frontmatter of a note.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
        field: {
          type: 'string',
          description: 'Name of the field to remove',
        },
      },
      required: ['path', 'field'],
    },
  },
  {
    name: 'add_to_array_field',
    description:
      'Add values to an array field in frontmatter (e.g., tags, aliases). Creates the field if it does not exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
        field: {
          type: 'string',
          description: 'Name of the array field (e.g., "tags", "aliases")',
        },
        values: {
          type: 'array',
          description: 'Values to add to the array (duplicates are ignored)',
        },
        createIfMissing: {
          type: 'boolean',
          description: 'Create the field if it does not exist (default: true)',
          default: true,
        },
      },
      required: ['path', 'field', 'values'],
    },
  },
  {
    name: 'remove_from_array_field',
    description: 'Remove values from an array field in frontmatter (e.g., tags, aliases).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
        field: {
          type: 'string',
          description: 'Name of the array field (e.g., "tags", "aliases")',
        },
        values: {
          type: 'array',
          description: 'Values to remove from the array',
        },
      },
      required: ['path', 'field', 'values'],
    },
  },
];
