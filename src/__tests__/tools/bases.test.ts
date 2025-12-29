/**
 * Tests for bases tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleListBases,
  handleGetBase,
  handleQueryBase,
  listBasesSchema,
  getBaseSchema,
  queryBaseSchema,
  basesTools,
} from '../../tools/bases.js';
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

describe('bases tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/tasks.base`]: JSON.stringify({
        columns: [
          { name: 'title', type: 'text' },
          { name: 'status', type: 'select' },
          { name: 'priority', type: 'number' },
        ],
        rows: [
          { id: '1', values: { title: 'Task 1', status: 'todo', priority: 1 } },
          { id: '2', values: { title: 'Task 2', status: 'in-progress', priority: 2 } },
          { id: '3', values: { title: 'Task 3', status: 'done', priority: 3 } },
        ],
      }),
      [`${VAULT_PATH}/projects.base`]: JSON.stringify({
        columns: [
          { name: 'name', type: 'text' },
          { name: 'active', type: 'checkbox' },
        ],
        rows: [
          { id: '1', values: { name: 'Project A', active: true } },
          { id: '2', values: { name: 'Project B', active: false } },
        ],
      }),
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('listBasesSchema should accept empty object', () => {
      expect(() => listBasesSchema.parse({})).not.toThrow();
    });

    it('getBaseSchema should require path', () => {
      expect(() => getBaseSchema.parse({ path: 'tasks.base' })).not.toThrow();
      expect(() => getBaseSchema.parse({})).toThrow();
    });

    it('queryBaseSchema should require path', () => {
      expect(() => queryBaseSchema.parse({ path: 'tasks.base' })).not.toThrow();
      expect(() => queryBaseSchema.parse({
        path: 'tasks.base',
        filter: { status: 'done' },
        sortColumn: 'priority',
        sortOrder: 'desc',
        limit: 10,
      })).not.toThrow();
      expect(() => queryBaseSchema.parse({})).toThrow();
    });

    it('queryBaseSchema should accept optional sortOrder (default applied in handler)', () => {
      const parsed = queryBaseSchema.parse({ path: 'tasks.base' });
      expect(parsed.sortOrder).toBeUndefined(); // default 'asc' is applied in handler
    });
  });

  describe('basesTools', () => {
    it('should define 3 bases tools', () => {
      expect(basesTools.length).toBe(3);
      const names = basesTools.map(t => t.name);
      expect(names).toContain('list_bases');
      expect(names).toContain('get_base');
      expect(names).toContain('query_base');
    });
  });

  describe('handleListBases', () => {
    it('should list all bases in vault', async () => {
      const result = await handleListBases();

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      expect(data.bases.map((b: any) => b.name)).toContain('tasks');
      expect(data.bases.map((b: any) => b.name)).toContain('projects');
    });

    it('should include base paths', async () => {
      const result = await handleListBases();

      const data = JSON.parse(result.content[0].text);
      expect(data.bases.every((b: any) => b.path !== undefined)).toBe(true);
    });
  });

  describe('handleGetBase', () => {
    it('should get base with columns and rows', async () => {
      const result = await handleGetBase({ path: 'tasks.base' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('tasks');
      expect(data.columnCount).toBe(3);
      expect(data.rowCount).toBe(3);
      expect(data.columns).toBeDefined();
      expect(data.rows).toBeDefined();
    });

    it('should auto-add .base extension', async () => {
      const result = await handleGetBase({ path: 'tasks' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('tasks');
    });

    it('should return error for non-existent base', async () => {
      const result = await handleGetBase({ path: 'nonexistent.base' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeDefined();
    });
  });

  describe('handleQueryBase', () => {
    it('should return all rows without filter', async () => {
      const result = await handleQueryBase({ path: 'tasks.base' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBe(3);
    });

    it('should filter by column value', async () => {
      const result = await handleQueryBase({
        path: 'tasks.base',
        filter: { status: 'done' },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBe(1);
      expect(data.rows[0].values.title).toBe('Task 3');
    });

    it('should sort ascending', async () => {
      const result = await handleQueryBase({
        path: 'tasks.base',
        sortColumn: 'priority',
        sortOrder: 'asc',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.rows[0].values.priority).toBe(1);
      expect(data.rows[2].values.priority).toBe(3);
    });

    it('should sort descending', async () => {
      const result = await handleQueryBase({
        path: 'tasks.base',
        sortColumn: 'priority',
        sortOrder: 'desc',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.rows[0].values.priority).toBe(3);
      expect(data.rows[2].values.priority).toBe(1);
    });

    it('should limit results', async () => {
      const result = await handleQueryBase({
        path: 'tasks.base',
        limit: 2,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBe(2);
    });

    it('should return error for non-existent base', async () => {
      const result = await handleQueryBase({ path: 'nonexistent.base' });

      expect(result.isError).toBe(true);
    });
  });
});
