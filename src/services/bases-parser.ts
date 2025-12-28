/**
 * Obsidian Bases (database) parser
 *
 * Note: Obsidian Bases is a relatively new feature.
 * This implementation supports the basic .base file format.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath, getRelativePath, shouldIgnorePath } from '../utils/path.js';

export interface BaseColumn {
  name: string;
  type: string;
  options?: unknown;
}

export interface BaseRow {
  id: string;
  values: Record<string, unknown>;
}

export interface BaseData {
  name: string;
  path: string;
  columns: BaseColumn[];
  rows: BaseRow[];
}

/**
 * Lists all .base files in the vault
 */
export async function listBases(vaultPath: string): Promise<{ name: string; path: string }[]> {
  const bases: { name: string; path: string }[] = [];

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) continue;

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.base')) {
        bases.push({
          name: entry.name.replace('.base', ''),
          path: relativePath,
        });
      }
    }
  }

  await scanDir(vaultPath);
  return bases.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parses a .base file
 * Note: The actual format may vary. This is a best-effort implementation.
 */
export async function parseBase(vaultPath: string, basePath: string): Promise<BaseData> {
  let fullPath = basePath;
  if (!fullPath.endsWith('.base')) {
    fullPath += '.base';
  }
  fullPath = validatePath(fullPath, vaultPath);

  const content = await fs.readFile(fullPath, 'utf-8');
  const relativePath = getRelativePath(fullPath, vaultPath);
  const name = path.basename(fullPath, '.base');

  try {
    // Try to parse as JSON (common format for database files)
    const data = JSON.parse(content);

    // Handle different possible formats
    if (Array.isArray(data)) {
      // Array of rows format
      const columns = inferColumnsFromRows(data);
      const rows = data.map((row, index) => ({
        id: String(index),
        values: row,
      }));
      return { name, path: relativePath, columns, rows };
    }

    if (data.columns && data.rows) {
      // Standard format with columns and rows
      return {
        name,
        path: relativePath,
        columns: data.columns,
        rows: data.rows,
      };
    }

    if (data.schema && data.data) {
      // Schema + data format
      return {
        name,
        path: relativePath,
        columns: data.schema.columns || [],
        rows: (data.data || []).map((row: Record<string, unknown>, index: number) => ({
          id: String(row.id || index),
          values: row,
        })),
      };
    }

    // Fallback: treat entire object as a single record
    return {
      name,
      path: relativePath,
      columns: inferColumnsFromRows([data]),
      rows: [{ id: '0', values: data }],
    };
  } catch {
    // If not JSON, try to parse as structured text
    return parseStructuredText(content, name, relativePath);
  }
}

/**
 * Infers column definitions from row data
 */
function inferColumnsFromRows(rows: Record<string, unknown>[]): BaseColumn[] {
  const columnMap = new Map<string, string>();

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!columnMap.has(key)) {
        columnMap.set(key, inferType(value));
      }
    }
  }

  return Array.from(columnMap.entries()).map(([name, type]) => ({
    name,
    type,
  }));
}

/**
 * Infers the type of a value
 */
function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (Array.isArray(value)) return 'multi-select';
  if (typeof value === 'string') {
    // Check for date-like strings
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    // Check for URL
    if (/^https?:\/\//.test(value)) return 'url';
  }
  return 'text';
}

/**
 * Attempts to parse structured text (like markdown tables)
 */
function parseStructuredText(content: string, name: string, relativePath: string): BaseData {
  const lines = content.trim().split('\n');

  // Try to parse as markdown table
  if (lines.length >= 2 && lines[0].includes('|')) {
    const headerLine = lines[0];
    const headers = headerLine
      .split('|')
      .map((h) => h.trim())
      .filter((h) => h);

    const columns = headers.map((h) => ({ name: h, type: 'text' }));
    const rows: BaseRow[] = [];

    // Skip separator line (second line usually)
    const startLine = lines[1].includes('---') ? 2 : 1;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('|')) continue;

      const values = line
        .split('|')
        .map((v) => v.trim())
        .filter((v, index, arr) => index > 0 && index < arr.length - 1 || arr.length === headers.length);

      const rowValues: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        rowValues[header] = values[index] || '';
      });

      rows.push({
        id: String(i - startLine),
        values: rowValues,
      });
    }

    return { name, path: relativePath, columns, rows };
  }

  // Return empty structure if parsing fails
  return {
    name,
    path: relativePath,
    columns: [],
    rows: [],
  };
}

/**
 * Queries a base with optional filters
 */
export async function queryBase(
  vaultPath: string,
  basePath: string,
  options: {
    filter?: Record<string, unknown>;
    sort?: { column: string; order: 'asc' | 'desc' };
    limit?: number;
  } = {}
): Promise<BaseRow[]> {
  const base = await parseBase(vaultPath, basePath);
  let rows = [...base.rows];

  // Apply filter
  if (options.filter) {
    rows = rows.filter((row) => {
      for (const [key, value] of Object.entries(options.filter!)) {
        const rowValue = row.values[key];
        if (value instanceof RegExp) {
          if (typeof rowValue !== 'string' || !value.test(rowValue)) {
            return false;
          }
        } else if (rowValue !== value) {
          return false;
        }
      }
      return true;
    });
  }

  // Apply sort
  if (options.sort) {
    const { column, order } = options.sort;
    rows.sort((a, b) => {
      const aVal = a.values[column];
      const bVal = b.values[column];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return order === 'desc' ? -comparison : comparison;
    });
  }

  // Apply limit
  if (options.limit && options.limit > 0) {
    rows = rows.slice(0, options.limit);
  }

  return rows;
}
