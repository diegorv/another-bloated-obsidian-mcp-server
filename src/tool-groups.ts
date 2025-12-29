/**
 * Tool group configuration
 *
 * Allows enabling/disabling specific groups of tools via:
 * - Environment variable: OBSIDIAN_MCP_TOOLS=vault,notes,search
 * - CLI argument: --tools=vault,notes,search
 *
 * Available groups:
 * - vault: Vault management (list_vaults, set_active_vault, register_vault)
 * - notes: Note CRUD (list_notes, read_note, create_note, update_note, delete_note)
 * - search: Search (search_vault)
 * - frontmatter: Frontmatter manipulation (get_frontmatter, update_frontmatter)
 * - tags: Tag management (list_tags, add_tag, remove_tag, search_by_tag)
 * - links: Link analysis (get_outlinks, get_backlinks, find_orphans, find_broken_links, get_link_graph)
 * - daily: Daily notes (get_daily_note, create_daily_note, list_daily_notes, append_to_daily)
 * - templates: Templates (list_templates, get_template, apply_template, create_from_template)
 * - bases: Obsidian Bases (list_bases, get_base, query_base)
 *
 * Special values:
 * - all: Enable all groups (default if nothing specified)
 * - none: Disable all groups
 */

import {
  vaultTools,
  noteTools,
  searchTools,
  frontmatterTools,
  tagTools,
  linkTools,
  dailyNotesTools,
  templateTools,
  basesTools,
  batchTools,
  attachmentTools,
  backupTools,
} from './tools/index.js';

export type ToolGroup =
  | 'vault'
  | 'notes'
  | 'search'
  | 'frontmatter'
  | 'tags'
  | 'links'
  | 'daily'
  | 'templates'
  | 'bases'
  | 'batch'
  | 'attachments'
  | 'backup';

export const ALL_GROUPS: ToolGroup[] = [
  'vault',
  'notes',
  'search',
  'frontmatter',
  'tags',
  'links',
  'daily',
  'templates',
  'bases',
  'batch',
  'attachments',
  'backup',
];

// Map group names to their tools
const toolGroupMap: Record<ToolGroup, unknown[]> = {
  vault: vaultTools,
  notes: noteTools,
  search: searchTools,
  frontmatter: frontmatterTools,
  tags: tagTools,
  links: linkTools,
  daily: dailyNotesTools,
  templates: templateTools,
  bases: basesTools,
  batch: batchTools,
  attachments: attachmentTools,
  backup: backupTools,
};

// Map tool names to their groups (for validation in call handler)
const toolToGroupMap: Record<string, ToolGroup> = {
  // Vault
  list_vaults: 'vault',
  set_active_vault: 'vault',
  register_vault: 'vault',
  // Notes
  list_notes: 'notes',
  read_note: 'notes',
  create_note: 'notes',
  update_note: 'notes',
  delete_note: 'notes',
  rename_note: 'notes',
  move_note: 'notes',
  // Search
  search_vault: 'search',
  // Frontmatter
  get_frontmatter: 'frontmatter',
  update_frontmatter: 'frontmatter',
  remove_frontmatter_field: 'frontmatter',
  add_to_array_field: 'frontmatter',
  remove_from_array_field: 'frontmatter',
  // Tags
  list_tags: 'tags',
  add_tag: 'tags',
  remove_tag: 'tags',
  search_by_tag: 'tags',
  // Links
  get_outlinks: 'links',
  get_backlinks: 'links',
  find_orphans: 'links',
  find_broken_links: 'links',
  get_link_graph: 'links',
  // Daily
  get_daily_note: 'daily',
  create_daily_note: 'daily',
  list_daily_notes: 'daily',
  append_to_daily: 'daily',
  // Templates
  list_templates: 'templates',
  get_template: 'templates',
  apply_template: 'templates',
  create_from_template: 'templates',
  // Bases
  list_bases: 'bases',
  get_base: 'bases',
  query_base: 'bases',
  // Batch
  batch_move: 'batch',
  batch_delete: 'batch',
  batch_update_frontmatter: 'batch',
  batch_add_tag: 'batch',
  batch_remove_tag: 'batch',
  batch_read_notes: 'batch',
  // Attachments
  list_attachments: 'attachments',
  get_attachment_info: 'attachments',
  find_unused_attachments: 'attachments',
  get_attachments_in_note: 'attachments',
  // Backup
  create_note_backup: 'backup',
  list_backups: 'backup',
  restore_backup: 'backup',
  delete_old_backups: 'backup',
};

