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
import { evaluateExpression, EvaluationContext } from './expression-parser.js';

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

// Phase 14: View configuration
export interface BaseView {
  type: 'table' | 'cards' | 'list' | 'map';
  name?: string;
  limit?: number;
  filters?: {
    and?: string[];
    or?: string[];
  };
  order?: string[];
  sort?: Array<{ property: string; direction: 'ASC' | 'DESC' | 'asc' | 'desc' }>;
  groupBy?: {
    property: string;
    direction?: 'ASC' | 'DESC' | 'asc' | 'desc';
  };
  summaries?: Record<string, string>;
}

export interface BaseConfig {
  filters?: {
    and?: string[];
    or?: string[];
  };
  formulas?: Record<string, string>;
  properties?: Record<string, { displayName?: string }>;
  views?: BaseView[];
  // Phase 13: Summaries configuration
  summaries?: Record<string, string>;
}

// Phase 13: Summary result type
export interface BaseSummary {
  column: string;
  type: string;
  value: unknown;
}

export interface BaseData {
  name: string;
  path: string;
  columns: BaseColumn[];
  rows: BaseRow[];
  config?: BaseConfig;
  // Phase 13: Computed summaries
  summaries?: BaseSummary[];
  // Phase 14: Parsed views
  views?: BaseView[];
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
 * Extended note type with full file properties (Phase 3)
 */
interface NoteWithFileProperties {
  fileName: string;
  filePath: string;
  fullPath: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  content: string;
  // Phase 3: File properties
  fileStats?: {
    size: number;
    ctime: Date;
    mtime: Date;
  };
  links: string[];
  embeds: string[];
}

/**
 * Builds an evaluation context from a note for the expression parser
 */
function buildEvaluationContext(note: NoteWithFileProperties): EvaluationContext {
  const folder = path.dirname(note.filePath);
  const ext = path.extname(note.filePath).slice(1); // Remove leading dot
  const basename = path.basename(note.filePath, `.${ext}`);

  return {
    // File object with all properties (Phase 3)
    file: {
      name: note.fileName,
      path: note.filePath,
      folder: folder === '.' ? '' : folder,
      ext,
      basename,
      size: note.fileStats?.size ?? 0,
      ctime: note.fileStats?.ctime ?? new Date(),
      mtime: note.fileStats?.mtime ?? new Date(),
      tags: note.tags,
      links: note.links,
      embeds: note.embeds,
      properties: note.frontmatter,
    },
    // Note properties (frontmatter)
    note: {
      tags: note.tags,
      ...note.frontmatter,
    },
    // Direct access to common properties
    ...note.frontmatter,
    tags: note.tags,
  };
}

/**
 * Evaluates a filter condition against a note using the expression parser
 */
function evaluateFilter(filter: string, note: NoteWithFileProperties): boolean {
  try {
    const context = buildEvaluationContext(note);
    const result = evaluateExpression(filter, context);
    // Convert result to boolean
    if (typeof result === 'boolean') return result;
    if (result === null || result === undefined) return false;
    if (typeof result === 'number') return result !== 0;
    if (typeof result === 'string') return result.length > 0;
    if (Array.isArray(result)) return result.length > 0;
    return Boolean(result);
  } catch {
    // If expression parsing fails, fall back to legacy regex-based evaluation
    return evaluateFilterLegacy(filter, note);
  }
}

/**
 * Legacy filter evaluation using regex (fallback for backwards compatibility)
 */
function evaluateFilterLegacy(
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
    return !evaluateFilterLegacy(filter.slice(1), note);
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
function evaluateFilters(config: BaseConfig, note: NoteWithFileProperties): boolean {
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
 * Extracts wiki-style links from markdown content
 * Matches [[link]] and [[link|display]]
 */
function extractLinks(content: string): string[] {
  const links: string[] = [];
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

/**
 * Extracts embedded content from markdown
 * Matches ![[embed]] and ![[embed|display]]
 */
function extractEmbeds(content: string): string[] {
  const embeds: string[] = [];
  const embedRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = embedRegex.exec(content)) !== null) {
    embeds.push(match[1]);
  }
  return embeds;
}

/**
 * Scans all markdown notes in the vault
 */
async function scanNotes(vaultPath: string): Promise<NoteWithFileProperties[]> {
  const notes: NoteWithFileProperties[] = [];

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
          const [content, stats] = await Promise.all([
            fs.readFile(fullPath, 'utf-8'),
            fs.stat(fullPath),
          ]);
          const parsed = parseMarkdown(content);
          notes.push({
            fileName: entry.name.replace(/\.(md|markdown)$/, ''),
            filePath: relativePath,
            fullPath,
            frontmatter: parsed.frontmatter,
            tags: parsed.tags,
            content: parsed.content,
            // Phase 3: File properties
            fileStats: {
              size: stats.size,
              ctime: stats.birthtime,
              mtime: stats.mtime,
            },
            links: extractLinks(parsed.content),
            embeds: extractEmbeds(parsed.content),
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
 * Evaluates a formula using the expression parser
 */
function evaluateFormula(formula: string, note: NoteWithFileProperties): unknown {
  try {
    const context = buildEvaluationContext(note);
    return evaluateExpression(formula, context);
  } catch {
    // Fall back to legacy formula evaluation
    return evaluateFormulaLegacy(formula, note);
  }
}

/**
 * Legacy formula evaluation (fallback for backwards compatibility)
 * Supports basic age calculation: (now() - property).years.floor()
 */
function evaluateFormulaLegacy(
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
function buildRows(config: BaseConfig, notes: NoteWithFileProperties[]): BaseRow[] {
  return notes.map((note, index) => {
    const folder = path.dirname(note.filePath);
    const ext = path.extname(note.filePath).slice(1);
    const basename = path.basename(note.filePath, `.${ext}`);

    const values: Record<string, unknown> = {
      // Phase 3: Complete file properties
      'file.name': note.fileName,
      'file.path': note.filePath,
      'file.folder': folder === '.' ? '' : folder,
      'file.ext': ext,
      'file.basename': basename,
      'file.size': note.fileStats?.size ?? 0,
      'file.ctime': note.fileStats?.ctime ?? null,
      'file.mtime': note.fileStats?.mtime ?? null,
      'file.tags': note.tags,
      'file.links': note.links,
      'file.embeds': note.embeds,
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

// ============================================================================
// Phase 13: Summary Functions
// ============================================================================

/**
 * Built-in summary functions for aggregating column values
 */
const summaryFunctions: Record<string, (values: unknown[]) => unknown> = {
  // Number summaries
  Average: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },
  Min: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (nums.length === 0) return null;
    return Math.min(...nums);
  },
  Max: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (nums.length === 0) return null;
    return Math.max(...nums);
  },
  Sum: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    return nums.reduce((a, b) => a + b, 0);
  },
  Range: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (nums.length === 0) return null;
    return Math.max(...nums) - Math.min(...nums);
  },
  Median: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  },
  Stddev: (values) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (nums.length === 0) return null;
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const squareDiffs = nums.map((n) => Math.pow(n - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / nums.length;
    return Math.sqrt(avgSquareDiff);
  },

  // Date summaries
  Earliest: (values) => {
    const dates = values
      .filter((v) => v !== null && v !== undefined)
      .map((v) => (v instanceof Date ? v : new Date(String(v))))
      .filter((d) => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates.map((d) => d.getTime())));
  },
  Latest: (values) => {
    const dates = values
      .filter((v) => v !== null && v !== undefined)
      .map((v) => (v instanceof Date ? v : new Date(String(v))))
      .filter((d) => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  },

  // Boolean summaries
  Checked: (values) => {
    return values.filter((v) => v === true).length;
  },
  Unchecked: (values) => {
    return values.filter((v) => v === false).length;
  },

  // Any type summaries
  Count: (values) => {
    return values.length;
  },
  Empty: (values) => {
    return values.filter((v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)).length;
  },
  Filled: (values) => {
    return values.filter((v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
  },
  Unique: (values) => {
    const stringified = values.map((v) => JSON.stringify(v));
    return new Set(stringified).size;
  },
};

/**
 * Calculates summaries for a given set of rows
 */
function calculateSummaries(
  config: BaseConfig,
  rows: BaseRow[],
  columns: BaseColumn[]
): BaseSummary[] {
  const summaries: BaseSummary[] = [];

  if (!config.summaries) return summaries;

  for (const [columnName, summaryType] of Object.entries(config.summaries)) {
    // Get all values for this column
    const values = rows.map((row) => row.values[columnName]);

    // Check if it's a built-in summary
    const builtInFunc = summaryFunctions[summaryType];
    if (builtInFunc) {
      summaries.push({
        column: columnName,
        type: summaryType,
        value: builtInFunc(values),
      });
    } else {
      // Try to evaluate as a custom expression
      // Custom summaries have access to a 'values' array
      try {
        const result = evaluateExpression(summaryType, {
          values,
          rows,
          columns,
        });
        summaries.push({
          column: columnName,
          type: 'custom',
          value: result,
        });
      } catch {
        summaries.push({
          column: columnName,
          type: summaryType,
          value: null,
        });
      }
    }
  }

  return summaries;
}

/**
 * Applies view-specific filters, sorting, and limits to rows
 */
function applyViewConfig(
  rows: BaseRow[],
  view: BaseView,
  notes: NoteWithFileProperties[]
): BaseRow[] {
  let result = [...rows];

  // Apply view-specific filters
  if (view.filters) {
    const viewConfig: BaseConfig = { filters: view.filters };
    const matchingNoteIndices = new Set<number>();

    notes.forEach((note, idx) => {
      if (evaluateFilters(viewConfig, note)) {
        matchingNoteIndices.add(idx);
      }
    });

    result = result.filter((row) => matchingNoteIndices.has(parseInt(row.id, 10)));
  }

  // Apply sort
  if (view.sort && view.sort.length > 0) {
    result.sort((a, b) => {
      for (const sortConfig of view.sort!) {
        const { property, direction } = sortConfig;
        const aVal = a.values[property];
        const bVal = b.values[property];

        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const isDesc = direction.toUpperCase() === 'DESC';
        const comparison = aVal < bVal ? -1 : 1;
        return isDesc ? -comparison : comparison;
      }
      return 0;
    });
  }

  // Apply groupBy (returns rows grouped, but flattened for simplicity)
  if (view.groupBy) {
    const { property, direction } = view.groupBy;
    result.sort((a, b) => {
      const aVal = a.values[property];
      const bVal = b.values[property];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const isDesc = direction?.toUpperCase() === 'DESC';
      const comparison = aVal < bVal ? -1 : 1;
      return isDesc ? -comparison : comparison;
    });
  }

  // Apply limit
  if (view.limit && view.limit > 0) {
    result = result.slice(0, view.limit);
  }

  return result;
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

  // Phase 13: Calculate summaries
  const summaries = calculateSummaries(config, rows, columns);

  // Phase 14: Process views if present
  const views = config.views?.map((view) => ({
    ...view,
    // Apply view config to get filtered/sorted rows count
    rowCount: applyViewConfig(rows, view, matchingNotes).length,
  }));

  return {
    name,
    path: relativePath,
    columns,
    rows,
    config,
    summaries: summaries.length > 0 ? summaries : undefined,
    views: views as BaseView[] | undefined,
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

/**
 * Phase 14: Queries a base with a specific view applied
 */
export async function queryBaseView(
  vaultPath: string,
  basePath: string,
  viewIndex: number = 0
): Promise<{ rows: BaseRow[]; view: BaseView | null; summaries: BaseSummary[] }> {
  const base = await parseBase(vaultPath, basePath);

  if (!base.config?.views || base.config.views.length === 0) {
    return { rows: base.rows, view: null, summaries: base.summaries || [] };
  }

  const view = base.config.views[viewIndex];
  if (!view) {
    return { rows: base.rows, view: null, summaries: base.summaries || [] };
  }

  // We need to re-scan notes to apply view filters
  const allNotes = await scanNotesInternal(vaultPath);
  const matchingNotes = allNotes.filter((note) => evaluateFilters(base.config!, note));

  const rows = applyViewConfig(base.rows, view, matchingNotes);

  // Calculate view-specific summaries if defined
  let summaries = base.summaries || [];
  if (view.summaries) {
    const viewConfig: BaseConfig = { summaries: view.summaries };
    summaries = calculateSummaries(viewConfig, rows, base.columns);
  }

  return { rows, view, summaries };
}

/**
 * Internal function to scan notes (avoids exporting implementation details)
 */
async function scanNotesInternal(vaultPath: string): Promise<NoteWithFileProperties[]> {
  return scanNotes(vaultPath);
}

/**
 * Phase 13: Export summary functions for direct use
 */
export function calculateColumnSummary(
  values: unknown[],
  summaryType: string
): unknown {
  const func = summaryFunctions[summaryType];
  return func ? func(values) : null;
}

/**
 * Phase 13: Get available summary types
 */
export function getAvailableSummaryTypes(): string[] {
  return Object.keys(summaryFunctions);
}
