/**
 * Daily notes tools
 */

import { z } from 'zod';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';
import {
  loadDailyNotesConfig,
  getOrCreateDailyNote,
  listDailyNotes,
  appendToDailyNote,
  formatDate,
} from '../services/daily-notes.js';

// Schema definitions
export const getDailyNoteSchema = z.object({
  date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
});

export const createDailyNoteSchema = z.object({
  date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
});

export const listDailyNotesSchema = z.object({
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
  limit: z.number().optional().default(30).describe('Maximum number of notes to return'),
});

export const appendToDailySchema = z.object({
  content: z.string().describe('Content to append to the daily note'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
});

// Helper to parse date string
function parseDateArg(dateStr?: string): Date {
  if (!dateStr) return new Date();

  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date();

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  return new Date(year, month, day);
}

// Tool implementations
export async function handleGetDailyNote(args: z.infer<typeof getDailyNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const config = await loadDailyNotesConfig(vaultPath);
    const date = parseDateArg(args.date);

    const result = await getOrCreateDailyNote(vaultPath, config, date);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              path: result.path,
              date: formatDate(date, 'YYYY-MM-DD'),
              created: result.created,
              content: result.content,
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

export async function handleCreateDailyNote(args: z.infer<typeof createDailyNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const config = await loadDailyNotesConfig(vaultPath);
    const date = parseDateArg(args.date);

    const result = await getOrCreateDailyNote(vaultPath, config, date);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              path: result.path,
              date: formatDate(date, 'YYYY-MM-DD'),
              created: result.created,
              message: result.created ? 'Daily note created' : 'Daily note already exists',
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
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleListDailyNotes(args: z.infer<typeof listDailyNotesSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const config = await loadDailyNotesConfig(vaultPath);

    const startDate = args.startDate ? parseDateArg(args.startDate) : undefined;
    const endDate = args.endDate ? parseDateArg(args.endDate) : undefined;

    const notes = await listDailyNotes(vaultPath, config, startDate, endDate);
    const limited = notes.slice(0, args.limit);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              count: limited.length,
              totalFound: notes.length,
              config: {
                folder: config.folder || '(root)',
                format: config.format,
              },
              notes: limited,
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

export async function handleAppendToDaily(args: z.infer<typeof appendToDailySchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const config = await loadDailyNotesConfig(vaultPath);
    const date = parseDateArg(args.date);

    const notePath = await appendToDailyNote(vaultPath, config, args.content, date);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              path: notePath,
              date: formatDate(date, 'YYYY-MM-DD'),
              appended: args.content.length + ' characters',
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
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

// Tool definitions for MCP
export const dailyNotesTools = [
  {
    name: 'get_daily_note',
    description:
      'Get the daily note for a specific date. Creates the note if it does not exist. Uses the vault\'s daily notes configuration for folder and format.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today)',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_daily_note',
    description: 'Create a daily note for a specific date if it does not exist',
    inputSchema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today)',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_daily_notes',
    description: 'List daily notes, optionally filtered by date range',
    inputSchema: {
      type: 'object' as const,
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of notes to return (default: 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: 'append_to_daily',
    description: 'Append content to today\'s daily note (or a specific date). Creates the note if needed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'Content to append',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today)',
        },
      },
      required: ['content'],
    },
  },
];
