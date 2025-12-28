/**
 * Tests for tags tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleListTags,
  handleAddTag,
  handleRemoveTag,
  handleSearchByTag,
  listTagsSchema,
  addTagSchema,
  removeTagSchema,
  searchByTagSchema,
  tagTools,
} from '../../tools/tags.js';
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

describe('tags tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `---
title: Note 1
tags:
  - javascript
  - testing
---

# Note 1

Content with #inline-tag here.
`,
      [`${VAULT_PATH}/note2.md`]: `---
title: Note 2
tags:
  - python
  - testing
---

# Note 2

Python programming.
`,
      [`${VAULT_PATH}/note3.md`]: `# Note 3

No frontmatter tags but #inline-tag and #another-tag.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `---
tags:
  - javascript
  - web
---

# Nested Note

Web development.
`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('listTagsSchema should accept empty object', () => {
      expect(() => listTagsSchema.parse({})).not.toThrow();
      expect(() => listTagsSchema.parse({ folder: 'test' })).not.toThrow();
    });

    it('addTagSchema should require path and tag', () => {
      expect(() => addTagSchema.parse({ path: 'note.md', tag: 'test' })).not.toThrow();
      expect(() => addTagSchema.parse({ path: 'note.md' })).toThrow();
      expect(() => addTagSchema.parse({ tag: 'test' })).toThrow();
    });

    it('removeTagSchema should require path and tag', () => {
      expect(() => removeTagSchema.parse({ path: 'note.md', tag: 'test' })).not.toThrow();
      expect(() => removeTagSchema.parse({ path: 'note.md' })).toThrow();
    });

    it('searchByTagSchema should require tag', () => {
      expect(() => searchByTagSchema.parse({ tag: 'test' })).not.toThrow();
      expect(() => searchByTagSchema.parse({ tag: 'test', folder: 'notes' })).not.toThrow();
      expect(() => searchByTagSchema.parse({})).toThrow();
    });
  });

  describe('tagTools', () => {
    it('should define 4 tag tools', () => {
      expect(tagTools.length).toBe(4);
      const names = tagTools.map(t => t.name);
      expect(names).toContain('list_tags');
      expect(names).toContain('add_tag');
      expect(names).toContain('remove_tag');
      expect(names).toContain('search_by_tag');
    });
  });

  describe('handleListTags', () => {
    it('should list all tags in vault', async () => {
      const result = await handleListTags({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.totalTags).toBeGreaterThan(0);
      expect(data.tags.some((t: any) => t.tag === 'testing')).toBe(true);
      expect(data.tags.some((t: any) => t.tag === 'javascript')).toBe(true);
    });

    it('should include tag counts', async () => {
      const result = await handleListTags({});

      const data = JSON.parse(result.content[0].text);
      const testingTag = data.tags.find((t: any) => t.tag === 'testing');
      expect(testingTag).toBeDefined();
      expect(testingTag.count).toBe(2); // note1 and note2
    });

    it('should filter by folder', async () => {
      const result = await handleListTags({ folder: 'folder' });

      const data = JSON.parse(result.content[0].text);
      // Only nested.md in folder has javascript and web
      expect(data.tags.some((t: any) => t.tag === 'javascript')).toBe(true);
      expect(data.tags.some((t: any) => t.tag === 'web')).toBe(true);
      // Note2's tags should not be included
      expect(data.tags.some((t: any) => t.tag === 'python')).toBe(false);
    });

    it('should include inline tags', async () => {
      const result = await handleListTags({});

      const data = JSON.parse(result.content[0].text);
      expect(data.tags.some((t: any) => t.tag === 'inline-tag')).toBe(true);
    });
  });

  describe('handleAddTag', () => {
    it('should add tag to note with existing tags', async () => {
      const result = await handleAddTag({
        path: 'note1.md',
        tag: 'new-tag',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.addedTag).toBe('new-tag');
    });

    it('should normalize tag with # prefix', async () => {
      const result = await handleAddTag({
        path: 'note1.md',
        tag: '#prefixed-tag',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.addedTag).toBe('prefixed-tag');
    });

    it('should add tag to note without frontmatter', async () => {
      const result = await handleAddTag({
        path: 'note3.md',
        tag: 'new-frontmatter-tag',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should return error for non-existent note', async () => {
      const result = await handleAddTag({
        path: 'nonexistent.md',
        tag: 'test',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleRemoveTag', () => {
    it('should remove tag from note', async () => {
      const result = await handleRemoveTag({
        path: 'note1.md',
        tag: 'testing',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.removedTag).toBe('testing');
    });

    it('should normalize tag with # prefix', async () => {
      const result = await handleRemoveTag({
        path: 'note1.md',
        tag: '#javascript',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.removedTag).toBe('javascript');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleRemoveTag({
        path: 'nonexistent.md',
        tag: 'test',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleSearchByTag', () => {
    it('should find notes with tag', async () => {
      const result = await handleSearchByTag({ tag: 'testing' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      expect(data.notes).toContain('note1.md');
      expect(data.notes).toContain('note2.md');
    });

    it('should search case-insensitively', async () => {
      const result = await handleSearchByTag({ tag: 'TESTING' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });

    it('should handle # prefix in search', async () => {
      const result = await handleSearchByTag({ tag: '#testing' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });

    it('should filter by folder', async () => {
      const result = await handleSearchByTag({ tag: 'javascript', folder: 'folder' });

      const data = JSON.parse(result.content[0].text);
      // Only nested.md in folder has javascript
      expect(data.count).toBe(1);
      expect(data.notes[0]).toContain('nested.md');
    });

    it('should return empty for non-existent tag', async () => {
      const result = await handleSearchByTag({ tag: 'nonexistent-tag' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(0);
      expect(data.notes).toEqual([]);
    });

    it('should find inline tags', async () => {
      const result = await handleSearchByTag({ tag: 'inline-tag' });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeGreaterThan(0);
    });
  });
});
