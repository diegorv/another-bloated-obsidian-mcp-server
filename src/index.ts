#!/usr/bin/env node

/**
 * Obsidian MCP Server
 *
 * A Model Context Protocol server that provides AI assistants
 * with access to Obsidian vaults.
 *
 * Tool groups can be configured via:
 * - CLI: --tools=vault,notes,search
 * - Environment: OBSIDIAN_MCP_TOOLS=vault,notes,search
 *
 * Run with --help for more information.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool handlers
import {
  handleListVaults,
  handleSetActiveVault,
  handleRegisterVault,
  setActiveVaultSchema,
  registerVaultSchema,
} from './tools/vault.js';
import {
  handleListNotes,
  handleReadNote,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  handleRenameNote,
  handleMoveNote,
  listNotesSchema,
  readNoteSchema,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  renameNoteSchema,
  moveNoteSchema,
} from './tools/notes.js';
import {
  handleSearchVault,
  searchVaultSchema,
} from './tools/search.js';
import {
  handleGetFrontmatter,
  handleUpdateFrontmatter,
  handleRemoveFrontmatterField,
  handleAddToArrayField,
  handleRemoveFromArrayField,
  getFrontmatterSchema,
  updateFrontmatterSchema,
  removeFrontmatterFieldSchema,
  addToArrayFieldSchema,
  removeFromArrayFieldSchema,
} from './tools/frontmatter.js';
import {
  handleListTags,
  handleAddTag,
  handleRemoveTag,
  handleSearchByTag,
  listTagsSchema,
  addTagSchema,
  removeTagSchema,
  searchByTagSchema,
} from './tools/tags.js';
import {
  handleGetOutlinks,
  handleGetBacklinks,
  handleFindOrphans,
  handleFindBrokenLinks,
  handleGetLinkGraph,
  getOutlinksSchema,
  getBacklinksSchema,
  getLinkGraphSchema,
} from './tools/links.js';
import {
  handleGetDailyNote,
  handleCreateDailyNote,
  handleListDailyNotes,
  handleAppendToDaily,
  getDailyNoteSchema,
  createDailyNoteSchema,
  listDailyNotesSchema,
  appendToDailySchema,
} from './tools/daily-notes.js';
import {
  handleListTemplates,
  handleGetTemplate,
  handleApplyTemplate,
  handleCreateFromTemplate,
  getTemplateSchema,
  applyTemplateSchema,
  createFromTemplateSchema,
} from './tools/templates.js';
import {
  handleListBases,
  handleGetBase,
  handleQueryBase,
  getBaseSchema,
  queryBaseSchema,
} from './tools/bases.js';
import {
  handleBatchMove,
  handleBatchDelete,
  handleBatchUpdateFrontmatter,
  handleBatchAddTag,
  handleBatchRemoveTag,
  batchMoveSchema,
  batchDeleteSchema,
  batchUpdateFrontmatterSchema,
  batchAddTagSchema,
  batchRemoveTagSchema,
  batchTools,
} from './tools/batch.js';

// Import config and tool groups
import { registerVault } from './services/vault-manager.js';
import {
  initToolGroups,
  getEnabledTools,
  isToolEnabled,
  getGroupsHelp,
} from './tool-groups.js';

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Obsidian MCP Server

Usage:
  npx tsx src/index.ts [vault-path] [vault-name] [options]

Arguments:
  vault-path    Path to your Obsidian vault
  vault-name    Name for the vault (default: "default")

Options:
  --tools=GROUPS  Comma-separated list of tool groups to enable
  --help, -h      Show this help message

${getGroupsHelp()}

Examples:
  # Enable all tools
  npx tsx src/index.ts /path/to/vault

  # Enable only basic CRUD
  npx tsx src/index.ts /path/to/vault --tools=vault,notes,search

  # Enable specific groups
  npx tsx src/index.ts /path/to/vault --tools=vault,notes,frontmatter,tags

  # Disable all tools (for testing)
  npx tsx src/index.ts /path/to/vault --tools=none
`);
  process.exit(0);
}

// Initialize tool groups from env/args
initToolGroups();

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

// Handle list tools request - only return enabled tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: getEnabledTools() as Array<{
      name: string;
      description: string;
      inputSchema: unknown;
    }>,
  };
});

// Handle tool calls - check if tool is enabled
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Check if tool is enabled
  if (!isToolEnabled(name)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: `Tool "${name}" is not enabled. Check --tools configuration.`,
          }),
        },
      ],
      isError: true,
    };
  }

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

    case 'rename_note':
      return handleRenameNote(renameNoteSchema.parse(args));

    case 'move_note':
      return handleMoveNote(moveNoteSchema.parse(args));

    // Search tools
    case 'search_vault':
      return handleSearchVault(searchVaultSchema.parse(args));

    // Frontmatter tools
    case 'get_frontmatter':
      return handleGetFrontmatter(getFrontmatterSchema.parse(args));

    case 'update_frontmatter':
      return handleUpdateFrontmatter(updateFrontmatterSchema.parse(args));

    case 'remove_frontmatter_field':
      return handleRemoveFrontmatterField(removeFrontmatterFieldSchema.parse(args));

    case 'add_to_array_field':
      return handleAddToArrayField(addToArrayFieldSchema.parse(args));

    case 'remove_from_array_field':
      return handleRemoveFromArrayField(removeFromArrayFieldSchema.parse(args));

    // Tag tools
    case 'list_tags':
      return handleListTags(listTagsSchema.parse(args));

    case 'add_tag':
      return handleAddTag(addTagSchema.parse(args));

    case 'remove_tag':
      return handleRemoveTag(removeTagSchema.parse(args));

    case 'search_by_tag':
      return handleSearchByTag(searchByTagSchema.parse(args));

    // Link tools
    case 'get_outlinks':
      return handleGetOutlinks(getOutlinksSchema.parse(args));

    case 'get_backlinks':
      return handleGetBacklinks(getBacklinksSchema.parse(args));

    case 'find_orphans':
      return handleFindOrphans();

    case 'find_broken_links':
      return handleFindBrokenLinks();

    case 'get_link_graph':
      return handleGetLinkGraph(getLinkGraphSchema.parse(args));

    // Daily notes tools
    case 'get_daily_note':
      return handleGetDailyNote(getDailyNoteSchema.parse(args));

    case 'create_daily_note':
      return handleCreateDailyNote(createDailyNoteSchema.parse(args));

    case 'list_daily_notes':
      return handleListDailyNotes(listDailyNotesSchema.parse(args));

    case 'append_to_daily':
      return handleAppendToDaily(appendToDailySchema.parse(args));

    // Template tools
    case 'list_templates':
      return handleListTemplates();

    case 'get_template':
      return handleGetTemplate(getTemplateSchema.parse(args));

    case 'apply_template':
      return handleApplyTemplate(applyTemplateSchema.parse(args));

    case 'create_from_template':
      return handleCreateFromTemplate(createFromTemplateSchema.parse(args));

    // Bases tools
    case 'list_bases':
      return handleListBases();

    case 'get_base':
      return handleGetBase(getBaseSchema.parse(args));

    case 'query_base':
      return handleQueryBase(queryBaseSchema.parse(args));

    // Batch tools
    case 'batch_move':
      return handleBatchMove(batchMoveSchema.parse(args));

    case 'batch_delete':
      return handleBatchDelete(batchDeleteSchema.parse(args));

    case 'batch_update_frontmatter':
      return handleBatchUpdateFrontmatter(batchUpdateFrontmatterSchema.parse(args));

    case 'batch_add_tag':
      return handleBatchAddTag(batchAddTagSchema.parse(args));

    case 'batch_remove_tag':
      return handleBatchRemoveTag(batchRemoveTagSchema.parse(args));

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
  // Filter out option arguments
  const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

  if (positionalArgs.length > 0) {
    const vaultPath = positionalArgs[0];
    const vaultName = positionalArgs[1] || 'default';

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
