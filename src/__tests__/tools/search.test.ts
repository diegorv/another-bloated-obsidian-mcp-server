/**
 * Tests for search tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleSearchVault,
  searchVaultSchema,
  searchTools,
} from '../../tools/search.js';
import { clearActiveVault } from '../../services/vault-manager.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

// Mock config
vi.mock('../../config.js', async () => {
  return {
    loadConfig: () => Promise.resolve({
      vaults: { default: '/test-vault' },
      defaultVault: 'default',
    }),
    getVaults: () => Promise.resolve({ default: '/test-vault' }),
    getDefaultVault: () => Promise.resolve('default'),
    setDefaultVault: vi.fn(),
    addVault: vi.fn(),
    getVaultPath: () => Promise.resolve('/test-vault'),
  };
});

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const VAULT_PATH = '/test-vault';

describe('search tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `---
title: First Note
tags:
  - javascript
  - testing
---

# First Note

This is a note about JavaScript testing.
We use Vitest for unit tests.
`,
      [`${VAULT_PATH}/note2.md`]: `# Second Note

A note about Python programming.
Python is great for data science.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

JavaScript can also be used for data science.
Node.js makes it possible.
`,
      [`${VAULT_PATH}/folder/deep/deeper.md`]: `# Deep Note

More content about testing frameworks.
Jest and Vitest are popular choices.
`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('searchVaultSchema', () => {
    it('should require query parameter', () => {
      expect(() => searchVaultSchema.parse({ query: 'test' })).not.toThrow();
      expect(() => searchVaultSchema.parse({})).toThrow();
    });

    it('should accept optional parameters', () => {
      expect(() => searchVaultSchema.parse({
        query: 'test',
        caseSensitive: true,
        folder: 'notes',
        maxResults: 100,
        useRegex: true,
        contextLines: 2,
      })).not.toThrow();
    });

    it('should have correct default values', () => {
      const parsed = searchVaultSchema.parse({ query: 'test' });
      expect(parsed.caseSensitive).toBe(false);
      expect(parsed.maxResults).toBe(50);
      expect(parsed.useRegex).toBe(false);
      expect(parsed.contextLines).toBe(0);
    });
  });

  describe('searchTools', () => {
    it('should define search_vault tool', () => {
      expect(searchTools.length).toBe(1);
      const tool = searchTools[0];
      expect(tool.name).toBe('search_vault');
      expect(tool.description).toContain('Search');
      expect(tool.inputSchema.required).toContain('query');
    });
  });

  describe('handleSearchVault', () => {
    it('should find text matches', async () => {
      const result = await handleSearchVault({
        query: 'JavaScript',
        caseSensitive: false,
        maxResults: 50,
        useRegex: false,
        contextLines: 0,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.query).toBe('JavaScript');
      expect(data.resultCount).toBeGreaterThan(0);
    });

    it('should be case insensitive by default', async () => {
      const result = await handleSearchVault({
        query: 'javascript',
        caseSensitive: false,
        maxResults: 50,
        useRegex: false,
        contextLines: 0,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBeGreaterThan(0);
    });

    it('should support case sensitive search', async () => {
      const result = await handleSearchVault({
        query: 'javascript',
        caseSensitive: true,
        maxResults: 50,
        useRegex: false,
        contextLines: 0,
      });

      const data = JSON.parse(result.content[0].text);
      // 'JavaScript' should not match 'javascript' case-sensitive
      // Only note1.md has lowercase 'javascript' in tags
      expect(data.resultCount).toBeLessThanOrEqual(1);
    });

    it('should search in specific folder', async () => {
      const result = await handleSearchVault({
        query: 'JavaScript',
        caseSensitive: false,
        folder: 'folder',
        maxResults: 50,
        useRegex: false,
        contextLines: 0,
      });

      const data = JSON.parse(result.content[0].text);
      // Only nested.md in folder/ mentions JavaScript
      expect(data.resultCount).toBe(1);
      expect(data.results[0].path).toContain('nested.md');
    });

    it('should limit results', async () => {
      const result = await handleSearchVault({
        query: 'Note',
        caseSensitive: false,
        maxResults: 2,
        useRegex: false,
        contextLines: 0,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBeLessThanOrEqual(2);
    });

    it('should support regex search', async () => {
      const result = await handleSearchVault({
        query: 'Java.*testing',
        caseSensitive: false,
        maxResults: 50,
        useRegex: true,
        contextLines: 0,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBeGreaterThan(0);
    });

    it('should include context lines when requested', async () => {
      const result = await handleSearchVault({
        query: 'Vitest',
        caseSensitive: false,
        maxResults: 50,
        useRegex: false,
        contextLines: 1,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBeGreaterThan(0);
      // Context lines should be included in matches (as objects with contextBefore/contextAfter)
      if (data.results.length > 0 && data.results[0].matches?.length > 0) {
        const match = data.results[0].matches[0];
        // When contextLines > 0, matches are objects with line, lineNumber, contextBefore, contextAfter
        expect(typeof match).toBe('object');
        expect(match.line).toBeDefined();
        expect(match.lineNumber).toBeDefined();
      }
    });

    it('should return empty results for no matches', async () => {
      const result = await handleSearchVault({
        query: 'nonexistentterm',
        caseSensitive: false,
        maxResults: 50,
        useRegex: false,
        contextLines: 0,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBe(0);
      expect(data.results).toEqual([]);
    });

    it('should handle regex errors gracefully', async () => {
      const result = await handleSearchVault({
        query: '[invalid(regex',
        caseSensitive: false,
        maxResults: 50,
        useRegex: true,
        contextLines: 0,
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeDefined();
    });
  });
});
