/**
 * Tests for frontmatter tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleGetFrontmatter,
  handleUpdateFrontmatter,
  handleRemoveFrontmatterField,
  handleAddToArrayField,
  handleRemoveFromArrayField,
  getFrontmatterSchema,
  updateFrontmatterSchema,
  removeFrontmatterFieldSchema,
  addToArrayFieldSchema,
  removeFromArrayFieldSchema,
  frontmatterTools,
} from '../../tools/frontmatter.js';
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

describe('frontmatter tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note-with-frontmatter.md`]: `---
title: My Note
status: draft
priority: 1
tags:
  - work
  - important
aliases:
  - my-note
---

# My Note

Content here.
`,
      [`${VAULT_PATH}/note-without-frontmatter.md`]: `# Simple Note

No frontmatter here.
`,
      [`${VAULT_PATH}/note-with-scalar.md`]: `---
title: Scalar Test
category: test
---

# Scalar Test
`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('getFrontmatterSchema should require path', () => {
      expect(() => getFrontmatterSchema.parse({ path: 'test.md' })).not.toThrow();
      expect(() => getFrontmatterSchema.parse({})).toThrow();
    });

    it('updateFrontmatterSchema should require path and updates', () => {
      expect(() => updateFrontmatterSchema.parse({
        path: 'test.md',
        updates: { title: 'Test' },
      })).not.toThrow();
      expect(() => updateFrontmatterSchema.parse({ path: 'test.md' })).toThrow();
      expect(() => updateFrontmatterSchema.parse({ updates: {} })).toThrow();
    });

    it('updateFrontmatterSchema should have replace default false', () => {
      const parsed = updateFrontmatterSchema.parse({
        path: 'test.md',
        updates: {},
      });
      expect(parsed.replace).toBe(false);
    });

    it('removeFrontmatterFieldSchema should require path and field', () => {
      expect(() => removeFrontmatterFieldSchema.parse({
        path: 'test.md',
        field: 'title',
      })).not.toThrow();
      expect(() => removeFrontmatterFieldSchema.parse({ path: 'test.md' })).toThrow();
    });

    it('addToArrayFieldSchema should require path, field, and values', () => {
      expect(() => addToArrayFieldSchema.parse({
        path: 'test.md',
        field: 'tags',
        values: ['new-tag'],
      })).not.toThrow();
      expect(() => addToArrayFieldSchema.parse({ path: 'test.md', field: 'tags' })).toThrow();
    });

    it('addToArrayFieldSchema should have createIfMissing default true', () => {
      const parsed = addToArrayFieldSchema.parse({
        path: 'test.md',
        field: 'tags',
        values: [],
      });
      expect(parsed.createIfMissing).toBe(true);
    });

    it('removeFromArrayFieldSchema should require path, field, and values', () => {
      expect(() => removeFromArrayFieldSchema.parse({
        path: 'test.md',
        field: 'tags',
        values: ['tag'],
      })).not.toThrow();
      expect(() => removeFromArrayFieldSchema.parse({ path: 'test.md', field: 'tags' })).toThrow();
    });
  });

  describe('frontmatterTools', () => {
    it('should define 5 frontmatter tools', () => {
      expect(frontmatterTools.length).toBe(5);
      const names = frontmatterTools.map(t => t.name);
      expect(names).toContain('get_frontmatter');
      expect(names).toContain('update_frontmatter');
      expect(names).toContain('remove_frontmatter_field');
      expect(names).toContain('add_to_array_field');
      expect(names).toContain('remove_from_array_field');
    });
  });

  describe('handleGetFrontmatter', () => {
    it('should get frontmatter from note', async () => {
      const result = await handleGetFrontmatter({ path: 'note-with-frontmatter.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.hasFrontmatter).toBe(true);
      expect(data.frontmatter.title).toBe('My Note');
      expect(data.frontmatter.status).toBe('draft');
      expect(data.frontmatter.priority).toBe(1);
      expect(data.frontmatter.tags).toContain('work');
    });

    it('should return empty frontmatter for note without it', async () => {
      const result = await handleGetFrontmatter({ path: 'note-without-frontmatter.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.hasFrontmatter).toBe(false);
      expect(Object.keys(data.frontmatter).length).toBe(0);
    });

    it('should auto-add .md extension', async () => {
      const result = await handleGetFrontmatter({ path: 'note-with-frontmatter' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.frontmatter.title).toBe('My Note');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleGetFrontmatter({ path: 'nonexistent.md' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleUpdateFrontmatter', () => {
    it('should merge frontmatter by default', async () => {
      const result = await handleUpdateFrontmatter({
        path: 'note-with-frontmatter.md',
        updates: { status: 'published', newField: 'value' },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.frontmatter.status).toBe('published');
      expect(data.frontmatter.newField).toBe('value');
      expect(data.frontmatter.title).toBe('My Note'); // Original field preserved
    });

    it('should replace all frontmatter when replace=true', async () => {
      const result = await handleUpdateFrontmatter({
        path: 'note-with-frontmatter.md',
        updates: { newTitle: 'Replaced' },
        replace: true,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.frontmatter.newTitle).toBe('Replaced');
      expect(data.frontmatter.title).toBeUndefined(); // Original field removed
      expect(data.frontmatter.status).toBeUndefined();
    });

    it('should remove field by setting to null', async () => {
      const result = await handleUpdateFrontmatter({
        path: 'note-with-frontmatter.md',
        updates: { status: null },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.frontmatter.status).toBeUndefined();
      expect(data.frontmatter.title).toBe('My Note'); // Other fields preserved
    });

    it('should add frontmatter to note without it', async () => {
      const result = await handleUpdateFrontmatter({
        path: 'note-without-frontmatter.md',
        updates: { title: 'New Title' },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.frontmatter.title).toBe('New Title');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleUpdateFrontmatter({
        path: 'nonexistent.md',
        updates: { title: 'Test' },
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleRemoveFrontmatterField', () => {
    it('should remove existing field', async () => {
      const result = await handleRemoveFrontmatterField({
        path: 'note-with-frontmatter.md',
        field: 'status',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.removed).toBe(true);

      // Verify field was removed
      const getResult = await handleGetFrontmatter({ path: 'note-with-frontmatter.md' });
      const getData = JSON.parse(getResult.content[0].text);
      expect(getData.frontmatter.status).toBeUndefined();
    });

    it('should handle removing non-existent field gracefully', async () => {
      const result = await handleRemoveFrontmatterField({
        path: 'note-with-frontmatter.md',
        field: 'nonexistent',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.removed).toBe(false);
    });

    it('should return error for non-existent note', async () => {
      const result = await handleRemoveFrontmatterField({
        path: 'nonexistent.md',
        field: 'title',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleAddToArrayField', () => {
    it('should add values to existing array', async () => {
      const result = await handleAddToArrayField({
        path: 'note-with-frontmatter.md',
        field: 'tags',
        values: ['new-tag', 'another-tag'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.added).toContain('new-tag');
      expect(data.added).toContain('another-tag');
      expect(data.currentValues).toContain('work');
      expect(data.currentValues).toContain('new-tag');
    });

    it('should not add duplicate values', async () => {
      // First verify the initial state
      const getResult = await handleGetFrontmatter({ path: 'note-with-frontmatter.md' });
      const initialData = JSON.parse(getResult.content[0].text);
      expect(initialData.frontmatter.tags).toContain('work');

      const result = await handleAddToArrayField({
        path: 'note-with-frontmatter.md',
        field: 'tags',
        values: ['work', 'brand-new-tag'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      // 'work' should not be in added since it already exists
      expect(data.added).not.toContain('work');
      // 'brand-new-tag' should be added
      expect(data.currentValues).toContain('brand-new-tag');
    });

    it('should create field if missing (createIfMissing=true)', async () => {
      const result = await handleAddToArrayField({
        path: 'note-with-frontmatter.md',
        field: 'newArray',
        values: ['value1', 'value2'],
        createIfMissing: true,
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.currentValues).toEqual(['value1', 'value2']);
    });

    it('should error if field missing and createIfMissing=false', async () => {
      const result = await handleAddToArrayField({
        path: 'note-with-frontmatter.md',
        field: 'nonexistent',
        values: ['value'],
        createIfMissing: false,
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('does not exist');
    });

    it('should error if field is not an array', async () => {
      const result = await handleAddToArrayField({
        path: 'note-with-scalar.md',
        field: 'category',
        values: ['new'],
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not an array');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleAddToArrayField({
        path: 'nonexistent.md',
        field: 'tags',
        values: ['tag'],
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleRemoveFromArrayField', () => {
    it('should remove values from array', async () => {
      const result = await handleRemoveFromArrayField({
        path: 'note-with-frontmatter.md',
        field: 'tags',
        values: ['work'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.removed).toContain('work');
      expect(data.currentValues).not.toContain('work');
      expect(data.currentValues).toContain('important');
    });

    it('should handle removing non-existent values gracefully', async () => {
      const result = await handleRemoveFromArrayField({
        path: 'note-with-frontmatter.md',
        field: 'tags',
        values: ['nonexistent-tag'],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.removed).toEqual([]);
    });

    it('should error if field does not exist', async () => {
      const result = await handleRemoveFromArrayField({
        path: 'note-with-frontmatter.md',
        field: 'nonexistent',
        values: ['value'],
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('does not exist');
    });

    it('should error if field is not an array', async () => {
      const result = await handleRemoveFromArrayField({
        path: 'note-with-scalar.md',
        field: 'category',
        values: ['test'],
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not an array');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleRemoveFromArrayField({
        path: 'nonexistent.md',
        field: 'tags',
        values: ['tag'],
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });
});