let enabledGroups: Set<ToolGroup> = new Set(ALL_GROUPS);

/**
 * Parse enabled groups from a comma-separated string
 */
export function parseToolGroups(groupsStr: string): ToolGroup[] {
  const normalized = groupsStr.toLowerCase().trim();

  if (normalized === 'all' || normalized === '') {
    return [...ALL_GROUPS];
  }

  if (normalized === 'none') {
    return [];
  }

  const groups: ToolGroup[] = [];
  for (const group of normalized.split(',')) {
    const trimmed = group.trim() as ToolGroup;
    if (ALL_GROUPS.includes(trimmed)) {
      groups.push(trimmed);
    } else {
      console.error(`Warning: Unknown tool group "${trimmed}". Available: ${ALL_GROUPS.join(', ')}`);
    }
  }

  return groups;
}

/**
 * Initialize enabled groups from environment or CLI args
 */
export function initToolGroups(): void {
  // Check CLI args first (--tools=...)
  const toolsArg = process.argv.find((arg) => arg.startsWith('--tools='));
  if (toolsArg) {
    const groupsStr = toolsArg.split('=')[1];
    enabledGroups = new Set(parseToolGroups(groupsStr));
    console.error(`Enabled tool groups: ${[...enabledGroups].join(', ') || '(none)'}`);
    return;
  }

  // Then check environment variable
  const envGroups = process.env.OBSIDIAN_MCP_TOOLS;
  if (envGroups) {
    enabledGroups = new Set(parseToolGroups(envGroups));
    console.error(`Enabled tool groups: ${[...enabledGroups].join(', ') || '(none)'}`);
    return;
  }

  // Default: all groups enabled
  enabledGroups = new Set(ALL_GROUPS);
}

/**
 * Get the list of enabled tools based on configuration
 */
export function getEnabledTools(): unknown[] {
  const tools: unknown[] = [];

  for (const group of enabledGroups) {
    tools.push(...toolGroupMap[group]);
  }

  return tools;
}

/**
 * Check if a specific tool is enabled
 */
export function isToolEnabled(toolName: string): boolean {
  const group = toolToGroupMap[toolName];
  if (!group) return false;
  return enabledGroups.has(group);
}

/**
 * Get the current enabled groups
 */
export function getEnabledGroups(): ToolGroup[] {
  return [...enabledGroups];
}

/**
 * Get a description of available groups for help
 */
export function getGroupsHelp(): string {
  return `
Available tool groups:
  vault       - Vault management (list_vaults, set_active_vault, register_vault)
  notes       - Note CRUD (list_notes, read_note, create_note, update_note, delete_note, rename_note, move_note)
  search      - Search (search_vault)
  frontmatter - Frontmatter manipulation (get_frontmatter, update_frontmatter, remove_frontmatter_field, add_to_array_field, remove_from_array_field)
  tags        - Tag management (list_tags, add_tag, remove_tag, search_by_tag)
  links       - Link analysis (get_outlinks, get_backlinks, find_orphans, find_broken_links, get_link_graph)
  daily       - Daily notes (get_daily_note, create_daily_note, list_daily_notes, append_to_daily)
  templates   - Templates (list_templates, get_template, apply_template, create_from_template)
  bases       - Obsidian Bases (list_bases, get_base, query_base)
  batch       - Batch operations (batch_move, batch_delete, batch_update_frontmatter, batch_add_tag, batch_remove_tag, batch_read_notes)
  attachments - Attachment management (list_attachments, get_attachment_info, find_unused_attachments, get_attachments_in_note)
  backup      - Backup system (create_note_backup, list_backups, restore_backup, delete_old_backups)

Special values:
  all         - Enable all groups (default)
  none        - Disable all groups

Usage:
  --tools=vault,notes,search    Enable only specified groups
  OBSIDIAN_MCP_TOOLS=vault,notes  Environment variable
`.trim();
}
