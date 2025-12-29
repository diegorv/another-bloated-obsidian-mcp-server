/**
 * Obsidian Bases (database) parser
 *
 * Obsidian Bases is a feature that creates dynamic views of notes based on filters.
 * The .base file is a YAML configuration that defines:
 * - filters: rules to select which notes to include
 * - properties: how to display note properties
 * - formulas: calculated fields
 * - views: table/card layouts
 *
 * The actual data comes from notes in the vault that match the filters.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { validatePath, getRelativePath, shouldIgnorePath } from '../utils/path.js';
import { parseMarkdown } from './markdown-parser.js';

export interface BaseColumn {
  name: string;
  type: string;
  displayName?: string;
  options?: unknown;
}

export interface BaseRow {
  id: string;
  values: Record<string, unknown>;
}

export interface BaseConfig {
  filters?: {
    and?: string[];
    or?: string[];
  };
  formulas?: Record<string, string>;
  properties?: Record<string, { displayName?: string }>;
  views?: Array<{
    type: string;
    name: string;
    order?: string[];
    sort?: Array<{ property: string; direction: string }>;
  }>;
}

export interface BaseData {
  name: string;
  path: string;
  columns: BaseColumn[];
  rows: BaseRow[];
  config?: BaseConfig;
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
 * Parses the YAML content of a .base file
 */
function parseBaseConfig(content: string): BaseConfig {
  // Use gray-matter to parse YAML (it handles YAML without frontmatter delimiters too)
  // For pure YAML files, we wrap it in frontmatter delimiters
  const yamlContent = content.trim().startsWith('---') ? content : `---\n${content}\n---`;
  const parsed = matter(yamlContent);
  return parsed.data as BaseConfig;
}

/**
 * Evaluates a filter condition against a note
 */
