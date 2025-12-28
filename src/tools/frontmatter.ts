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
];
