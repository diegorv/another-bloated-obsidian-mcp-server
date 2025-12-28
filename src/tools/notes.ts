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
} from '../services/filesystem.js';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';

// Schema definitions
export const listNotesSchema = z.object({
  folder: z.string().optional().describe('Filter notes by folder path'),
  recursive: z.boolean().optional().default(true).describe('Include notes in subfolders'),
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
  content: z.string().describe('New content'),
  mode: z
    .enum(['overwrite', 'append', 'prepend'])
    .optional()
    .default('overwrite')
    .describe('How to update the note: overwrite (replace), append (add to end), or prepend (add to beginning)'),
});

export const deleteNoteSchema = z.object({
  path: z.string().describe('Path to the note to delete (relative to vault root)'),
});

// Tool implementations
export async function handleListNotes(args: z.infer<typeof listNotesSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const notes = await listNotes(vaultPath, args.folder, args.recursive);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ notes, count: notes.length }, null, 2),
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
    const vaultPath = await getActiveVaultPath();
    await updateNote(vaultPath, args.path, args.content, args.mode);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, path: args.path, mode: args.mode }),
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

// Tool definitions for MCP
export const noteTools = [
  {
    name: 'list_notes',
    description:
      'List all markdown notes in the active vault, optionally filtered by folder. Returns note paths, names, and last modified dates sorted by most recent.',
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
      'Update an existing note. Can overwrite the entire content, append to the end, or prepend to the beginning.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note to update',
        },
        content: {
          type: 'string',
          description: 'New content to write',
        },
        mode: {
          type: 'string',
          enum: ['overwrite', 'append', 'prepend'],
          description: 'How to update: overwrite (replace all), append (add to end), prepend (add to start)',
          default: 'overwrite',
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
];
