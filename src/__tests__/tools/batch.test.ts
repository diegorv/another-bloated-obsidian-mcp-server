/**
 * Tests for batch tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleBatchMove,
  handleBatchDelete,
  handleBatchUpdateFrontmatter,
  handleBatchAddTag,
  handleBatchRemoveTag,
  handleBatchRead,
  batchMoveSchema,
  batchDeleteSchema,
  batchUpdateFrontmatterSchema,
  batchAddTagSchema,
  batchRemoveTagSchema,
  batchReadSchema,
  batchTools,
} from '../../tools/batch.js';
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

describe('batch tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `---
title: Note 1
tags:
  - existing
---

# Note 1
`,
      [`${VAULT_PATH}/note2.md`]: `---
title: Note 2
status: draft
---

# Note 2
`,
      [`${VAULT_PATH}/note3.md`]: `# Note 3

No frontmatter.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `---
tags:
  - nested
---

# Nested Note
`,
      [`${VAULT_PATH}/archive/`]: null,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('batchMoveSchema should require paths and destinationFolder', () => {
      expect(() => batchMoveSchema.parse({
        paths: ['note1.md'],
        destinationFolder: 'archive',
      })).not.toThrow();
      expect(() => batchMoveSchema.parse({ paths: ['note1.md'] })).toThrow();
      expect(() => batchMoveSchema.parse({ destinationFolder: 'archive' })).toThrow();
    });

    it('batchMoveSchema should have updateLinks default true', () => {
      const parsed = batchMoveSchema.parse({
        paths: ['note1.md'],
        destinationFolder: 'archive',
      });
      expect(parsed.updateLinks).toBe(true);
    });

    it('batchDeleteSchema should require paths and confirm', () => {
      expect(() => batchDeleteSchema.parse({
        paths: ['note1.md'],
        confirm: true,
      })).not.toThrow();
      expect(() => batchDeleteSchema.parse({ paths: ['note1.md'] })).toThrow();
    });

    it('batchUpdateFrontmatterSchema should require paths and updates', () => {
      expect(() => batchUpdateFrontmatterSchema.parse({
        paths: ['note1.md'],
        updates: { status: 'done' },
      })).not.toThrow();
      expect(() => batchUpdateFrontmatterSchema.parse({ paths: ['note1.md'] })).toThrow();
    });

    it('batchUpdateFrontmatterSchema should have replace default false', () => {
      const parsed = batchUpdateFrontmatterSchema.parse({
        paths: ['note1.md'],
        updates: {},
      });
      expect(parsed.replace).toBe(false);
    });

    it('batchAddTagSchema should require paths and tags', () => {
      expect(() => batchAddTagSchema.parse({
        paths: ['note1.md'],
        tags: ['new-tag'],
      })).not.toThrow();
      expect(() => batchAddTagSchema.parse({ paths: ['note1.md'] })).toThrow();
    });

    it('batchRemoveTagSchema should require paths and tags', () => {
      expect(() => batchRemoveTagSchema.parse({
        paths: ['note1.md'],
        tags: ['tag'],
      })).not.toThrow();
      expect(() => batchRemoveTagSchema.parse({ paths: ['note1.md'] })).toThrow();
    });

    it('batchReadSchema should require paths', () => {
      expect(() => batchReadSchema.parse({
        paths: ['note1.md'],
      })).not.toThrow();
      expect(() => batchReadSchema.parse({})).toThrow();
    });

    it('batchReadSchema should have defaults for include options', () => {
      const parsed = batchReadSchema.parse({ paths: ['note1.md'] });
      expect(parsed.includeContent).toBe(true);
      expect(parsed.includeFrontmatter).toBe(true);
    });

    it('batchReadSchema should enforce max 10 paths', () => {
      const paths = Array.from({ length: 11 }, (_, i) => `note${i}.md`);
      expect(() => batchReadSchema.parse({ paths })).toThrow();
    });
  });

  describe('batchTools', () => {
    it('should define 6 batch tools', () => {
      expect(batchTools.length).toBe(6);
      const names = batchTools.map(t => t.name);
      expect(names).toContain('batch_move');
      expect(names).toContain('batch_delete');
      expect(names).toContain('batch_update_frontmatter');
      expect(names).toContain('batch_add_tag');
      expect(names).toContain('batch_remove_tag');
      expect(names).toContain('batch_read_notes');
    });
  });

  describe('handleBatchMove', () => {
    it('should move multiple notes', async () => {
      const result = await handleBatchMove({
        paths: ['note1.md', 'note2.md'],
        destinationFolder: 'archive',
        updateLinks: false,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(2);
      expect(data.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      const result = await handleBatchMove({
        paths: ['note1.md', 'nonexistent.md'],
        destinationFolder: 'archive',
        updateLinks: false,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.failed).toBe(1);
      expect(data.success).toBe(false);
    });

    it('should include per-note results', async () => {
      const result = await handleBatchMove({
        paths: ['note1.md'],
        destinationFolder: 'archive',
        updateLinks: false,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results.length).toBe(1);
      expect(data.results[0].path).toBe('note1.md');
      expect(data.results[0].success).toBe(true);
    });
  });

  describe('handleBatchDelete', () => {
    it('should require confirmation', async () => {
      const result = await handleBatchDelete({
        paths: ['note1.md'],
        confirm: false,
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('Confirmation');
    });

    it('should delete multiple notes with confirmation', async () => {
      const result = await handleBatchDelete({
        paths: ['note1.md', 'note2.md'],
        confirm: true,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(2);
      expect(data.failed).toBe(0);

      // Verify files are deleted
      expect(() => vol.readFileSync(`${VAULT_PATH}/note1.md`)).toThrow();
      expect(() => vol.readFileSync(`${VAULT_PATH}/note2.md`)).toThrow();
    });

    it('should handle partial failures', async () => {
      const result = await handleBatchDelete({
        paths: ['note1.md', 'nonexistent.md'],
        confirm: true,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.failed).toBe(1);
    });
  });

  describe('handleBatchUpdateFrontmatter', () => {
    it('should update frontmatter of multiple notes', async () => {
      const result = await handleBatchUpdateFrontmatter({
        paths: ['note1.md', 'note2.md'],
        updates: { status: 'published' },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(2);
    });

    it('should merge frontmatter by default', async () => {
      const result = await handleBatchUpdateFrontmatter({
        paths: ['note1.md'],
        updates: { newField: 'value' },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].details.frontmatter.title).toBe('Note 1');
      expect(data.results[0].details.frontmatter.newField).toBe('value');
    });

    it('should replace frontmatter when replace=true', async () => {
      const result = await handleBatchUpdateFrontmatter({
        paths: ['note1.md'],
        updates: { newField: 'only this' },
        replace: true,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].details.frontmatter.title).toBeUndefined();
      expect(data.results[0].details.frontmatter.newField).toBe('only this');
    });

    it('should add frontmatter to note without it', async () => {
      const result = await handleBatchUpdateFrontmatter({
        paths: ['note3.md'],
        updates: { title: 'Added Title' },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].details.frontmatter.title).toBe('Added Title');
    });
  });

  describe('handleBatchAddTag', () => {
    it('should add tags to multiple notes', async () => {
      const result = await handleBatchAddTag({
        paths: ['note1.md', 'note2.md'],
        tags: ['new-tag'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(2);
    });

    it('should not add duplicate tags', async () => {
      const result = await handleBatchAddTag({
        paths: ['note1.md'],
        tags: ['existing', 'brand-new-tag'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      // 'existing' already exists so should not be in addedTags
      expect(data.results[0].details.addedTags).not.toContain('existing');
      // 'brand-new-tag' is new so should be in currentTags
      expect(data.results[0].details.currentTags).toContain('brand-new-tag');
    });

    it('should normalize tags with # prefix', async () => {
      const result = await handleBatchAddTag({
        paths: ['note1.md'],
        tags: ['#prefixed-tag'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].details.currentTags).toContain('prefixed-tag');
    });

    it('should create tags array for notes without it', async () => {
      const result = await handleBatchAddTag({
        paths: ['note3.md'],
        tags: ['first-tag'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].details.currentTags).toContain('first-tag');
    });
  });

  describe('handleBatchRemoveTag', () => {
    it('should remove tags from multiple notes', async () => {
      const result = await handleBatchRemoveTag({
        paths: ['note1.md', 'folder/nested.md'],
        tags: ['existing', 'nested'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(2);
    });

    it('should report removed tags', async () => {
      // First add a tag we can remove
      await handleBatchAddTag({
        paths: ['note1.md'],
        tags: ['to-remove'],
      });

      const result = await handleBatchRemoveTag({
        paths: ['note1.md'],
        tags: ['to-remove'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].details.removedTags).toContain('to-remove');
      expect(data.results[0].details.currentTags).not.toContain('to-remove');
    });

    it('should handle non-existent tags gracefully', async () => {
      const result = await handleBatchRemoveTag({
        paths: ['note1.md'],
        tags: ['nonexistent-tag'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].details.removedTags).toEqual([]);
    });

    it('should normalize tags with # prefix', async () => {
      // First add a tag we can remove
      await handleBatchAddTag({
        paths: ['note1.md'],
        tags: ['prefixed-remove'],
      });

      const result = await handleBatchRemoveTag({
        paths: ['note1.md'],
        tags: ['#prefixed-remove'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].details.removedTags).toContain('prefixed-remove');
    });
  });

  describe('handleBatchRead', () => {
    it('should read multiple notes', async () => {
      const result = await handleBatchRead({
        paths: ['note1.md', 'note2.md'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(2);
      expect(data.failed).toBe(0);
      expect(data.results.length).toBe(2);
    });

    it('should include content and frontmatter by default', async () => {
      const result = await handleBatchRead({
        paths: ['note1.md'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].content).toBeDefined();
      expect(data.results[0].frontmatter).toBeDefined();
      expect(data.results[0].frontmatter.title).toBe('Note 1');
    });

    it('should exclude content when includeContent=false', async () => {
      const result = await handleBatchRead({
        paths: ['note1.md'],
        includeContent: false,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].content).toBeUndefined();
      expect(data.results[0].frontmatter).toBeDefined();
    });

    it('should exclude frontmatter when includeFrontmatter=false', async () => {
      const result = await handleBatchRead({
        paths: ['note1.md'],
        includeFrontmatter: false,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].content).toBeDefined();
      expect(data.results[0].frontmatter).toBeUndefined();
    });

    it('should handle partial failures', async () => {
      const result = await handleBatchRead({
        paths: ['note1.md', 'nonexistent.md'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.failed).toBe(1);
      expect(data.success).toBe(false);
      expect(data.results[1].error).toBeDefined();
    });

    it('should read notes from nested folders', async () => {
      const result = await handleBatchRead({
        paths: ['folder/nested.md'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].frontmatter).toBeDefined();
      expect(data.results[0].content).toContain('Nested Note');
    });

    it('should read notes without frontmatter', async () => {
      const result = await handleBatchRead({
        paths: ['note3.md'],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.succeeded).toBe(1);
      expect(data.results[0].content).toContain('No frontmatter');
    });
  });
});
