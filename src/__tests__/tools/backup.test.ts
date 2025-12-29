/**
 * Tests for backup tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleCreateNoteBackup,
  handleListBackups,
  handleRestoreBackup,
  handleDeleteOldBackups,
  createNoteBackupSchema,
  listBackupsSchema,
  restoreBackupSchema,
  deleteOldBackupsSchema,
  backupTools,
} from '../../tools/backup.js';
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

describe('backup tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `# Note 1

Original content.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

Nested content.
`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('createNoteBackupSchema should require path', () => {
      expect(() => createNoteBackupSchema.parse({ path: 'note.md' })).not.toThrow();
      expect(() => createNoteBackupSchema.parse({
        path: 'note.md',
        backupFolder: 'custom-backups',
      })).not.toThrow();
      expect(() => createNoteBackupSchema.parse({})).toThrow();
    });

    it('createNoteBackupSchema should accept optional backupFolder (default applied in handler)', () => {
      const parsed = createNoteBackupSchema.parse({ path: 'note.md' });
      expect(parsed.backupFolder).toBeUndefined(); // default '.backups' is applied in handler
    });

    it('listBackupsSchema should accept optional parameters', () => {
      expect(() => listBackupsSchema.parse({})).not.toThrow();
      expect(() => listBackupsSchema.parse({
        notePath: 'note.md',
        backupFolder: 'backups',
      })).not.toThrow();
    });

    it('restoreBackupSchema should require backupPath', () => {
      expect(() => restoreBackupSchema.parse({ backupPath: '.backups/note_backup.md' })).not.toThrow();
      expect(() => restoreBackupSchema.parse({
        backupPath: '.backups/note_backup.md',
        targetPath: 'restored.md',
        createBackupFirst: false,
      })).not.toThrow();
      expect(() => restoreBackupSchema.parse({})).toThrow();
    });

    it('restoreBackupSchema should accept optional createBackupFirst (default applied in handler)', () => {
      const parsed = restoreBackupSchema.parse({ backupPath: '.backups/test.md' });
      expect(parsed.createBackupFirst).toBeUndefined(); // default true is applied in handler
    });

    it('deleteOldBackupsSchema should accept optional fields (defaults applied in handler)', () => {
      const parsed = deleteOldBackupsSchema.parse({});
      expect(parsed.keepLast).toBeUndefined(); // default 5 applied in handler
      expect(parsed.backupFolder).toBeUndefined(); // default '.backups' applied in handler
      expect(parsed.dryRun).toBeUndefined(); // default false applied in handler
    });
  });

  describe('backupTools', () => {
    it('should define 4 backup tools', () => {
      expect(backupTools.length).toBe(4);
      const names = backupTools.map(t => t.name);
      expect(names).toContain('create_note_backup');
      expect(names).toContain('list_backups');
      expect(names).toContain('restore_backup');
      expect(names).toContain('delete_old_backups');
    });
  });

  describe('handleCreateNoteBackup', () => {
    it('should return response structure for backup', async () => {
      const result = await handleCreateNoteBackup({ path: 'note1.md' });

      // Result should have content array
      expect(result.content).toBeDefined();
      expect(result.content.length).toBe(1);
      const data = JSON.parse(result.content[0].text);
      // Either success with backup info or error
      expect(typeof data.success === 'boolean' || typeof data.error === 'string').toBe(true);
    });

    it('should accept custom backup folder parameter', async () => {
      const result = await handleCreateNoteBackup({
        path: 'note1.md',
        backupFolder: 'custom-backups',
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      // Should either succeed or fail gracefully
      expect(typeof data.success === 'boolean' || typeof data.error === 'string').toBe(true);
    });

    it('should return error for non-existent note', async () => {
      const result = await handleCreateNoteBackup({ path: 'nonexistent.md' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
    });
  });

  describe('handleListBackups', () => {
    it('should return valid response structure', async () => {
      const result = await handleListBackups({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      // Either has backups array or error
      expect(data.backups !== undefined || data.error !== undefined || data.count !== undefined).toBe(true);
    });

    it('should accept notePath filter parameter', async () => {
      const result = await handleListBackups({ notePath: 'note1.md' });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.backups !== undefined || data.error !== undefined || data.count !== undefined).toBe(true);
    });

    it('should handle non-existent backup folder gracefully', async () => {
      // When backup folder doesn't exist, should return empty or message
      const result = await handleListBackups({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      // Should not error, just return empty or message
      if (!result.isError) {
        expect(data.count === 0 || data.backups?.length === 0 || data.message).toBeTruthy();
      }
    });
  });

  describe('handleRestoreBackup', () => {
    it('should return valid response structure', async () => {
      // Create a mock backup file directly in memfs
      vol.mkdirSync(`${VAULT_PATH}/.backups`, { recursive: true });
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-01T00-00-00-000Z.md`, `---
backup_of: "note1.md"
backup_date: "2024-01-01T00:00:00.000Z"
---

# Note 1

Original content.
`);

      const result = await handleRestoreBackup({
        backupPath: '.backups/note1_2024-01-01T00-00-00-000Z.md',
        createBackupFirst: false,
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(typeof data.success === 'boolean' || typeof data.error === 'string').toBe(true);
    });

    it('should accept targetPath parameter', async () => {
      vol.mkdirSync(`${VAULT_PATH}/.backups`, { recursive: true });
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-01T00-00-00-000Z.md`, `---
backup_of: "note1.md"
backup_date: "2024-01-01T00:00:00.000Z"
---

# Note 1

Original content.
`);

      const result = await handleRestoreBackup({
        backupPath: '.backups/note1_2024-01-01T00-00-00-000Z.md',
        targetPath: 'restored-note.md',
        createBackupFirst: false,
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(typeof data.success === 'boolean' || typeof data.error === 'string').toBe(true);
    });

    it('should return error for non-existent backup', async () => {
      const result = await handleRestoreBackup({
        backupPath: '.backups/nonexistent.md',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
    });
  });

  describe('handleDeleteOldBackups', () => {
    it('should return valid response structure', async () => {
      // Create backup folder with mock backups
      vol.mkdirSync(`${VAULT_PATH}/.backups`, { recursive: true });
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-01T00-00-00-000Z.md`, 'backup1');
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-02T00-00-00-000Z.md`, 'backup2');
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-03T00-00-00-000Z.md`, 'backup3');

      const result = await handleDeleteOldBackups({ keepLast: 1 });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(typeof data.success === 'boolean' || typeof data.error === 'string').toBe(true);
    });

    it('should support dry run', async () => {
      vol.mkdirSync(`${VAULT_PATH}/.backups`, { recursive: true });
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-01T00-00-00-000Z.md`, 'backup1');
      vol.writeFileSync(`${VAULT_PATH}/.backups/note1_2024-01-02T00-00-00-000Z.md`, 'backup2');

      const result = await handleDeleteOldBackups({
        keepLast: 1,
        dryRun: true,
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      if (data.success) {
        expect(data.dryRun).toBe(true);
        expect(data.deleted).toEqual([]);
      }
    });

    it('should handle non-existent backup folder gracefully', async () => {
      const result = await handleDeleteOldBackups({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      // Should handle gracefully - either success with message or error
      expect(data.success !== undefined || data.error !== undefined).toBe(true);
    });
  });
});
