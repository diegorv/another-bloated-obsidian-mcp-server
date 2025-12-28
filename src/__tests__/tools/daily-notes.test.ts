/**
 * Tests for daily-notes tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleGetDailyNote,
  handleCreateDailyNote,
  handleListDailyNotes,
  handleAppendToDaily,
  getDailyNoteSchema,
  createDailyNoteSchema,
  listDailyNotesSchema,
  appendToDailySchema,
  dailyNotesTools,
} from '../../tools/daily-notes.js';
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

describe('daily-notes tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

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
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('getDailyNoteSchema should accept optional date', () => {
      expect(() => getDailyNoteSchema.parse({})).not.toThrow();
      expect(() => getDailyNoteSchema.parse({ date: '2024-01-15' })).not.toThrow();
    });

    it('createDailyNoteSchema should accept optional date', () => {
      expect(() => createDailyNoteSchema.parse({})).not.toThrow();
      expect(() => createDailyNoteSchema.parse({ date: '2024-01-15' })).not.toThrow();
    });

    it('listDailyNotesSchema should accept optional parameters', () => {
      expect(() => listDailyNotesSchema.parse({})).not.toThrow();
      expect(() => listDailyNotesSchema.parse({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        limit: 10,
      })).not.toThrow();
    });

    it('listDailyNotesSchema should have correct default limit', () => {
      const parsed = listDailyNotesSchema.parse({});
      expect(parsed.limit).toBe(30);
    });

    it('appendToDailySchema should require content', () => {
      expect(() => appendToDailySchema.parse({ content: 'Test' })).not.toThrow();
      expect(() => appendToDailySchema.parse({ content: 'Test', date: '2024-01-15' })).not.toThrow();
      expect(() => appendToDailySchema.parse({})).toThrow();
    });
  });

  describe('dailyNotesTools', () => {
    it('should define 4 daily notes tools', () => {
      expect(dailyNotesTools.length).toBe(4);
      const names = dailyNotesTools.map(t => t.name);
      expect(names).toContain('get_daily_note');
      expect(names).toContain('create_daily_note');
      expect(names).toContain('list_daily_notes');
      expect(names).toContain('append_to_daily');
    });
  });

  describe('handleGetDailyNote', () => {
    it('should get existing daily note', async () => {
      const result = await handleGetDailyNote({ date: '2024-01-15' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.path).toBe('Daily/2024-01-15.md');
      expect(data.date).toBe('2024-01-15');
      expect(data.created).toBe(false);
      expect(data.content).toContain('Daily note content');
    });

    it('should create daily note if not exists', async () => {
      const result = await handleGetDailyNote({ date: '2024-01-20' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.path).toBe('Daily/2024-01-20.md');
      expect(data.created).toBe(true);
    });

    it('should default to today if no date provided', async () => {
      const result = await handleGetDailyNote({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.date).toBeDefined();
      expect(data.path).toBeDefined();
    });
  });

  describe('handleCreateDailyNote', () => {
    it('should create new daily note', async () => {
      const result = await handleCreateDailyNote({ date: '2024-01-20' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.created).toBe(true);
      expect(data.message).toContain('created');
    });

    it('should return existing daily note without error', async () => {
      const result = await handleCreateDailyNote({ date: '2024-01-15' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.created).toBe(false);
      expect(data.message).toContain('exists');
    });
  });

  describe('handleListDailyNotes', () => {
    it('should list all daily notes', async () => {
      const result = await handleListDailyNotes({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(3);
      expect(data.totalFound).toBe(3);
      expect(data.config.folder).toBe('Daily');
    });

    it('should filter by date range', async () => {
      const result = await handleListDailyNotes({
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(1);
      expect(data.notes[0].date).toBe('2024-01-15');
    });

    it('should respect limit', async () => {
      const result = await handleListDailyNotes({ limit: 2 });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      expect(data.totalFound).toBe(3);
    });

    it('should include config information', async () => {
      const result = await handleListDailyNotes({});

      const data = JSON.parse(result.content[0].text);
      expect(data.config).toBeDefined();
      expect(data.config.format).toBe('YYYY-MM-DD');
    });
  });

  describe('handleAppendToDaily', () => {
    it('should append content to existing daily note', async () => {
      const result = await handleAppendToDaily({
        content: '\n## New Section',
        date: '2024-01-15',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.path).toBe('Daily/2024-01-15.md');

      // Verify content was appended
      const content = vol.readFileSync(`${VAULT_PATH}/Daily/2024-01-15.md`, 'utf8') as string;
      expect(content).toContain('Daily note content');
      expect(content).toContain('## New Section');
    });

    it('should create daily note and append if not exists', async () => {
      const result = await handleAppendToDaily({
        content: '## First Entry',
        date: '2024-01-25',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);

      // Verify note was created with appended content
      const content = vol.readFileSync(`${VAULT_PATH}/Daily/2024-01-25.md`, 'utf8') as string;
      expect(content).toContain('## First Entry');
    });

    it('should report appended character count', async () => {
      const result = await handleAppendToDaily({
        content: '12345',
        date: '2024-01-15',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.appended).toBe('5 characters');
    });
  });
});
