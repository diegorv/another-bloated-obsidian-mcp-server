/**
 * Safe filesystem operations for Obsidian vaults
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  validatePath,
  getRelativePath,
  isMarkdownFile,
  shouldIgnorePath,
  ensureMarkdownExtension,
} from '../utils/path.js';
import { NoteNotFoundError, NoteAlreadyExistsError, FrontmatterConflictError } from '../utils/errors.js';
import type { NoteInfo, NoteContent, UpdateMode, ReplaceOptions } from '../types/index.js';
import matter from 'gray-matter';

/**
 * Lists all markdown files in a directory
 */
export async function listNotes(
  vaultPath: string,
  folder?: string,
  recursive = true
): Promise<NoteInfo[]> {
  const targetPath = folder ? validatePath(folder, vaultPath) : vaultPath;
  const notes: NoteInfo[] = [];

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) {
        continue;
      }

      if (entry.isDirectory() && recursive) {
        await scanDir(fullPath);
      } else if (entry.isFile() && isMarkdownFile(entry.name)) {
        const stats = await fs.stat(fullPath);
        notes.push({
          path: relativePath,
          name: path.basename(entry.name, path.extname(entry.name)),
          modified: stats.mtime.toISOString(),
        });
      }
    }
  }

  await scanDir(targetPath);

  // Sort by modification time (newest first)
  notes.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

  return notes;
}

/**
 * Reads a note's content and frontmatter
 */
export async function readNote(vaultPath: string, notePath: string): Promise<NoteContent> {
  const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(content);

    return {
      content: parsed.content,
      frontmatter: Object.keys(parsed.data).length > 0 ? parsed.data : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NoteNotFoundError(notePath);
    }
    throw error;
  }
}

/**
 * Creates a new note
 */
export async function createNote(
  vaultPath: string,
  notePath: string,
  content: string,
  frontmatter?: Record<string, unknown>
): Promise<string> {
  const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);

  // Check if note already exists
  try {
    await fs.access(fullPath);
    throw new NoteAlreadyExistsError(notePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (error instanceof NoteAlreadyExistsError) {
        throw error;
      }
      throw error;
    }
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Build content with frontmatter if provided
  let fileContent = content;
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    fileContent = matter.stringify(content, frontmatter);
  }

  await fs.writeFile(fullPath, fileContent, 'utf-8');

  return getRelativePath(fullPath, vaultPath);
}

export interface UpdateOptions {
  replaceOptions?: ReplaceOptions;
  ignoreFrontmatterConflict?: boolean;
}

/**
 * Checks if content could be interpreted as frontmatter
 */
function couldConflictWithFrontmatter(content: string): boolean {
  // Check if content starts with --- (frontmatter delimiter)
  return content.trimStart().startsWith('---');
}

/**
 * Checks if file has existing frontmatter
 */
function hasExistingFrontmatter(content: string): boolean {
  return content.trimStart().startsWith('---');
}

/**
 * Updates an existing note
 * @returns Number of replacements made (only for 'replace' mode)
 */
export async function updateNote(
  vaultPath: string,
  notePath: string,
  content: string,
  mode: UpdateMode = 'overwrite',
  options?: UpdateOptions
): Promise<number> {
  const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);

  // Check if note exists
  try {
    await fs.access(fullPath);
  } catch {
    throw new NoteNotFoundError(notePath);
  }

  if (mode === 'overwrite') {
    await fs.writeFile(fullPath, content, 'utf-8');
    return 0;
  }

  const existing = await fs.readFile(fullPath, 'utf-8');

  if (mode === 'append') {
    await fs.writeFile(fullPath, existing + '\n' + content, 'utf-8');
    return 0;
  }

  if (mode === 'prepend') {
    // Check for potential frontmatter conflict
    if (
      !options?.ignoreFrontmatterConflict &&
      couldConflictWithFrontmatter(content) &&
      hasExistingFrontmatter(existing)
    ) {
      throw new FrontmatterConflictError(notePath);
    }

    await fs.writeFile(fullPath, content + '\n' + existing, 'utf-8');
    return 0;
  }

  // Replace mode
  if (mode === 'replace' && options?.replaceOptions) {
    const replaceOpts = options.replaceOptions;
    let searchPattern: string | RegExp;

    if (replaceOpts.useRegex) {
      const flags = replaceOpts.replaceAll ? 'g' : '';
      searchPattern = new RegExp(replaceOpts.search, flags);
    } else {
      // Escape special regex characters for literal search
      const escaped = replaceOpts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = replaceOpts.replaceAll ? 'g' : '';
      searchPattern = new RegExp(escaped, flags);
    }

    // Count replacements
    const matches = existing.match(
      replaceOpts.useRegex
        ? new RegExp(replaceOpts.search, 'g')
        : new RegExp(replaceOpts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    );
    const replacementCount = replaceOpts.replaceAll
      ? (matches?.length || 0)
      : (matches && matches.length > 0 ? 1 : 0);

    const newContent = existing.replace(searchPattern, content);
    await fs.writeFile(fullPath, newContent, 'utf-8');
    return replacementCount;
  }

  return 0;
}

/**
 * Deletes a note
 */
export async function deleteNote(vaultPath: string, notePath: string): Promise<void> {
  const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);

  try {
    await fs.unlink(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NoteNotFoundError(notePath);
    }
    throw error;
  }
}

/**
 * Checks if a note exists
 */
export async function noteExists(vaultPath: string, notePath: string): Promise<boolean> {
  const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);

  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets file stats for a note
 */
export async function getNoteStats(
  vaultPath: string,
  notePath: string
): Promise<{ created: string; modified: string; size: number }> {
  const fullPath = validatePath(ensureMarkdownExtension(notePath), vaultPath);

  try {
    const stats = await fs.stat(fullPath);
    return {
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      size: stats.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NoteNotFoundError(notePath);
    }
    throw error;
  }
}
