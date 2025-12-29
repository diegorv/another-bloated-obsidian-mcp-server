/**
 * Obsidian Bases (database) parser
 *
 * Note: Obsidian Bases is a relatively new feature.
 * This implementation supports the basic .base file format.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { validatePath, getRelativePath, shouldIgnorePath } from '../utils/path.js';

/**
 * Zod schemas for validating .base file JSON structures
 * These prevent prototype pollution and ensure data integrity
 */
const baseColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  options: z.unknown().optional(),
}).passthrough();

// Schema for rows that already have id and values structure
const structuredRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  values: z.record(z.string(), z.unknown()),
}).passthrough();

// Schema for standard format with columns and rows (with id/values structure)
const standardBaseWithStructuredRowsSchema = z.object({
  columns: z.array(baseColumnSchema),
  rows: z.array(structuredRowSchema),
}).passthrough();

// Schema for standard format with columns and simple rows (values only)
const standardBaseWithSimpleRowsSchema = z.object({
  columns: z.array(baseColumnSchema),
  rows: z.array(z.record(z.string(), z.unknown())),
}).passthrough();

// Schema for schema + data format
const schemaDataBaseSchema = z.object({
  schema: z.object({
    columns: z.array(baseColumnSchema).optional(),
  }).passthrough(),
  data: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

/**
 * Safely parses JSON and validates it's a plain object or array
 * Prevents prototype pollution attacks
 */
function safeJsonParse(content: string): unknown {
  const parsed = JSON.parse(content);

  // Reject if null or primitive
  if (parsed === null || typeof parsed !== 'object') {
    return parsed;
  }

  // Check for prototype pollution attempts
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  function checkForDangerousKeys(obj: unknown, depth = 0): void {
    // Prevent deep recursion attacks
    if (depth > 10) return;

    if (obj === null || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        checkForDangerousKeys(item, depth + 1);
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (dangerousKeys.includes(key)) {
          throw new Error(`Potentially malicious key "${key}" detected in .base file`);
        }
        checkForDangerousKeys((obj as Record<string, unknown>)[key], depth + 1);
      }
    }
  }

  checkForDangerousKeys(parsed);
  return parsed;
}

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
    // Use safeJsonParse to prevent prototype pollution attacks
    const data = safeJsonParse(content);

    // Handle different possible formats
    if (Array.isArray(data)) {
      // Array of rows format - validate each row is a record
      const validatedRows = data.filter(
        (row): row is Record<string, unknown> =>
          row !== null && typeof row === 'object' && !Array.isArray(row)
      );
      const columns = inferColumnsFromRows(validatedRows);
      const rows = validatedRows.map((row, index) => ({
        id: String(index),
        values: row,
      }));
      return { name, path: relativePath, columns, rows };
    }

    // Ensure data is an object for the remaining checks
    if (data === null || typeof data !== 'object') {
      return parseStructuredText(content, name, relativePath);
    }

    const dataObj = data as Record<string, unknown>;

    // Try to validate as standard format with structured rows (id + values)
    const structuredResult = standardBaseWithStructuredRowsSchema.safeParse(dataObj);
    if (structuredResult.success) {
      return {
        name,
        path: relativePath,
        columns: structuredResult.data.columns,
        rows: structuredResult.data.rows.map((row) => ({
          id: String(row.id),
          values: row.values,
        })),
      };
    }

    // Try to validate as standard format with simple rows (values only)
    const simpleResult = standardBaseWithSimpleRowsSchema.safeParse(dataObj);
    if (simpleResult.success) {
      return {
        name,
        path: relativePath,
        columns: simpleResult.data.columns,
        rows: simpleResult.data.rows.map((row: Record<string, unknown>, index: number) => ({
          id: String(index),
          values: row,
        })),
      };
    }

    // Try to validate as schema + data format
    const schemaDataResult = schemaDataBaseSchema.safeParse(dataObj);
    if (schemaDataResult.success) {
      const { schema, data: rowsData } = schemaDataResult.data;
      return {
        name,
        path: relativePath,
        columns: schema.columns || [],
        rows: (rowsData || []).map((row: Record<string, unknown>, index: number) => ({
          id: String((row as Record<string, unknown>).id || index),
          values: row,
        })),
      };
    }

    // Fallback: treat entire object as a single record
    return {
      name,
      path: relativePath,
      columns: inferColumnsFromRows([dataObj]),
      rows: [{ id: '0', values: dataObj }],
    };
  } catch (error) {
    // Re-throw security-related errors (prototype pollution, etc.)
    if (error instanceof Error && error.message.includes('malicious')) {
      throw error;
    }
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
