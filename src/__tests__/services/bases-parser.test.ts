/**
 * Tests for bases parser service
 *
 * Obsidian Bases uses YAML config files that define filters to query notes.
 * The data comes from notes in the vault that match the filters.
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
      // People base - filters by tag
      [`${VAULT_PATH}/Bases/People.base`]: `filters:
  and:
    - '!file.name.contains("Template")'
    - note.tags.contains("people")
formulas:
  Age: (now() - birthday).years.floor()
properties:
  file.name:
    displayName: Name
  note.tags:
    displayName: Tags
  note.birthday:
    displayName: Birthday
`,
      // Projects base - filters by folder
      [`${VAULT_PATH}/Bases/Projects.base`]: `filters:
  and:
    - file.folder.contains("Projects")
properties:
  file.name:
    displayName: Project Name
  note.status:
    displayName: Status
`,
      // Notes that will be picked up by People base
      [`${VAULT_PATH}/People/John Doe.md`]: `---
tags:
  - people
birthday: 1990-05-15
---
# John Doe

A person note.
`,
      [`${VAULT_PATH}/People/Jane Smith.md`]: `---
tags:
  - people
  - vip
birthday: 1985-10-20
---
# Jane Smith

Another person.
`,
      [`${VAULT_PATH}/People/Template.md`]: `---
tags:
  - people
  - template
---
# Template

This should be excluded.
`,
      // Notes that will be picked up by Projects base
      [`${VAULT_PATH}/Projects/Website.md`]: `---
status: active
priority: 1
---
# Website Project
`,
      [`${VAULT_PATH}/Projects/Mobile App.md`]: `---
status: completed
priority: 2
---
# Mobile App Project
`,
      // Notes that should NOT be picked up
      [`${VAULT_PATH}/Random Note.md`]: `---
tags:
  - random
---
# Random Note

Not a person or project.
`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('listBases', () => {
    it('should list all .base files in vault', async () => {
      const bases = await listBases(VAULT_PATH);

      expect(bases.length).toBe(2);
      expect(bases.map(b => b.name)).toContain('People');
      expect(bases.map(b => b.name)).toContain('Projects');
    });

    it('should include relative paths', async () => {
      const bases = await listBases(VAULT_PATH);

      const people = bases.find(b => b.name === 'People');
      expect(people?.path).toBe('Bases/People.base');
    });

    it('should sort bases alphabetically', async () => {
      const bases = await listBases(VAULT_PATH);

      const names = bases.map(b => b.name);
      expect(names).toEqual([...names].sort());
    });

    it('should not include .obsidian folder', async () => {
      vol.writeFileSync(`${VAULT_PATH}/.obsidian/test.base`, 'filters:\n  and: []');

      const bases = await listBases(VAULT_PATH);

      expect(bases.every(b => !b.path.includes('.obsidian'))).toBe(true);
    });
  });

  describe('parseBase', () => {
    it('should parse YAML base config with tag filter', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      expect(base.name).toBe('People');
      expect(base.config?.filters?.and).toBeDefined();
      expect(base.config?.filters?.and).toContain('note.tags.contains("people")');
    });

    it('should find notes matching tag filter', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      // Should find John and Jane, but NOT Template (excluded by !file.name.contains)
      expect(base.rows.length).toBe(2);
      const names = base.rows.map(r => r.values['file.name']);
      expect(names).toContain('John Doe');
      expect(names).toContain('Jane Smith');
      expect(names).not.toContain('Template');
    });

    it('should find notes matching folder filter', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/Projects.base');

      expect(base.rows.length).toBe(2);
      const names = base.rows.map(r => r.values['file.name']);
      expect(names).toContain('Website');
      expect(names).toContain('Mobile App');
    });

    it('should include frontmatter properties in rows', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      const john = base.rows.find(r => r.values['file.name'] === 'John Doe');
      // gray-matter parses dates as Date objects
      const birthday = john?.values['birthday'];
      expect(birthday).toBeDefined();
      // Check if it's a Date object or string containing the date
      if (birthday instanceof Date) {
        expect(birthday.toISOString()).toContain('1990-05-15');
      } else {
        expect(String(birthday)).toContain('1990-05-15');
      }
    });

    it('should include tags in rows', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      const jane = base.rows.find(r => r.values['file.name'] === 'Jane Smith');
      expect(jane?.values['tags']).toContain('people');
      expect(jane?.values['tags']).toContain('vip');
    });

    it('should evaluate age formula', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      const john = base.rows.find(r => r.values['file.name'] === 'John Doe');
      // John was born in 1990, so his age should be calculated
      expect(john?.values['formula.Age']).toBeDefined();
      expect(typeof john?.values['formula.Age']).toBe('number');
    });

    it('should build columns from config properties', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      const fileNameColumn = base.columns.find(c => c.name === 'file.name');
      expect(fileNameColumn?.displayName).toBe('Name');

      const birthdayColumn = base.columns.find(c => c.name === 'note.birthday');
      expect(birthdayColumn?.displayName).toBe('Birthday');
    });

    it('should include formula columns', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      const ageColumn = base.columns.find(c => c.name === 'formula.Age');
      expect(ageColumn).toBeDefined();
      expect(ageColumn?.type).toBe('formula');
    });

    it('should auto-add .base extension', async () => {
      const base = await parseBase(VAULT_PATH, 'Bases/People');

      expect(base.name).toBe('People');
      expect(base.rows.length).toBe(2);
    });

    it('should throw error for non-existent base', async () => {
      await expect(parseBase(VAULT_PATH, 'nonexistent.base'))
        .rejects.toThrow();
    });
  });

  describe('queryBase', () => {
    it('should return all matching rows without additional filter', async () => {
      const rows = await queryBase(VAULT_PATH, 'Bases/People.base');

      expect(rows.length).toBe(2);
    });

    it('should apply additional filter on top of base filters', async () => {
      const rows = await queryBase(VAULT_PATH, 'Bases/People.base', {
        filter: { 'file.name': 'John Doe' },
      });

      expect(rows.length).toBe(1);
      expect(rows[0].values['file.name']).toBe('John Doe');
    });

    it('should sort by column ascending', async () => {
      const rows = await queryBase(VAULT_PATH, 'Bases/People.base', {
        sort: { column: 'file.name', order: 'asc' },
      });

      expect(rows[0].values['file.name']).toBe('Jane Smith');
      expect(rows[1].values['file.name']).toBe('John Doe');
    });

    it('should sort by column descending', async () => {
      const rows = await queryBase(VAULT_PATH, 'Bases/People.base', {
        sort: { column: 'file.name', order: 'desc' },
      });

      expect(rows[0].values['file.name']).toBe('John Doe');
      expect(rows[1].values['file.name']).toBe('Jane Smith');
    });

    it('should limit results', async () => {
      const rows = await queryBase(VAULT_PATH, 'Bases/People.base', {
        limit: 1,
      });

      expect(rows.length).toBe(1);
    });

    it('should combine filter, sort, and limit', async () => {
      const rows = await queryBase(VAULT_PATH, 'Bases/Projects.base', {
        sort: { column: 'status', order: 'asc' },
        limit: 1,
      });

      expect(rows.length).toBe(1);
      expect(rows[0].values['status']).toBe('active');
    });
  });

  describe('filter evaluation', () => {
    it('should handle negation filter (!)', async () => {
      // The People base has '!file.name.contains("Template")'
      const base = await parseBase(VAULT_PATH, 'Bases/People.base');

      const names = base.rows.map(r => r.values['file.name']);
      expect(names).not.toContain('Template');
    });

    it('should handle OR filters', async () => {
      vol.writeFileSync(`${VAULT_PATH}/Bases/OrTest.base`, `filters:
  or:
    - note.tags.contains("vip")
    - note.tags.contains("random")
`);

      const base = await parseBase(VAULT_PATH, 'Bases/OrTest.base');

      // Should find Jane (vip) and Random Note (random)
      expect(base.rows.length).toBe(2);
      const names = base.rows.map(r => r.values['file.name']);
      expect(names).toContain('Jane Smith');
      expect(names).toContain('Random Note');
    });

    it('should return empty if no filters defined', async () => {
      vol.writeFileSync(`${VAULT_PATH}/Bases/NoFilter.base`, `properties:
  file.name:
    displayName: Name
`);

      const base = await parseBase(VAULT_PATH, 'Bases/NoFilter.base');

      // No filters means no notes match (safer default)
      expect(base.rows.length).toBe(0);
    });
  });
});
