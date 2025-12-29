/**
 * Note CRUD tools
 */

import { z } from 'zod';
import {
  listNotes,
  readNote,
  createNote,
  updateNote,
  deleteNote,
  renameNote,
  moveNote,
} from '../services/filesystem.js';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';

// Schema definitions
export const listNotesSchema = z.object({
  folder: z.string().optional().describe('Filter notes by folder path'),
  recursive: z.boolean().optional().describe('Include notes in subfolders'),
  sortBy: z.enum(['name', 'modified', 'created']).optional().describe('Sort notes by: name, modified date, or created date'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order: ascending or descending'),
  limit: z.number().optional().describe('Maximum number of notes to return'),
  offset: z.number().optional().describe('Number of notes to skip (for pagination)'),
  namePattern: z.string().optional().describe('Filter notes by name pattern (regex)'),
});

export const readNoteSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
});

export const createNoteSchema = z.object({
  path: z.string().describe('Path for the new note (relative to vault root)'),
  content: z.string().describe('Content of the note'),
  frontmatter: z.record(z.unknown()).optional().describe('YAML frontmatter as key-value pairs'),
});

export const updateNoteSchema = z.object({
  path: z.string().describe('Path to the note (relative to vault root)'),
  content: z.string().describe('New content (or replacement text in replace mode)'),
  mode: z
    .enum(['overwrite', 'append', 'prepend', 'replace'])
    .optional()
    .describe('How to update: overwrite (replace all), append (add to end), prepend (add to start), replace (find and replace)'),
  search: z.string().optional().describe('Text to search for (required for replace mode)'),
  replaceAll: z.boolean().optional().describe('Replace all occurrences (default: false, only first)'),
  useRegex: z.boolean().optional().describe('Treat search as a regular expression'),
  ignoreFrontmatterConflict: z.boolean().optional().describe('Force prepend even if content contains "---" that may conflict with frontmatter'),
});

export const deleteNoteSchema = z.object({
  path: z.string().describe('Path to the note to delete (relative to vault root)'),
});

export const renameNoteSchema = z.object({
  oldPath: z.string().describe('Current path of the note (relative to vault root)'),
  newPath: z.string().describe('New path for the note (relative to vault root)'),
  updateLinks: z.boolean().optional().describe('Update wikilinks in other notes that reference this note'),
});

export const moveNoteSchema = z.object({
  path: z.string().describe('Path to the note to move (relative to vault root)'),
  destinationFolder: z.string().describe('Destination folder path (relative to vault root, use empty string for root)'),
  updateLinks: z.boolean().optional().describe('Update wikilinks in other notes that reference this note'),
});

// Tool implementations
export async function handleListNotes(args: z.infer<typeof listNotesSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const recursive = args.recursive ?? true;
    const sortBy = args.sortBy ?? 'modified';
    const sortOrder = args.sortOrder ?? 'desc';
    const offset = args.offset ?? 0;

    const result = await listNotes(vaultPath, {
      folder: args.folder,
      recursive,
      sortBy,
      sortOrder,
      limit: args.limit,
      offset,
      namePattern: args.namePattern,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            notes: result.notes,
            count: result.notes.length,
            total: result.total,
            hasMore: args.limit !== undefined && result.total > offset + result.notes.length,
          }, null, 2),
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

export async function handleReadNote(args: z.infer<typeof readNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const note = await readNote(vaultPath, args.path);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(note, null, 2),
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

export async function handleCreateNote(args: z.infer<typeof createNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const createdPath = await createNote(
      vaultPath,
      args.path,
      args.content,
      args.frontmatter
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, path: createdPath }),
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

export async function handleUpdateNote(args: z.infer<typeof updateNoteSchema>) {
  try {
    const mode = args.mode ?? 'overwrite';
    const replaceAll = args.replaceAll ?? false;
    const useRegex = args.useRegex ?? false;
    const ignoreFrontmatterConflict = args.ignoreFrontmatterConflict ?? false;

    // Validate replace mode requires search parameter
    if (mode === 'replace' && !args.search) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'The "search" parameter is required when using replace mode',
            }),
          },
        ],
        isError: true,
      };
    }

    const vaultPath = await getActiveVaultPath();

    // Build options object
    const options = {
      replaceOptions: mode === 'replace'
        ? { search: args.search!, replaceAll, useRegex }
        : undefined,
      ignoreFrontmatterConflict,
    };

    const replacements = await updateNote(
      vaultPath,
      args.path,
      args.content,
      mode,
      options
    );

    const result: Record<string, unknown> = {
      success: true,
      path: args.path,
      mode,
    };

    if (mode === 'replace') {
      result.replacements = replacements;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result),
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

