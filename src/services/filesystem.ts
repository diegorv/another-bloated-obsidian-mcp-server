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
import type { NoteInfo, NoteContent, UpdateMode, ReplaceOptions, ListNotesOptions } from '../types/index.js';
import matter from 'gray-matter';

/**
 * Lists all markdown files in a directory with advanced options
 */
export async function listNotes(
  vaultPath: string,
  options: ListNotesOptions = {}
): Promise<{ notes: NoteInfo[]; total: number }> {
  const {
    folder,
    recursive = true,
    sortBy = 'modified',
    sortOrder = 'desc',
    limit,
    offset = 0,
    namePattern,
  } = options;

  const targetPath = folder ? validatePath(folder, vaultPath) : vaultPath;
  const notes: NoteInfo[] = [];

  // Compile name pattern regex if provided
  let nameRegex: RegExp | null = null;
  if (namePattern) {
    try {
      nameRegex = new RegExp(namePattern, 'i');
    } catch {
      throw new Error(`Invalid name pattern regex: ${namePattern}`);
    }
  }

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
        const noteName = path.basename(entry.name, path.extname(entry.name));

        // Apply name pattern filter
        if (nameRegex && !nameRegex.test(noteName)) {
          continue;
        }

        const stats = await fs.stat(fullPath);
        notes.push({
          path: relativePath,
          name: noteName,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString(),
          size: stats.size,
        });
      }
    }
  }

  await scanDir(targetPath);

  // Sort notes
  notes.sort((a, b) => {
    let compareResult: number;

    switch (sortBy) {
      case 'name':
        compareResult = a.name.localeCompare(b.name);
        break;
      case 'created':
        compareResult = new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime();
        break;
      case 'modified':
      default:
        compareResult = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        break;
    }

    return sortOrder === 'desc' ? -compareResult : compareResult;
  });

  const total = notes.length;

  // Apply pagination
  const paginatedNotes = limit !== undefined
    ? notes.slice(offset, offset + limit)
    : notes.slice(offset);

  return { notes: paginatedNotes, total };
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
 * Renames a note and optionally updates internal links
 * @returns Number of links updated in other notes
 */
export async function renameNote(
  vaultPath: string,
  oldPath: string,
  newPath: string,
  updateLinks = true
): Promise<number> {
  const oldFullPath = validatePath(ensureMarkdownExtension(oldPath), vaultPath);
  const newFullPath = validatePath(ensureMarkdownExtension(newPath), vaultPath);

  // Check if source note exists
  try {
    await fs.access(oldFullPath);
  } catch {
    throw new NoteNotFoundError(oldPath);
  }

  // Check if destination already exists
  try {
    await fs.access(newFullPath);
    throw new NoteAlreadyExistsError(newPath);
  } catch (error) {
    if (error instanceof NoteAlreadyExistsError) {
      throw error;
    }
    // ENOENT is expected - destination should not exist
  }

  // Ensure parent directory of destination exists
  await fs.mkdir(path.dirname(newFullPath), { recursive: true });

  // Rename the file
  await fs.rename(oldFullPath, newFullPath);

  // Update internal links if requested
  let linksUpdated = 0;
  if (updateLinks) {
    linksUpdated = await updateInternalLinks(vaultPath, oldPath, newPath);
  }

  return linksUpdated;
}

/**
 * Moves a note to a different folder
 * @returns Number of links updated in other notes
 */
export async function moveNote(
  vaultPath: string,
  notePath: string,
  destinationFolder: string,
  updateLinks = true
): Promise<{ newPath: string; linksUpdated: number }> {
  // Construct the new path by combining destination folder with the file name
  const fileName = path.basename(ensureMarkdownExtension(notePath));
  const newPath = destinationFolder ? path.join(destinationFolder, fileName) : fileName;

  // Use renameNote to do the actual move
  const linksUpdated = await renameNote(vaultPath, notePath, newPath, updateLinks);

  return {
    newPath: getRelativePath(validatePath(ensureMarkdownExtension(newPath), vaultPath), vaultPath),
    linksUpdated,
  };
}

/**
 * Updates internal wikilinks in all notes that reference the old path
 */
async function updateInternalLinks(
  vaultPath: string,
  oldPath: string,
  newPath: string
): Promise<number> {
  const { notes } = await listNotes(vaultPath, { recursive: true });
  let totalUpdated = 0;

  // Get the note names without extension for wikilink matching
  const oldName = path.basename(oldPath, '.md');
  const newName = path.basename(newPath, '.md');
  const oldPathWithoutExt = oldPath.replace(/\.md$/, '');
  const newPathWithoutExt = newPath.replace(/\.md$/, '');

  for (const note of notes) {
    const notePath = note.path;
    const fullPath = validatePath(notePath, vaultPath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      let newContent = content;
      let updated = false;

      // Match wikilinks: [[note]] or [[note|alias]] or [[path/to/note]] or [[path/to/note|alias]]
      // Also handle links with full path
      const wikiLinkPatterns = [
        // Exact match for full path (without extension)
        new RegExp(`\\[\\[${escapeRegex(oldPathWithoutExt)}(\\|[^\\]]*)?\\]\\]`, 'g'),
        // Match just the note name (for notes in same folder or when path is omitted)
        new RegExp(`\\[\\[${escapeRegex(oldName)}(\\|[^\\]]*)?\\]\\]`, 'g'),
      ];

      for (const pattern of wikiLinkPatterns) {
        if (pattern.test(newContent)) {
          // Replace with appropriate new reference
          newContent = newContent.replace(pattern, (match, alias) => {
            if (match.includes('/')) {
              // Full path link
              return `[[${newPathWithoutExt}${alias || ''}]]`;
            } else {
              // Simple name link
              return `[[${newName}${alias || ''}]]`;
            }
          });
          updated = true;
        }
      }

      if (updated && newContent !== content) {
        await fs.writeFile(fullPath, newContent, 'utf-8');
        totalUpdated++;
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return totalUpdated;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
