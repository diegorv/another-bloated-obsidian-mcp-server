/**
 * Tests for daily notes service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  loadDailyNotesConfig,
  formatDate,
  parseDate,
  getDailyNotePath,
  listDailyNotes,
  getOrCreateDailyNote,
  appendToDailyNote,
} from '../../services/daily-notes.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const VAULT_PATH = '/test-vault';

describe('daily-notes service', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/.obsidian/daily-notes.json`]: JSON.stringify({
        folder: 'Daily',
        format: 'YYYY-MM-DD',
      }),
      [`${VAULT_PATH}/Daily/2024-01-15.md`]: `# 2024-01-15

Daily note content.
`,
      [`${VAULT_PATH}/Daily/2024-01-14.md`]: `# 2024-01-14

Previous day.
`,
      [`${VAULT_PATH}/Daily/2024-01-16.md`]: `# 2024-01-16

Next day.
`,
      [`${VAULT_PATH}/Templates/Daily.md`]: `# {{date}}

## Tasks
- [ ]

## Notes

`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('loadDailyNotesConfig', () => {
    it('should load config from .obsidian folder', async () => {
      const config = await loadDailyNotesConfig(VAULT_PATH);

      expect(config.folder).toBe('Daily');
      expect(config.format).toBe('YYYY-MM-DD');
    });

    it('should return default config if file not found', async () => {
      vol.unlinkSync(`${VAULT_PATH}/.obsidian/daily-notes.json`);

      const config = await loadDailyNotesConfig(VAULT_PATH);

      expect(config.folder).toBe('');
      expect(config.format).toBe('YYYY-MM-DD');
    });

    it('should use defaults for missing properties', async () => {
      vol.writeFileSync(
        `${VAULT_PATH}/.obsidian/daily-notes.json`,
        JSON.stringify({ folder: 'Custom' })
      );

      const config = await loadDailyNotesConfig(VAULT_PATH);

      expect(config.folder).toBe('Custom');
      expect(config.format).toBe('YYYY-MM-DD');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date(2024, 0, 15); // January 15, 2024 (Monday)

    it('should format YYYY', () => {
      expect(formatDate(testDate, 'YYYY')).toBe('2024');
    });

    it('should format YY', () => {
      expect(formatDate(testDate, 'YY')).toBe('24');
    });

    it('should format MM', () => {
      expect(formatDate(testDate, 'MM')).toBe('01');
    });

    it('should format DD', () => {
      expect(formatDate(testDate, 'DD')).toBe('15');
    });

    it('should format MMMM (full month name)', () => {
      expect(formatDate(testDate, 'MMMM')).toBe('January');
    });

    it('should format MMM (short month name)', () => {
      expect(formatDate(testDate, 'MMM')).toBe('Jan');
    });

    it('should format dddd (full day name)', () => {
      expect(formatDate(testDate, 'dddd')).toBe('Monday');
    });

    it('should format ddd (short day name)', () => {
      expect(formatDate(testDate, 'ddd')).toBe('Mon');
    });

    it('should format combined patterns', () => {
      expect(formatDate(testDate, 'YYYY-MM-DD')).toBe('2024-01-15');
      expect(formatDate(testDate, 'DD MMM YYYY')).toBe('15 Jan 2024');
      expect(formatDate(testDate, 'dddd, MMMM DD, YYYY')).toBe('Monday, January 15, 2024');
    });
  });

  describe('parseDate', () => {
    it('should parse YYYY-MM-DD format', () => {
      const date = parseDate('2024-01-15', 'YYYY-MM-DD');

      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(0);
      expect(date?.getDate()).toBe(15);
    });

    it('should return null for invalid date string', () => {
      const date = parseDate('not-a-date', 'YYYY-MM-DD');

      expect(date).toBeNull();
    });

    it('should handle different formats', () => {
      const date = parseDate('15-01-2024', 'DD-MM-YYYY');

      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
    });
  });

  describe('getDailyNotePath', () => {
    it('should return path with folder', () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 15);

      const path = getDailyNotePath(config, date);

      expect(path).toBe('Daily/2024-01-15.md');
    });

    it('should return path without folder', () => {
      const config = { folder: '', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 15);

      const path = getDailyNotePath(config, date);

      expect(path).toBe('2024-01-15.md');
    });

    it('should handle custom format', () => {
      const config = { folder: 'Daily', format: 'YYYY/MM/DD' };
      const date = new Date(2024, 0, 15);

      const path = getDailyNotePath(config, date);

      expect(path).toBe('Daily/2024/01/15.md');
    });
  });

  describe('listDailyNotes', () => {
    it('should list all daily notes', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };

      const notes = await listDailyNotes(VAULT_PATH, config);

      expect(notes.length).toBe(3);
      expect(notes[0].date).toBe('2024-01-16'); // Sorted descending
      expect(notes[1].date).toBe('2024-01-15');
      expect(notes[2].date).toBe('2024-01-14');
    });

    it('should filter by start date', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const startDate = new Date(2024, 0, 15);

      const notes = await listDailyNotes(VAULT_PATH, config, startDate);

      expect(notes.length).toBe(2);
      expect(notes.every(n => n.date >= '2024-01-15')).toBe(true);
    });

    it('should filter by end date', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const endDate = new Date(2024, 0, 15);

      const notes = await listDailyNotes(VAULT_PATH, config, undefined, endDate);

      expect(notes.length).toBe(2);
      expect(notes.every(n => n.date <= '2024-01-15')).toBe(true);
    });

    it('should filter by date range', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const startDate = new Date(2024, 0, 14);
      const endDate = new Date(2024, 0, 15);

      const notes = await listDailyNotes(VAULT_PATH, config, startDate, endDate);

      expect(notes.length).toBe(2);
    });

    it('should return empty array for non-existent folder', async () => {
      const config = { folder: 'NonExistent', format: 'YYYY-MM-DD' };

      const notes = await listDailyNotes(VAULT_PATH, config);

      expect(notes).toEqual([]);
    });
  });

  describe('getOrCreateDailyNote', () => {
    it('should return existing daily note', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 15);

      const result = await getOrCreateDailyNote(VAULT_PATH, config, date);

      expect(result.created).toBe(false);
      expect(result.path).toBe('Daily/2024-01-15.md');
      expect(result.content).toContain('Daily note content');
    });

    it('should create new daily note if not exists', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 20);

      const result = await getOrCreateDailyNote(VAULT_PATH, config, date);

      expect(result.created).toBe(true);
      expect(result.path).toBe('Daily/2024-01-20.md');
      expect(result.content).toContain('# 2024-01-20');
    });

    it('should use template if configured', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD', template: 'Templates/Daily' };
      const date = new Date(2024, 0, 20);

      const result = await getOrCreateDailyNote(VAULT_PATH, config, date);

      expect(result.created).toBe(true);
      expect(result.content).toContain('## Tasks');
      expect(result.content).toContain('2024-01-20');
    });

    it('should create parent directories if needed', async () => {
      const config = { folder: 'Nested/Daily', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 20);

      const result = await getOrCreateDailyNote(VAULT_PATH, config, date);

      expect(result.created).toBe(true);
      expect(result.path).toBe('Nested/Daily/2024-01-20.md');
    });
  });

  describe('appendToDailyNote', () => {
    it('should append content to existing daily note', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 15);

      const path = await appendToDailyNote(VAULT_PATH, config, '## New Section', date);

      expect(path).toBe('Daily/2024-01-15.md');

      const content = vol.readFileSync(`${VAULT_PATH}/Daily/2024-01-15.md`, 'utf8') as string;
      expect(content).toContain('Daily note content');
      expect(content).toContain('## New Section');
    });

    it('should create daily note if not exists before appending', async () => {
      const config = { folder: 'Daily', format: 'YYYY-MM-DD' };
      const date = new Date(2024, 0, 25);

      await appendToDailyNote(VAULT_PATH, config, '## New Content', date);

      const content = vol.readFileSync(`${VAULT_PATH}/Daily/2024-01-25.md`, 'utf8') as string;
      expect(content).toContain('# 2024-01-25');
      expect(content).toContain('## New Content');
    });
  });
});