export async function handleDeleteNote(args: z.infer<typeof deleteNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    await deleteNote(vaultPath, args.path);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, deleted: args.path }),
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

export async function handleRenameNote(args: z.infer<typeof renameNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const updateLinks = args.updateLinks ?? true;
    const linksUpdated = await renameNote(
      vaultPath,
      args.oldPath,
      args.newPath,
      updateLinks
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            oldPath: args.oldPath,
            newPath: args.newPath,
            linksUpdated,
          }),
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

export async function handleMoveNote(args: z.infer<typeof moveNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const updateLinks = args.updateLinks ?? true;
    const result = await moveNote(
      vaultPath,
      args.path,
      args.destinationFolder,
      updateLinks
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            oldPath: args.path,
            newPath: result.newPath,
            destinationFolder: args.destinationFolder,
            linksUpdated: result.linksUpdated,
          }),
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
export const noteTools = [
  {
    name: 'list_notes',
    description:
      'List markdown notes in the vault with sorting, filtering, and pagination. Returns paths, names, dates, and sizes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        folder: {
          type: 'string',
          description: 'Filter notes by folder path (e.g., "Projects" or "Daily")',
        },
        recursive: {
          type: 'boolean',
          description: 'Include notes in subfolders (default: true)',
          default: true,
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'modified', 'created'],
          description: 'Sort notes by: name, modified date, or created date (default: modified)',
          default: 'modified',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order: ascending or descending (default: desc)',
          default: 'desc',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of notes to return (for pagination)',
        },
        offset: {
          type: 'number',
          description: 'Number of notes to skip (for pagination, default: 0)',
          default: 0,
        },
        namePattern: {
          type: 'string',
          description: 'Filter notes by name using regex pattern (e.g., "^2024" for notes starting with 2024)',
        },
      },
      required: [],
    },
  },
  {
    name: 'read_note',
    description:
      'Read the content and frontmatter of a specific note. Returns the markdown content and parsed YAML frontmatter if present.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note relative to vault root (e.g., "Projects/MyProject.md")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_note',
    description:
      'Create a new markdown note in the vault. Parent directories will be created if needed. Optionally include YAML frontmatter.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path for the new note (e.g., "Projects/NewProject.md")',
        },
        content: {
          type: 'string',
          description: 'Markdown content for the note',
        },
        frontmatter: {
          type: 'object',
          description:
            'Optional YAML frontmatter as key-value pairs (e.g., {"tags": ["project"], "status": "active"})',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'update_note',
    description:
      'Update an existing note. Modes: overwrite (replace all), append (add to end), prepend (add to start), replace (find and replace specific text). Prepend mode will error if content starts with "---" to prevent frontmatter conflicts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note to update',
        },
        content: {
          type: 'string',
          description: 'New content to write (or replacement text in replace mode)',
        },
        mode: {
          type: 'string',
          enum: ['overwrite', 'append', 'prepend', 'replace'],
          description: 'How to update: overwrite (replace all), append (add to end), prepend (add to start), replace (find and replace)',
          default: 'overwrite',
        },
        search: {
          type: 'string',
          description: 'Text to search for (required for replace mode)',
        },
        replaceAll: {
          type: 'boolean',
          description: 'Replace all occurrences instead of just the first (default: false)',
          default: false,
        },
        useRegex: {
          type: 'boolean',
          description: 'Treat search as a regular expression (default: false)',
          default: false,
        },
        ignoreFrontmatterConflict: {
          type: 'boolean',
          description: 'Force prepend even if content contains "---" that may conflict with existing frontmatter (default: false)',
          default: false,
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_note',
    description: 'Permanently delete a note from the vault. This action cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note to delete',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'rename_note',
    description:
      'Rename a note and optionally update all wikilinks that reference it. Returns the count of notes with updated links.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        oldPath: {
          type: 'string',
          description: 'Current path of the note (e.g., "Projects/OldName.md")',
        },
        newPath: {
          type: 'string',
          description: 'New path for the note (e.g., "Projects/NewName.md")',
        },
        updateLinks: {
          type: 'boolean',
          description: 'Update wikilinks in other notes that reference this note (default: true)',
          default: true,
        },
      },
      required: ['oldPath', 'newPath'],
    },
  },
  {
    name: 'move_note',
    description:
      'Move a note to a different folder. Keeps the same filename but changes location. Optionally updates all wikilinks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note to move (e.g., "Inbox/MyNote.md")',
        },
        destinationFolder: {
          type: 'string',
          description: 'Destination folder path (e.g., "Projects/Active"). Use empty string to move to vault root.',
        },
        updateLinks: {
          type: 'boolean',
          description: 'Update wikilinks in other notes that reference this note (default: true)',
          default: true,
        },
      },
      required: ['path', 'destinationFolder'],
    },
  },
];
