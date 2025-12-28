/**
 * Path validation and sanitization utilities
 */

import path from 'node:path';
import { PathTraversalError, InvalidPathError } from './errors.js';

/**
 * Validates that a path is safe (no path traversal attacks)
 * and normalizes it
 */
export function validatePath(inputPath: string, basePath: string): string {
  // Normalize the input path
  const normalizedInput = path.normalize(inputPath);

  // Resolve to absolute path within base
  const fullPath = path.resolve(basePath, normalizedInput);

  // Ensure the resolved path is within the base path
  const normalizedBase = path.normalize(basePath);
  if (!fullPath.startsWith(normalizedBase + path.sep) && fullPath !== normalizedBase) {
    throw new PathTraversalError(inputPath);
  }

  return fullPath;
}

/**
 * Gets the relative path from a base path
 */
export function getRelativePath(fullPath: string, basePath: string): string {
  return path.relative(basePath, fullPath);
}

/**
 * Ensures a path has .md extension
 */
export function ensureMarkdownExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown') {
    return filePath;
  }
  if (ext === '') {
    return `${filePath}.md`;
  }
  return filePath;
}

/**
 * Checks if a file is a markdown file
 */
export function isMarkdownFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

/**
 * Extracts the note name from a path (without extension)
 */
export function getNoteName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Validates that a note name is valid
 */
export function validateNoteName(name: string): void {
  if (!name || name.trim() === '') {
    throw new InvalidPathError(name, 'Note name cannot be empty');
  }

  // Check for invalid characters
  const invalidChars = /[<>:"|?*\\]/;
  if (invalidChars.test(name)) {
    throw new InvalidPathError(name, 'Note name contains invalid characters');
  }

  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(name)) {
    throw new InvalidPathError(name, 'Note name is a reserved system name');
  }
}

/**
 * Checks if a path should be ignored (hidden files, system folders)
 */
export function shouldIgnorePath(filePath: string): boolean {
  const parts = filePath.split(path.sep);

  // Ignore hidden files and folders (starting with .)
  if (parts.some(part => part.startsWith('.'))) {
    return true;
  }

  // Ignore common non-note folders
  const ignoredFolders = ['node_modules', '.git', '.obsidian', '.trash'];
  if (parts.some(part => ignoredFolders.includes(part))) {
    return true;
  }

  return false;
}
