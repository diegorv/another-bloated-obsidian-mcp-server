#!/usr/bin/env node

/**
 * Obsidian MCP Server
 *
 * A Model Context Protocol server that provides AI assistants
 * with access to Obsidian vaults.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import {
  vaultTools,
  handleListVaults,
  handleSetActiveVault,
  handleRegisterVault,
  setActiveVaultSchema,
  registerVaultSchema,
} from './tools/vault.js';
import {
  noteTools,
  handleListNotes,
  handleReadNote,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  listNotesSchema,
  readNoteSchema,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
} from './tools/notes.js';
import {
  searchTools,
  handleSearchVault,
  searchVaultSchema,
} from './tools/search.js';
import {
  frontmatterTools,
  handleGetFrontmatter,
  handleUpdateFrontmatter,
  getFrontmatterSchema,
  updateFrontmatterSchema,
} from './tools/frontmatter.js';
import {
  tagTools,
  handleListTags,
  handleAddTag,
  handleRemoveTag,
  handleSearchByTag,
  listTagsSchema,
  addTagSchema,
  removeTagSchema,
  searchByTagSchema,
} from './tools/tags.js';

// Import config
import { registerVault } from './services/vault-manager.js';

// Create server instance
const server = new Server(
  {
    name: 'obsidian-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Combine all tools
const allTools = [...vaultTools, ...noteTools, ...searchTools, ...frontmatterTools, ...tagTools];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // Vault tools
    case 'list_vaults':
      return handleListVaults();

    case 'set_active_vault':
      return handleSetActiveVault(setActiveVaultSchema.parse(args));

    case 'register_vault':
      return handleRegisterVault(registerVaultSchema.parse(args));

    // Note tools
    case 'list_notes':
      return handleListNotes(listNotesSchema.parse(args));

    case 'read_note':
      return handleReadNote(readNoteSchema.parse(args));

    case 'create_note':
      return handleCreateNote(createNoteSchema.parse(args));

    case 'update_note':
      return handleUpdateNote(updateNoteSchema.parse(args));

    case 'delete_note':
      return handleDeleteNote(deleteNoteSchema.parse(args));

    // Search tools
    case 'search_vault':
      return handleSearchVault(searchVaultSchema.parse(args));

    // Frontmatter tools
    case 'get_frontmatter':
      return handleGetFrontmatter(getFrontmatterSchema.parse(args));

    case 'update_frontmatter':
      return handleUpdateFrontmatter(updateFrontmatterSchema.parse(args));

    // Tag tools
    case 'list_tags':
      return handleListTags(listTagsSchema.parse(args));

    case 'add_tag':
      return handleAddTag(addTagSchema.parse(args));

    case 'remove_tag':
      return handleRemoveTag(removeTagSchema.parse(args));

    case 'search_by_tag':
      return handleSearchByTag(searchByTagSchema.parse(args));

    default:
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
        isError: true,
      };
  }
});

// Parse command line arguments for initial vault
async function parseArgs(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const vaultPath = args[0];
    const vaultName = args[1] || 'default';

    try {
      await registerVault(vaultName, vaultPath);
      console.error(`Registered vault "${vaultName}" at ${vaultPath}`);
    } catch (error) {
      console.error(`Warning: Could not register vault: ${error}`);
    }
  }
}

// Main entry point
async function main(): Promise<void> {
  await parseArgs();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Obsidian MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
