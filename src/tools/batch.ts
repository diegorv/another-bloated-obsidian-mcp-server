/**
 * Batch operations tools
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { validatePath, ensureMarkdownExtension } from '../utils/path.js';
import { formatError } from '../utils/errors.js';
import { moveNote, deleteNote, renameNote } from '../services/filesystem.js';
import matter from 'gray-matter';

// Schema definitions
export const batchMoveSchema = z.object({
  paths: z.array(z.string()).describe('Array of note paths to move'),
  destinationFolder: z.string().describe('Destination folder path'),
  updateLinks: z.boolean().optional().default(true).describe('Update wikilinks in other notes'),
});

export const batchDeleteSchema = z.object({
  paths: z.array(z.string()).describe('Array of note paths to delete'),
  confirm: z.boolean().describe('Must be true to confirm deletion'),
});

export const batchUpdateFrontmatterSchema = z.object({
  paths: z.array(z.string()).describe('Array of note paths to update'),
  updates: z.record(z.unknown()).describe('Key-value pairs to update in frontmatter'),
  replace: z.boolean().optional().default(false).describe('Replace all frontmatter instead of merging'),
});

export const batchAddTagSchema = z.object({
  paths: z.array(z.string()).describe('Array of note paths'),
  tags: z.array(z.string()).describe('Tags to add (without # prefix)'),
});

export const batchRemoveTagSchema = z.object({
  paths: z.array(z.string()).describe('Array of note paths'),
  tags: z.array(z.string()).describe('Tags to remove (without # prefix)'),
});

// Helper types
interface BatchResult {
  path: string;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

// Tool implementations
export async function handleBatchMove(args: z.infer<typeof batchMoveSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const results: BatchResult[] = [];
    let successCount = 0;

    for (const notePath of args.paths) {
      try {
        const result = await moveNote(
          vaultPath,
          notePath,
          args.destinationFolder,
          args.updateLinks
        );
        results.push({
          path: notePath,
          success: true,
          details: { newPath: result.newPath, linksUpdated: result.linksUpdated },
        });
        successCount++;
      } catch (error) {
        results.push({
          path: notePath,
          success: false,
          error: formatError(error),
        });
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: successCount === args.paths.length,
            total: args.paths.length,
            succeeded: successCount,
            failed: args.paths.length - successCount,
            results,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
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

export async function handleBatchDelete(args: z.infer<typeof batchDeleteSchema>) {
  if (!args.confirm) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'Confirmation required. Set confirm=true to proceed with deletion.',
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    const vaultPath = await getActiveVaultPath();
    const results: BatchResult[] = [];
    let successCount = 0;

    for (const notePath of args.paths) {
      try {
        await deleteNote(vaultPath, notePath);
        results.push({
          path: notePath,
          success: true,
        });
        successCount++;
      } catch (error) {
        results.push({
          path: notePath,
          success: false,
          error: formatError(error),
        });
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: successCount === args.paths.length,
            total: args.paths.length,
            succeeded: successCount,
            failed: args.paths.length - successCount,
            results,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
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

export async function handleBatchUpdateFrontmatter(args: z.infer<typeof batchUpdateFrontmatterSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const results: BatchResult[] = [];
    let successCount = 0;

    for (const notePath of args.paths) {
      try {
        const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const parsed = matter(content);

        let newFrontmatter: Record<string, unknown>;
        if (args.replace) {
          newFrontmatter = args.updates;
        } else {
          newFrontmatter = { ...parsed.data, ...args.updates };
        }

        // Remove null/undefined values
        Object.keys(newFrontmatter).forEach((key) => {
          if (newFrontmatter[key] === null || newFrontmatter[key] === undefined) {
            delete newFrontmatter[key];
          }
        });

        const newContent = matter.stringify(parsed.content, newFrontmatter);
        await fs.writeFile(fullPath, newContent, 'utf-8');

        results.push({
          path: notePath,
          success: true,
          details: { frontmatter: newFrontmatter },
        });
        successCount++;
      } catch (error) {
        results.push({
          path: notePath,
          success: false,
          error: formatError(error),
        });
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: successCount === args.paths.length,
            total: args.paths.length,
            succeeded: successCount,
            failed: args.paths.length - successCount,
            results,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
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

export async function handleBatchAddTag(args: z.infer<typeof batchAddTagSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const results: BatchResult[] = [];
    let successCount = 0;

    for (const notePath of args.paths) {
      try {
        const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const parsed = matter(content);

        // Get existing tags array
        let tags: string[] = [];
        if (Array.isArray(parsed.data.tags)) {
          tags = [...parsed.data.tags];
        } else if (typeof parsed.data.tags === 'string') {
          tags = [parsed.data.tags];
        }

        // Add new tags (avoid duplicates)
        const addedTags: string[] = [];
        for (const tag of args.tags) {
          const normalizedTag = tag.replace(/^#/, ''); // Remove # if present
          if (!tags.includes(normalizedTag)) {
            tags.push(normalizedTag);
            addedTags.push(normalizedTag);
          }
        }

        parsed.data.tags = tags;
        const newContent = matter.stringify(parsed.content, parsed.data);
        await fs.writeFile(fullPath, newContent, 'utf-8');

        results.push({
          path: notePath,
          success: true,
          details: { addedTags, currentTags: tags },
        });
        successCount++;
      } catch (error) {
        results.push({
          path: notePath,
          success: false,
          error: formatError(error),
        });
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: successCount === args.paths.length,
            total: args.paths.length,
            succeeded: successCount,
            failed: args.paths.length - successCount,
            results,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
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

export async function handleBatchRemoveTag(args: z.infer<typeof batchRemoveTagSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const results: BatchResult[] = [];
    let successCount = 0;

    for (const notePath of args.paths) {
      try {
        const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const parsed = matter(content);

        // Get existing tags array
        let tags: string[] = [];
        if (Array.isArray(parsed.data.tags)) {
          tags = [...parsed.data.tags];
        } else if (typeof parsed.data.tags === 'string') {
          tags = [parsed.data.tags];
        }

        // Remove specified tags
        const removedTags: string[] = [];
        const tagsToRemove = new Set(args.tags.map((t) => t.replace(/^#/, '')));
        tags = tags.filter((tag) => {
          if (tagsToRemove.has(tag)) {
            removedTags.push(tag);
            return false;
          }
          return true;
        });

        parsed.data.tags = tags;
        const newContent = matter.stringify(parsed.content, parsed.data);
        await fs.writeFile(fullPath, newContent, 'utf-8');

        results.push({
          path: notePath,
          success: true,
          details: { removedTags, currentTags: tags },
        });
        successCount++;
      } catch (error) {
        results.push({
          path: notePath,
          success: false,
          error: formatError(error),
        });
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: successCount === args.paths.length,
            total: args.paths.length,
            succeeded: successCount,
            failed: args.paths.length - successCount,
            results,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
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
export const batchTools = [
  {
    name: 'batch_move',
    description: 'Move multiple notes to a destination folder at once. Returns per-note success/failure results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of note paths to move',
        },
        destinationFolder: {
          type: 'string',
          description: 'Destination folder path',
        },
        updateLinks: {
          type: 'boolean',
          description: 'Update wikilinks in other notes (default: true)',
          default: true,
        },
      },
      required: ['paths', 'destinationFolder'],
    },
  },
  {
    name: 'batch_delete',
    description: 'Delete multiple notes at once. Requires confirmation. Returns per-note success/failure results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of note paths to delete',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['paths', 'confirm'],
    },
  },
  {
    name: 'batch_update_frontmatter',
    description: 'Update frontmatter of multiple notes at once. Can merge or replace frontmatter.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of note paths to update',
        },
        updates: {
          type: 'object',
          description: 'Key-value pairs to update (set value to null to remove field)',
        },
        replace: {
          type: 'boolean',
          description: 'Replace all frontmatter instead of merging (default: false)',
          default: false,
        },
      },
      required: ['paths', 'updates'],
    },
  },
  {
    name: 'batch_add_tag',
    description: 'Add tags to multiple notes at once. Adds to frontmatter tags array.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of note paths',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to add (without # prefix)',
        },
      },
      required: ['paths', 'tags'],
    },
  },
  {
    name: 'batch_remove_tag',
    description: 'Remove tags from multiple notes at once. Removes from frontmatter tags array.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of note paths',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to remove (without # prefix)',
        },
      },
      required: ['paths', 'tags'],
    },
  },
];
