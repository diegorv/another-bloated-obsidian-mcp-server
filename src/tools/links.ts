/**
 * Link analysis tools
 */

import { z } from 'zod';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';
import {
  getOutlinks,
  getBacklinks,
  findOrphans,
  findBrokenLinks,
  buildLinkGraph,
} from '../services/link-analyzer.js';
import { ensureMarkdownExtension } from '../utils/path.js';

// Schema definitions
export const getOutlinksSchema = z.object({
  path: z.string().describe('Path to the note'),
});

export const getBacklinksSchema = z.object({
  path: z.string().describe('Path to the note'),
});

export const findOrphansSchema = z.object({});

export const findBrokenLinksSchema = z.object({});

export const getLinkGraphSchema = z.object({
  maxNodes: z.number().optional().describe('Maximum number of nodes to include'),
});

// Tool implementations
export async function handleGetOutlinks(args: z.infer<typeof getOutlinksSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const outlinks = await getOutlinks(vaultPath, ensureMarkdownExtension(args.path));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              path: args.path,
              count: outlinks.length,
              outlinks: outlinks.map((l) => ({
                target: l.target,
                alias: l.alias,
                type: l.type,
              })),
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

export async function handleGetBacklinks(args: z.infer<typeof getBacklinksSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const backlinks = await getBacklinks(vaultPath, ensureMarkdownExtension(args.path));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              path: args.path,
              count: backlinks.length,
              backlinks: backlinks.map((l) => ({
                source: l.source,
                alias: l.alias,
                type: l.type,
              })),
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

export async function handleFindOrphans() {
  try {
    const vaultPath = await getActiveVaultPath();
    const orphans = await findOrphans(vaultPath);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              count: orphans.length,
              orphans,
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

export async function handleFindBrokenLinks() {
  try {
    const vaultPath = await getActiveVaultPath();
    const brokenLinks = await findBrokenLinks(vaultPath);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              count: brokenLinks.length,
              brokenLinks,
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

export async function handleGetLinkGraph(args: z.infer<typeof getLinkGraphSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const graph = await buildLinkGraph(vaultPath);
    const maxNodes = args.maxNodes ?? 500;

    // Limit nodes if needed
    const limitedNodes = graph.nodes.slice(0, maxNodes);
    const limitedNodeSet = new Set(limitedNodes);
    const limitedEdges = graph.edges.filter(
      (e) => limitedNodeSet.has(e.source) && limitedNodeSet.has(e.target)
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              nodeCount: limitedNodes.length,
              edgeCount: limitedEdges.length,
              nodes: limitedNodes,
              edges: limitedEdges.map((e) => ({
                source: e.source,
                target: e.target,
                type: e.type,
              })),
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
export const linkTools = [
  {
    name: 'get_outlinks',
    description: 'Get all outgoing links from a note (both [[wikilinks]] and [markdown](links))',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_backlinks',
    description: 'Get all notes that link to a specific note (backlinks)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'find_orphans',
    description: 'Find all orphan notes (notes with no incoming or outgoing links)',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_broken_links',
    description: 'Find all broken links (links pointing to non-existent notes)',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_link_graph',
    description: 'Get the complete link graph of the vault as nodes and edges',
    inputSchema: {
      type: 'object' as const,
      properties: {
        maxNodes: {
          type: 'number',
          description: 'Maximum number of nodes to include (default: 500)',
          default: 500,
        },
      },
      required: [],
    },
  },
];
