/**
 * Tests for bases tools
 *
 * Obsidian Bases uses YAML config files that define filters to query notes.
 * The data comes from notes in the vault that match the filters.
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
      // Tasks base - filters by tag
      [`${VAULT_PATH}/Bases/tasks.base`]: `filters:
  and:
    - note.tags.contains("task")
properties:
  file.name:
    displayName: Title
  note.status:
    displayName: Status
  note.priority:
    displayName: Priority
`,
      // Projects base - filters by folder
      [`${VAULT_PATH}/Bases/projects.base`]: `filters:
  and:
    - file.folder.contains("Projects")
properties:
  file.name:
    displayName: Name
  note.active:
    displayName: Active
`,
      // Task notes
      [`${VAULT_PATH}/Tasks/Task 1.md`]: `---
tags:
  - task
status: todo
priority: 1
---
# Task 1
`,
      [`${VAULT_PATH}/Tasks/Task 2.md`]: `---
tags:
  - task
status: in-progress
priority: 2
---
# Task 2
`,
      [`${VAULT_PATH}/Tasks/Task 3.md`]: `---
tags:
  - task
status: done
priority: 3
---
# Task 3
`,
      // Project notes
      [`${VAULT_PATH}/Projects/Project A.md`]: `---
active: true
---
# Project A
`,
      [`${VAULT_PATH}/Projects/Project B.md`]: `---
active: false
---
# Project B
`,
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
      expect(() => getBaseSchema.parse({ path: 'Bases/tasks.base' })).not.toThrow();
      expect(() => getBaseSchema.parse({})).toThrow();
    });

    it('queryBaseSchema should require path', () => {
      expect(() => queryBaseSchema.parse({ path: 'Bases/tasks.base' })).not.toThrow();
      expect(() => queryBaseSchema.parse({
        path: 'Bases/tasks.base',
        filter: { status: 'done' },
        sortColumn: 'priority',
        sortOrder: 'desc',
        limit: 10,
      })).not.toThrow();
      expect(() => queryBaseSchema.parse({})).toThrow();
    });

    it('queryBaseSchema should accept optional sortOrder (default applied in handler)', () => {
      const parsed = queryBaseSchema.parse({ path: 'Bases/tasks.base' });
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
      const result = await handleGetBase({ path: 'Bases/tasks.base' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('tasks');
      expect(data.columnCount).toBeGreaterThan(0);
      expect(data.rowCount).toBe(3);
      expect(data.columns).toBeDefined();
      expect(data.rows).toBeDefined();
    });

    it('should auto-add .base extension', async () => {
      const result = await handleGetBase({ path: 'Bases/tasks' });

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
      const result = await handleQueryBase({ path: 'Bases/tasks.base' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBe(3);
    });

    it('should filter by column value', async () => {
      const result = await handleQueryBase({
        path: 'Bases/tasks.base',
        filter: { status: 'done' },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.resultCount).toBe(1);
      expect(data.rows[0].values['file.name']).toBe('Task 3');
    });

    it('should sort ascending', async () => {
      const result = await handleQueryBase({
        path: 'Bases/tasks.base',
        sortColumn: 'priority',
        sortOrder: 'asc',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.rows[0].values.priority).toBe(1);
      expect(data.rows[2].values.priority).toBe(3);
    });

    it('should sort descending', async () => {
      const result = await handleQueryBase({
        path: 'Bases/tasks.base',
        sortColumn: 'priority',
        sortOrder: 'desc',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.rows[0].values.priority).toBe(3);
      expect(data.rows[2].values.priority).toBe(1);
    });

    it('should limit results', async () => {
      const result = await handleQueryBase({
        path: 'Bases/tasks.base',
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
