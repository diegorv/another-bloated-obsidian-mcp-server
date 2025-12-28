/**
 * Tests for bases parser service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  listBases,
  parseBase,
  queryBase,
} from '../../services/bases-parser.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const VAULT_PATH = '/test-vault';

describe('bases-parser service', () => {
  beforeEach(() => {
    vol.reset();
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
      [`${VAULT_PATH}/folder/projects.base`]: JSON.stringify([
        { name: 'Project A', active: true, budget: 10000 },
        { name: 'Project B', active: false, budget: 5000 },
      ]),
      [`${VAULT_PATH}/contacts.base`]: `| Name | Email | Phone |
|------|-------|-------|
| John | john@example.com | 123-456 |
| Jane | jane@example.com | 789-012 |
`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('listBases', () => {
    it('should list all .base files in vault', async () => {
      const bases = await listBases(VAULT_PATH);

      expect(bases.length).toBe(3);
      expect(bases.map(b => b.name)).toContain('tasks');
      expect(bases.map(b => b.name)).toContain('projects');
      expect(bases.map(b => b.name)).toContain('contacts');
    });

    it('should include relative paths', async () => {
      const bases = await listBases(VAULT_PATH);

      const projects = bases.find(b => b.name === 'projects');
      expect(projects?.path).toBe('folder/projects.base');
    });

    it('should sort bases alphabetically', async () => {
      const bases = await listBases(VAULT_PATH);

      const names = bases.map(b => b.name);
      expect(names).toEqual([...names].sort());
    });

    it('should not include .obsidian folder', async () => {
      vol.writeFileSync(`${VAULT_PATH}/.obsidian/test.base`, '{}');

      const bases = await listBases(VAULT_PATH);

      expect(bases.every(b => !b.path.includes('.obsidian'))).toBe(true);
    });
  });

  describe('parseBase', () => {
    it('should parse JSON base with columns and rows', async () => {
      const base = await parseBase(VAULT_PATH, 'tasks.base');

      expect(base.name).toBe('tasks');
      expect(base.columns.length).toBe(3);
      expect(base.rows.length).toBe(3);
    });

    it('should parse JSON array format', async () => {
      const base = await parseBase(VAULT_PATH, 'folder/projects.base');

      expect(base.name).toBe('projects');
      expect(base.rows.length).toBe(2);
      expect(base.rows[0].values.name).toBe('Project A');
    });

    it('should infer column types from data', async () => {
      const base = await parseBase(VAULT_PATH, 'folder/projects.base');

      const activeColumn = base.columns.find(c => c.name === 'active');
      const budgetColumn = base.columns.find(c => c.name === 'budget');

      expect(activeColumn?.type).toBe('checkbox');
      expect(budgetColumn?.type).toBe('number');
    });

    it('should parse markdown table format', async () => {
      const base = await parseBase(VAULT_PATH, 'contacts.base');

      expect(base.name).toBe('contacts');
      expect(base.columns.map(c => c.name)).toContain('Name');
      expect(base.columns.map(c => c.name)).toContain('Email');
      expect(base.rows.length).toBe(2);
    });

    it('should auto-add .base extension', async () => {
      const base = await parseBase(VAULT_PATH, 'tasks');

      expect(base.name).toBe('tasks');
      expect(base.rows.length).toBe(3);
    });

    it('should throw error for non-existent base', async () => {
      await expect(parseBase(VAULT_PATH, 'nonexistent.base'))
        .rejects.toThrow();
    });
  });

  describe('queryBase', () => {
    it('should return all rows without filter', async () => {
      const rows = await queryBase(VAULT_PATH, 'tasks.base');

      expect(rows.length).toBe(3);
    });

    it('should filter by exact value', async () => {
      const rows = await queryBase(VAULT_PATH, 'tasks.base', {
        filter: { status: 'done' },
      });

      expect(rows.length).toBe(1);
      expect(rows[0].values.title).toBe('Task 3');
    });

    it('should filter by regex', async () => {
      const rows = await queryBase(VAULT_PATH, 'tasks.base', {
        filter: { title: /Task [12]/ },
      });

      expect(rows.length).toBe(2);
    });

    it('should sort ascending', async () => {
      const rows = await queryBase(VAULT_PATH, 'tasks.base', {
        sort: { column: 'priority', order: 'asc' },
      });

      expect(rows[0].values.priority).toBe(1);
      expect(rows[2].values.priority).toBe(3);
    });

    it('should sort descending', async () => {
      const rows = await queryBase(VAULT_PATH, 'tasks.base', {
        sort: { column: 'priority', order: 'desc' },
      });

      expect(rows[0].values.priority).toBe(3);
      expect(rows[2].values.priority).toBe(1);
    });

    it('should limit results', async () => {
      const rows = await queryBase(VAULT_PATH, 'tasks.base', {
        limit: 2,
      });

      expect(rows.length).toBe(2);
    });

    it('should combine filter, sort, and limit', async () => {
      vol.writeFileSync(
        `${VAULT_PATH}/many-tasks.base`,
        JSON.stringify({
          columns: [{ name: 'priority', type: 'number' }],
          rows: [
            { id: '1', values: { priority: 5 } },
            { id: '2', values: { priority: 3 } },
            { id: '3', values: { priority: 7 } },
            { id: '4', values: { priority: 1 } },
            { id: '5', values: { priority: 4 } },
          ],
        })
      );

      const rows = await queryBase(VAULT_PATH, 'many-tasks.base', {
        sort: { column: 'priority', order: 'asc' },
        limit: 3,
      });

      expect(rows.length).toBe(3);
      expect(rows[0].values.priority).toBe(1);
      expect(rows[1].values.priority).toBe(3);
      expect(rows[2].values.priority).toBe(4);
    });
  });
});
