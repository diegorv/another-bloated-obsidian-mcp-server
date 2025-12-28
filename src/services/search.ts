/**
 * Search service for Obsidian vaults
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath, isMarkdownFile, shouldIgnorePath, getRelativePath } from '../utils/path.js';
import type { SearchResult } from '../types/index.js';

/**
 * Searches for text in all notes in a vault
 */
export async function searchVault(
  vaultPath: string,
  query: string,
  options: {
    caseSensitive?: boolean;
    folder?: string;
    maxResults?: number;
    includeLineNumbers?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const { caseSensitive = false, folder, maxResults = 100, includeLineNumbers = true } = options;

  const targetPath = folder ? validatePath(folder, vaultPath) : vaultPath;
  const results: SearchResult[] = [];

  const searchPattern = caseSensitive ? query : query.toLowerCase();

  async function searchDir(dirPath: string): Promise<void> {
    if (results.length >= maxResults) return;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await searchDir(fullPath);
      } else if (entry.isFile() && isMarkdownFile(entry.name)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const searchContent = caseSensitive ? content : content.toLowerCase();

        if (searchContent.includes(searchPattern)) {
          const matches: string[] = [];
          const lineNumbers: number[] = [];
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const searchLine = caseSensitive ? line : line.toLowerCase();

            if (searchLine.includes(searchPattern)) {
              // Trim long lines and add context
              const trimmedLine =
                line.length > 200 ? line.substring(0, 200) + '...' : line;
              matches.push(trimmedLine.trim());
              lineNumbers.push(i + 1);

              // Limit matches per file
              if (matches.length >= 10) break;
            }
          }

          if (matches.length > 0) {
            const result: SearchResult = {
              path: relativePath,
              matches,
            };

            if (includeLineNumbers) {
              result.lineNumbers = lineNumbers;
            }

            results.push(result);
          }
        }
      }
    }
  }

  await searchDir(targetPath);

  return results;
}

/**
 * Counts occurrences of a pattern in a vault
 */
export async function countOccurrences(
  vaultPath: string,
  query: string,
  caseSensitive = false
): Promise<{ total: number; byFile: Record<string, number> }> {
  const byFile: Record<string, number> = {};
  let total = 0;

  const searchPattern = caseSensitive ? query : query.toLowerCase();

  async function countInDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await countInDir(fullPath);
      } else if (entry.isFile() && isMarkdownFile(entry.name)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const searchContent = caseSensitive ? content : content.toLowerCase();

        let count = 0;
        let pos = 0;

        while ((pos = searchContent.indexOf(searchPattern, pos)) !== -1) {
          count++;
          pos += searchPattern.length;
        }

        if (count > 0) {
          byFile[relativePath] = count;
          total += count;
        }
      }
    }
  }

  await countInDir(vaultPath);

  return { total, byFile };
}