function evaluateFilter(
  filter: string,
  note: {
    fileName: string;
    filePath: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
    content: string;
  }
): boolean {
  // Handle negation
  if (filter.startsWith('!')) {
    return !evaluateFilter(filter.slice(1), note);
  }

  // Parse common filter patterns

  // file.name.contains("text")
  const fileNameContainsMatch = filter.match(/file\.name\.contains\(["']([^"']+)["']\)/);
  if (fileNameContainsMatch) {
    return note.fileName.includes(fileNameContainsMatch[1]);
  }

  // file.name = "text" or file.name == "text"
  const fileNameEqualsMatch = filter.match(/file\.name\s*={1,2}\s*["']([^"']+)["']/);
  if (fileNameEqualsMatch) {
    return note.fileName === fileNameEqualsMatch[1];
  }

  // note.tags.contains("tag") - check if note has the tag
  const tagsContainsMatch = filter.match(/note\.tags\.contains\(["']([^"']+)["']\)/);
  if (tagsContainsMatch) {
    const tag = tagsContainsMatch[1].replace(/^#/, ''); // Remove # if present
    return note.tags.includes(tag);
  }

  // note.property = value or note.property == value
  const propertyEqualsMatch = filter.match(/note\.(\w+)\s*={1,2}\s*["']([^"']+)["']/);
  if (propertyEqualsMatch) {
    const propName = propertyEqualsMatch[1];
    const propValue = propertyEqualsMatch[2];
    return note.frontmatter[propName] === propValue;
  }

  // note.property.contains("value")
  const propertyContainsMatch = filter.match(/note\.(\w+)\.contains\(["']([^"']+)["']\)/);
  if (propertyContainsMatch) {
    const propName = propertyContainsMatch[1];
    const propValue = propertyContainsMatch[2];
    const fmValue = note.frontmatter[propName];
    if (typeof fmValue === 'string') {
      return fmValue.includes(propValue);
    }
    if (Array.isArray(fmValue)) {
      return fmValue.some((v) => String(v).includes(propValue));
    }
    return false;
  }

  // file.folder = "path" - check if note is in specific folder
  const folderEqualsMatch = filter.match(/file\.folder\s*={1,2}\s*["']([^"']+)["']/);
  if (folderEqualsMatch) {
    const folder = folderEqualsMatch[1];
    const noteFolder = path.dirname(note.filePath);
    return noteFolder === folder || noteFolder.startsWith(folder + '/');
  }

  // file.folder.contains("path")
  const folderContainsMatch = filter.match(/file\.folder\.contains\(["']([^"']+)["']\)/);
  if (folderContainsMatch) {
    const folder = folderContainsMatch[1];
    return path.dirname(note.filePath).includes(folder);
  }

  // If we can't parse the filter, return true (include the note)
  // This is safer than excluding notes we don't understand
  return true;
}

/**
 * Evaluates all filters against a note
 */
function evaluateFilters(
  config: BaseConfig,
  note: {
    fileName: string;
    filePath: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
    content: string;
  }
): boolean {
  if (!config.filters) {
    // No filters means include all notes (probably not intended, but safe)
    return false;
  }

  // Handle AND conditions
  if (config.filters.and && config.filters.and.length > 0) {
    return config.filters.and.every((filter) => evaluateFilter(filter, note));
  }

  // Handle OR conditions
  if (config.filters.or && config.filters.or.length > 0) {
    return config.filters.or.some((filter) => evaluateFilter(filter, note));
  }

  return false;
}

/**
 * Scans all markdown notes in the vault
 */
async function scanNotes(
  vaultPath: string
): Promise<
  Array<{
    fileName: string;
    filePath: string;
    fullPath: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
    content: string;
  }>
> {
  const notes: Array<{
    fileName: string;
    filePath: string;
    fullPath: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
    content: string;
  }> = [];

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) continue;

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const parsed = parseMarkdown(content);
          notes.push({
            fileName: entry.name.replace(/\.(md|markdown)$/, ''),
            filePath: relativePath,
            fullPath,
            frontmatter: parsed.frontmatter,
            tags: parsed.tags,
            content: parsed.content,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  await scanDir(vaultPath);
  return notes;
}

/**
 * Infers the type of a value
 */
function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (Array.isArray(value)) return 'multi-select';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string') {
    // Check for date-like strings
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    // Check for URL
    if (/^https?:\/\//.test(value)) return 'url';
  }
  return 'text';
}

/**
 * Builds columns from the config and matching notes
 */
function buildColumns(
  config: BaseConfig,
  notes: Array<{ frontmatter: Record<string, unknown>; fileName: string; tags: string[] }>
): BaseColumn[] {
  const columns: BaseColumn[] = [];
  const seenColumns = new Set<string>();

  // Add file.name column (always present)
  columns.push({
    name: 'file.name',
    type: 'text',
    displayName: config.properties?.['file.name']?.displayName || 'Name',
  });
  seenColumns.add('file.name');

  // Add columns from config properties
  if (config.properties) {
    for (const [propKey, propConfig] of Object.entries(config.properties)) {
      if (seenColumns.has(propKey)) continue;
      seenColumns.add(propKey);

      // Determine the actual property name (remove 'note.' prefix)
      const actualPropName = propKey.replace(/^note\./, '');

      // Find a sample value to infer type
      let sampleValue: unknown = undefined;
      for (const note of notes) {
        if (actualPropName === 'tags') {
          sampleValue = note.tags;
          break;
        } else if (note.frontmatter[actualPropName] !== undefined) {
          sampleValue = note.frontmatter[actualPropName];
          break;
        }
      }

      columns.push({
        name: propKey,
        type: inferType(sampleValue),
        displayName: propConfig.displayName || actualPropName,
      });
    }
  }

  // Add formula columns
  if (config.formulas) {
    for (const [formulaName, _formula] of Object.entries(config.formulas)) {
      if (seenColumns.has(`formula.${formulaName}`)) continue;
      seenColumns.add(`formula.${formulaName}`);

      columns.push({
        name: `formula.${formulaName}`,
        type: 'formula',
        displayName: formulaName,
      });
    }
  }

  // Add columns from note frontmatter that aren't already added
  for (const note of notes) {
    for (const [key, value] of Object.entries(note.frontmatter)) {
      const propKey = `note.${key}`;
      if (seenColumns.has(propKey) || seenColumns.has(key)) continue;
      seenColumns.add(propKey);

      columns.push({
        name: propKey,
        type: inferType(value),
        displayName: key,
      });
    }
  }

  return columns;
}

/**
 * Evaluates a simple formula
 * Currently supports basic age calculation: (now() - property).years.floor()
 */
function evaluateFormula(
  formula: string,
  note: { frontmatter: Record<string, unknown> }
): unknown {
  // Match age-like formulas: (now() - property).years.floor()
  const ageMatch = formula.match(/\(now\(\)\s*-\s*(\w+)\)\.years(?:\.floor\(\))?/);
  if (ageMatch) {
    const propName = ageMatch[1];
    const dateValue = note.frontmatter[propName];
    if (dateValue) {
      const date = new Date(String(dateValue));
      if (!isNaN(date.getTime())) {
        const now = new Date();
        let years = now.getFullYear() - date.getFullYear();
        const monthDiff = now.getMonth() - date.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
          years--;
        }
        return years;
      }
    }
    return null;
  }

  // Return null for unsupported formulas
  return null;
}

/**
 * Builds rows from matching notes
 */
function buildRows(
  config: BaseConfig,
  notes: Array<{
    fileName: string;
    filePath: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
  }>
): BaseRow[] {
  return notes.map((note, index) => {
    const values: Record<string, unknown> = {
      'file.name': note.fileName,
      'file.path': note.filePath,
    };

    // Add frontmatter values
    for (const [key, value] of Object.entries(note.frontmatter)) {
      values[`note.${key}`] = value;
      values[key] = value; // Also add without prefix for convenience
    }

    // Add tags
    values['note.tags'] = note.tags;
    values['tags'] = note.tags;

    // Evaluate formulas
    if (config.formulas) {
      for (const [formulaName, formula] of Object.entries(config.formulas)) {
        values[`formula.${formulaName}`] = evaluateFormula(formula, note);
      }
    }

    return {
      id: String(index),
      values,
    };
  });
}

/**
 * Parses a .base file and returns the data by querying matching notes
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

  // Parse the YAML config
  const config = parseBaseConfig(content);

  // Scan all notes in the vault
  const allNotes = await scanNotes(vaultPath);

  // Filter notes based on the base config
  const matchingNotes = allNotes.filter((note) => evaluateFilters(config, note));

  // Build columns and rows
  const columns = buildColumns(config, matchingNotes);
  const rows = buildRows(config, matchingNotes);

  return {
    name,
    path: relativePath,
    columns,
    rows,
    config,
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

  // Apply additional filter (on top of base filters)
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
