/**
 * Search service for Obsidian vaults
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath, isMarkdownFile, shouldIgnorePath, getRelativePath } from '../utils/path.js';
import type { SearchResult, SearchMatch } from '../types/index.js';

export interface SearchOptions {
  caseSensitive?: boolean;
  folder?: string;
  maxResults?: number;
  includeLineNumbers?: boolean;
  useRegex?: boolean;
  contextLines?: number;
}

/**
 * Searches for text in all notes in a vault
 */
export async function searchVault(
  vaultPath: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    caseSensitive = false,
    folder,
    maxResults = 100,
    includeLineNumbers = true,
    useRegex = false,
    contextLines = 0,
  } = options;

  const targetPath = folder ? validatePath(folder, vaultPath) : vaultPath;
  const results: SearchResult[] = [];

  // Build the search pattern
  let searchRegex: RegExp;
  try {
    if (useRegex) {
      const flags = caseSensitive ? 'g' : 'gi';
      searchRegex = new RegExp(query, flags);
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      searchRegex = new RegExp(escapedQuery, flags);
    }
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${(error as Error).message}`);
  }

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

        // Reset regex lastIndex for each file
        searchRegex.lastIndex = 0;

        if (searchRegex.test(content)) {
          // Reset again after test
          searchRegex.lastIndex = 0;

          const lines = content.split('\n');
          const matchesWithContext: SearchMatch[] = [];
          const simpleMatches: string[] = [];
          const lineNumbers: number[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            searchRegex.lastIndex = 0;

            if (searchRegex.test(line)) {
              if (contextLines > 0) {
                // Build context
                const contextBefore: string[] = [];
                const contextAfter: string[] = [];

                for (let j = Math.max(0, i - contextLines); j < i; j++) {
                  const ctxLine = lines[j];
                  contextBefore.push(ctxLine.length > 200 ? ctxLine.substring(0, 200) + '...' : ctxLine);
                }

                for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextLines); j++) {
                  const ctxLine = lines[j];
                  contextAfter.push(ctxLine.length > 200 ? ctxLine.substring(0, 200) + '...' : ctxLine);
                }

                const trimmedLine = line.length > 200 ? line.substring(0, 200) + '...' : line;
                matchesWithContext.push({
                  line: trimmedLine.trim(),
                  lineNumber: i + 1,
                  contextBefore: contextBefore.length > 0 ? contextBefore : undefined,
                  contextAfter: contextAfter.length > 0 ? contextAfter : undefined,
                });
              } else {
                // Simple match without context
                const trimmedLine = line.length > 200 ? line.substring(0, 200) + '...' : line;
                simpleMatches.push(trimmedLine.trim());
                lineNumbers.push(i + 1);
              }

              // Limit matches per file
              if ((contextLines > 0 ? matchesWithContext.length : simpleMatches.length) >= 10) break;
            }
          }

          const hasMatches = contextLines > 0 ? matchesWithContext.length > 0 : simpleMatches.length > 0;

          if (hasMatches) {
            const result: SearchResult = {
              path: relativePath,
              matches: contextLines > 0 ? matchesWithContext : simpleMatches,
            };

            if (includeLineNumbers && contextLines === 0) {
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
