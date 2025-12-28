/**
 * Tag management tools
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { validatePath, ensureMarkdownExtension, isMarkdownFile, shouldIgnorePath, getRelativePath } from '../utils/path.js';
import { formatError } from '../utils/errors.js';
import { extractTags, addTagToFrontmatter, removeTagFromFrontmatter } from '../services/markdown-parser.js';
import matter from 'gray-matter';

// Schema definitions
export const listTagsSchema = z.object({
  folder: z.string().optional().describe('Limit tag search to a specific folder'),
});

export const addTagSchema = z.object({
  path: z.string().describe('Path to the note'),
  tag: z.string().describe('Tag to add (with or without # prefix)'),
});

export const removeTagSchema = z.object({
  path: z.string().describe('Path to the note'),
  tag: z.string().describe('Tag to remove (with or without # prefix)'),
});

export const searchByTagSchema = z.object({
  tag: z.string().describe('Tag to search for (with or without # prefix)'),
  folder: z.string().optional().describe('Limit search to a specific folder'),
});

// Helper function to collect tags from vault
async function collectAllTags(
  vaultPath: string,
  folder?: string
): Promise<{ tag: string; count: number; notes: string[] }[]> {
  const targetPath = folder ? validatePath(folder, vaultPath) : vaultPath;
  const tagMap = new Map<string, string[]>();

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) continue;

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && isMarkdownFile(entry.name)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const parsed = matter(content);
        const tags = extractTags(content, parsed.data);

        for (const tag of tags) {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag)!.push(relativePath);
        }
      }
    }
  }

  await scanDir(targetPath);

  return Array.from(tagMap.entries())
    .map(([tag, notes]) => ({ tag, count: notes.length, notes }))
    .sort((a, b) => b.count - a.count);
}

// Tool implementations
export async function handleListTags(args: z.infer<typeof listTagsSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const tags = await collectAllTags(vaultPath, args.folder);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              totalTags: tags.length,
              tags: tags.map(({ tag, count }) => ({ tag, count })),
            },
            null,
            2
          ),
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

export async function handleAddTag(args: z.infer<typeof addTagSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const newContent = addTagToFrontmatter(content, args.tag);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    const normalizedTag = args.tag.startsWith('#') ? args.tag.slice(1) : args.tag;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: args.path,
            addedTag: normalizedTag,
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

export async function handleRemoveTag(args: z.infer<typeof removeTagSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(ensureMarkdownExtension(args.path), vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const newContent = removeTagFromFrontmatter(content, args.tag);
    await fs.writeFile(fullPath, newContent, 'utf-8');

    const normalizedTag = args.tag.startsWith('#') ? args.tag.slice(1) : args.tag;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: args.path,
            removedTag: normalizedTag,
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

export async function handleSearchByTag(args: z.infer<typeof searchByTagSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const normalizedTag = args.tag.startsWith('#') ? args.tag.slice(1) : args.tag;

    const allTags = await collectAllTags(vaultPath, args.folder);
    const tagData = allTags.find((t) => t.tag.toLowerCase() === normalizedTag.toLowerCase());

    if (!tagData) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              tag: normalizedTag,
              count: 0,
              notes: [],
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              tag: tagData.tag,
              count: tagData.count,
              notes: tagData.notes,
            },
            null,
            2
          ),
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

// Tool definitions for MCP
export const tagTools = [
  {
    name: 'list_tags',
    description: 'List all unique tags used in the vault with their occurrence count',
    inputSchema: {
      type: 'object' as const,
      properties: {
        folder: {
          type: 'string',
          description: 'Limit tag search to a specific folder',
        },
      },
      required: [],
    },
  },
  {
    name: 'add_tag',
    description: 'Add a tag to a note\'s frontmatter. Creates the tags array if it doesn\'t exist.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
        tag: {
          type: 'string',
          description: 'Tag to add (e.g., "project" or "#project")',
        },
      },
      required: ['path', 'tag'],
    },
  },
  {
    name: 'remove_tag',
    description: 'Remove a tag from a note\'s frontmatter',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
        tag: {
          type: 'string',
          description: 'Tag to remove',
        },
      },
      required: ['path', 'tag'],
    },
  },
  {
    name: 'search_by_tag',
    description: 'Find all notes that have a specific tag (in frontmatter or inline)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tag: {
          type: 'string',
          description: 'Tag to search for',
        },
        folder: {
          type: 'string',
          description: 'Limit search to a specific folder',
        },
      },
      required: ['tag'],
    },
  },
];
