/**
 * Core types for the Obsidian MCP Server
 */

export interface VaultConfig {
  name: string;
  path: string;
}

export interface Config {
  vaults: Record<string, string>;
  defaultVault: string;
  options: {
    dailyNotesFormat: string;
    templatesFolder: string;
  };
}

export interface NoteInfo {
  path: string;
  name: string;
  modified: string;
  created?: string;
  size?: number;
}

export interface ListNotesOptions {
  folder?: string;
  recursive?: boolean;
  sortBy?: 'name' | 'modified' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  namePattern?: string;
}

export interface NoteContent {
  content: string;
  frontmatter?: Record<string, unknown>;
}

export interface SearchMatch {
  line: string;
  lineNumber: number;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface SearchResult {
  path: string;
  matches: string[] | SearchMatch[];
  lineNumbers?: number[];
}

export type UpdateMode = 'overwrite' | 'append' | 'prepend' | 'replace';

export interface ReplaceOptions {
  search: string;
  replaceAll?: boolean;
  useRegex?: boolean;
}

export interface UpdateResult {
  success: boolean;
  path: string;
  mode: UpdateMode;
  replacements?: number;
}

export interface McpToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}
