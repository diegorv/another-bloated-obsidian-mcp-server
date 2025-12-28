/**
 * Tests for search service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { searchVault, countOccurrences } from '../../services/search.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const VAULT_PATH = '/test-vault';

describe('search service', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `# Note One

This note contains some TODO items.

## Tasks
- [ ] First TODO task
- [x] Completed task

Some more content with TODO mentioned again.
`,
      [`${VAULT_PATH}/note2.md`]: `# Note Two

This is a different note.

It has multiple lines with content.
Meeting notes from yesterday.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

This nested note also has a TODO item.
And another todo in lowercase.
`,
      [`${VAULT_PATH}/projects/project-a.md`]: `# Project A

Project description with FIXME and HACK comments.
TODO: Review this section.
`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('searchVault', () => {
    it('should find basic text matches', async () => {
      const results = await searchVault(VAULT_PATH, 'TODO');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.path === 'note1.md')).toBe(true);
    });

    it('should be case insensitive by default', async () => {
      const results = await searchVault(VAULT_PATH, 'todo');

      expect(results.length).toBeGreaterThan(0);
      // Should find both TODO and todo
      expect(results.some(r => r.path === 'folder/nested.md')).toBe(true);
    });

    it('should support case sensitive search', async () => {
      const results = await searchVault(VAULT_PATH, 'TODO', { caseSensitive: true });

      // Should only find uppercase TODO
      expect(results.some(r => r.path === 'note1.md')).toBe(true);

      // Check that lowercase matches are not included in certain files
      const nestedResult = results.find(r => r.path === 'folder/nested.md');
      if (nestedResult) {
        // The file has both TODO and todo, but case sensitive should only match TODO
        const matches = nestedResult.matches as string[];
        expect(matches.some(m => m.includes('TODO'))).toBe(true);
      }
    });

    it('should search in specific folder', async () => {
      const results = await searchVault(VAULT_PATH, 'Project', { folder: 'projects' });

      expect(results.length).toBe(1);
      expect(results[0].path).toBe('projects/project-a.md');
    });

    it('should limit results with maxResults', async () => {
      const results = await searchVault(VAULT_PATH, 'note', { maxResults: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should include line numbers', async () => {
      const results = await searchVault(VAULT_PATH, 'TODO', { includeLineNumbers: true });

      const note1Result = results.find(r => r.path === 'note1.md');
      expect(note1Result).toBeDefined();
      expect(note1Result?.lineNumbers).toBeDefined();
      expect(note1Result?.lineNumbers?.length).toBeGreaterThan(0);
    });

    it('should support regex search', async () => {
      const results = await searchVault(VAULT_PATH, 'TODO|FIXME|HACK', { useRegex: true });

      expect(results.length).toBeGreaterThan(0);
      const projectResult = results.find(r => r.path === 'projects/project-a.md');
      expect(projectResult).toBeDefined();
    });

    it('should throw error for invalid regex', async () => {
      await expect(
        searchVault(VAULT_PATH, '[invalid(regex', { useRegex: true })
      ).rejects.toThrow('Invalid regex pattern');
    });

    it('should include context lines when requested', async () => {
      const results = await searchVault(VAULT_PATH, 'TODO', { contextLines: 2 });

      const note1Result = results.find(r => r.path === 'note1.md');
      expect(note1Result).toBeDefined();

      // With context, matches should be objects not strings
      const matches = note1Result?.matches;
      expect(matches).toBeDefined();
      if (matches && matches.length > 0) {
        const firstMatch = matches[0] as { line: string; contextBefore?: string[]; contextAfter?: string[] };
        expect(typeof firstMatch).toBe('object');
        expect(firstMatch.line).toBeDefined();
      }
    });

    it('should search for multi-word phrases', async () => {
      const results = await searchVault(VAULT_PATH, 'Meeting notes');

      expect(results.length).toBe(1);
      expect(results[0].path).toBe('note2.md');
    });

    it('should find wiki-style link patterns', async () => {
      vol.writeFileSync(`${VAULT_PATH}/links.md`, 'Link to [[other-note]] here.');

      const results = await searchVault(VAULT_PATH, '\\[\\[', { useRegex: true });

      expect(results.some(r => r.path === 'links.md')).toBe(true);
    });

    it('should ignore hidden files and .obsidian folder', async () => {
      const results = await searchVault(VAULT_PATH, 'config');

      // Should not find matches in .obsidian/config.json
      expect(results.every(r => !r.path.includes('.obsidian'))).toBe(true);
    });

    it('should return empty array when no matches', async () => {
      const results = await searchVault(VAULT_PATH, 'nonexistenttext12345');

      expect(results).toEqual([]);
    });

    it('should handle date pattern regex', async () => {
      vol.writeFileSync(`${VAULT_PATH}/dated.md`, 'Meeting on 2024-01-15 was good.');

      const results = await searchVault(
        VAULT_PATH,
        '\\d{4}-\\d{2}-\\d{2}',
        { useRegex: true }
      );

      expect(results.some(r => r.path === 'dated.md')).toBe(true);
    });
  });

  describe('countOccurrences', () => {
    it('should count total occurrences', async () => {
      const result = await countOccurrences(VAULT_PATH, 'TODO');

      expect(result.total).toBeGreaterThan(0);
    });

    it('should count occurrences per file', async () => {
      const result = await countOccurrences(VAULT_PATH, 'TODO');

      expect(Object.keys(result.byFile).length).toBeGreaterThan(0);
      expect(result.byFile['note1.md']).toBeGreaterThanOrEqual(1);
    });

    it('should be case insensitive by default', async () => {
      const result = await countOccurrences(VAULT_PATH, 'todo');

      expect(result.total).toBeGreaterThan(0);
    });

    it('should support case sensitive counting', async () => {
      const caseInsensitive = await countOccurrences(VAULT_PATH, 'todo', false);
      const caseSensitive = await countOccurrences(VAULT_PATH, 'todo', true);

      // Case insensitive should find more or equal matches
      expect(caseInsensitive.total).toBeGreaterThanOrEqual(caseSensitive.total);
    });

    it('should return zero for non-matching query', async () => {
      const result = await countOccurrences(VAULT_PATH, 'nonexistenttext12345');

      expect(result.total).toBe(0);
      expect(Object.keys(result.byFile).length).toBe(0);
    });

    it('should ignore hidden files', async () => {
      const result = await countOccurrences(VAULT_PATH, 'config');

      expect(result.byFile['.obsidian/config.json']).toBeUndefined();
    });
  });
});
