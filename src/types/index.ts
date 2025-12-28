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
}

export interface NoteContent {
  content: string;
  frontmatter?: Record<string, unknown>;
}

export interface SearchResult {
  path: string;
  matches: string[];
  lineNumbers?: number[];
}

export type UpdateMode = 'overwrite' | 'append' | 'prepend';

export interface McpToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}
