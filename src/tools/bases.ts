/**
 * Obsidian Bases (database) tools
 */

import { z } from 'zod';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';
import { listBases, parseBase, queryBase } from '../services/bases-parser.js';

// Schema definitions
export const listBasesSchema = z.object({});

export const getBaseSchema = z.object({
  path: z.string().describe('Path to the .base file'),
});

export const queryBaseSchema = z.object({
  path: z.string().describe('Path to the .base file'),
  filter: z.record(z.string(), z.unknown()).optional().describe('Filter conditions as key-value pairs'),
  sortColumn: z.string().optional().describe('Column to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  limit: z.number().optional().describe('Maximum number of rows to return'),
});

// Tool implementations
export async function handleListBases() {
  try {
    const vaultPath = await getActiveVaultPath();
    const bases = await listBases(vaultPath);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              count: bases.length,
              bases,
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

export async function handleGetBase(args: z.infer<typeof getBaseSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const base = await parseBase(vaultPath, args.path);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              name: base.name,
              path: base.path,
              columnCount: base.columns.length,
              rowCount: base.rows.length,
              columns: base.columns,
              rows: base.rows,
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

export async function handleQueryBase(args: z.infer<typeof queryBaseSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();

    const rows = await queryBase(vaultPath, args.path, {
      filter: args.filter,
      sort: args.sortColumn
        ? { column: args.sortColumn, order: args.sortOrder || 'asc' }
        : undefined,
      limit: args.limit,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              path: args.path,
              resultCount: rows.length,
              rows,
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
export const basesTools = [
  {
    name: 'list_bases',
    description: 'List all Obsidian Bases (database files) in the vault',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_base',
    description: 'Get the full content of an Obsidian Base including schema and all rows',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the .base file',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'query_base',
    description:
      'Query an Obsidian Base with optional filtering, sorting, and limiting. Filter by providing column-value pairs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the .base file',
        },
        filter: {
          type: 'object',
          description: 'Filter conditions (e.g., {"status": "done", "priority": 1})',
        },
        sortColumn: {
          type: 'string',
          description: 'Column to sort by',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order (default: asc)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return',
        },
      },
      required: ['path'],
    },
  },
];
