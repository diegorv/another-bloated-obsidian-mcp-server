/**
 * Search tools
 */

import { z } from 'zod';
import { searchVault } from '../services/search.js';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';

// Schema definitions
export const searchVaultSchema = z.object({
  query: z.string().describe('Text to search for'),
  caseSensitive: z.boolean().optional().default(false).describe('Case-sensitive search'),
  folder: z.string().optional().describe('Limit search to a specific folder'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results to return'),
});

// Tool implementations
export async function handleSearchVault(args: z.infer<typeof searchVaultSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const results = await searchVault(vaultPath, args.query, {
      caseSensitive: args.caseSensitive,
      folder: args.folder,
      maxResults: args.maxResults,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              query: args.query,
              resultCount: results.length,
              results,
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
export const searchTools = [
  {
    name: 'search_vault',
    description:
      'Search for text across all notes in the vault. Returns matching files with the lines containing the search query.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Whether the search should be case-sensitive (default: false)',
          default: false,
        },
        folder: {
          type: 'string',
          description: 'Limit search to a specific folder',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of files to return (default: 50)',
          default: 50,
        },
      },
      required: ['query'],
    },
  },
];
