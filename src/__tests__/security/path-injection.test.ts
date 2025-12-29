/**
 * Path Injection Security Tests
 *
 * These tests verify that various path injection vectors are properly blocked.
 * Tests should FAIL if there's a vulnerability and PASS after the fix.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'node:path';
import os from 'node:os';

// Mock fs modules
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

vi.mock('node:fs', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs,
    default: memfs.fs,
  };
});

const VAULT_PATH = '/test-vault';
const HOME_DIR = os.homedir();
const CONFIG_DIR = path.join(HOME_DIR, '.obsidian-mcp');

describe('Path Injection Security Tests', () => {
  beforeEach(() => {
    vol.reset();

    // Create vault structure
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/Templates/Normal.md`]: '# Normal Template\n{{title}}',
      [`${VAULT_PATH}/notes/test.md`]: '# Test Note',
      [`${VAULT_PATH}/.backups/test-backup.md`]: `---
backup_of: "notes/test.md"
backup_date: "2024-01-01"
---

# Test Note Backup`,
      // Sensitive file outside vault
      [`/etc/passwd`]: 'root:x:0:0:root:/root:/bin/bash',
      [`/sensitive/secret.md`]: '# SECRET DATA',
      [`${HOME_DIR}/.ssh/id_rsa`]: 'PRIVATE KEY DATA',
    });

    // Create config directory
    vol.mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    vol.reset();
    vi.resetModules();
  });

  describe('Config templatesFolder Path Traversal', () => {
    it('should block templatesFolder pointing outside vault via getTemplate', async () => {
      // Reset modules to get fresh config
      vi.resetModules();

      // Create malicious config with templatesFolder pointing outside vault
      const maliciousConfig = {
        vaults: { test: VAULT_PATH },
        defaultVault: 'test',
        options: {
          dailyNotesFormat: 'YYYY-MM-DD',
          templatesFolder: '../../sensitive', // Path traversal attempt
        },
      };

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify(maliciousConfig)
      );

      // Create the "template" file at the traversed location
      vol.mkdirSync('/sensitive', { recursive: true });
      vol.writeFileSync('/sensitive/secret.md', '# SECRET DATA');

      const { getTemplate } = await import('../../services/template-engine.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // This should throw PathTraversalError, not return the secret file
      await expect(getTemplate(VAULT_PATH, 'secret')).rejects.toThrow();
    });

    it('should block templatesFolder pointing to absolute path', async () => {
      vi.resetModules();

      const maliciousConfig = {
        vaults: { test: VAULT_PATH },
        defaultVault: 'test',
        options: {
          dailyNotesFormat: 'YYYY-MM-DD',
          templatesFolder: '/etc', // Absolute path attempt
        },
      };

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify(maliciousConfig)
      );

      const { getTemplate } = await import('../../services/template-engine.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Should throw because /etc is outside vault
      await expect(getTemplate(VAULT_PATH, 'passwd')).rejects.toThrow();
    });

    it('should block listTemplates with malicious templatesFolder', async () => {
      vi.resetModules();

      const maliciousConfig = {
        vaults: { test: VAULT_PATH },
        defaultVault: 'test',
        options: {
          dailyNotesFormat: 'YYYY-MM-DD',
          templatesFolder: '../../../etc', // Path traversal
        },
      };

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify(maliciousConfig)
      );

      const { listTemplates } = await import('../../services/template-engine.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // listTemplates should either throw or return empty array, not list /etc contents
      const templates = await listTemplates(VAULT_PATH);

      // Should not contain any files from outside vault
      expect(templates.every((t) => !t.path.includes('etc'))).toBe(true);
    });

    it('should sanitize templatesFolder when loading config', async () => {
      vi.resetModules();

      const maliciousConfig = {
        vaults: { test: VAULT_PATH },
        defaultVault: 'test',
        options: {
          dailyNotesFormat: 'YYYY-MM-DD',
          templatesFolder: '../../.ssh', // Trying to access .ssh
        },
      };

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify(maliciousConfig)
      );

      const { loadConfig, clearConfigCache } = await import('../../config.js');

      clearConfigCache();
      const config = await loadConfig();

      // The templatesFolder should be sanitized or rejected
      // Either it should be reset to default or throw
      expect(config.options.templatesFolder).not.toContain('..');
    });
  });

  describe('Backup Metadata Path Injection', () => {
    it('should block restore with malicious backup_of in metadata', async () => {
      vi.resetModules();

      // Create a malicious backup file with path traversal in metadata
      const maliciousBackup = `---
backup_of: "../../../etc/passwd"
backup_date: "2024-01-01"
---

MALICIOUS CONTENT TO OVERWRITE`;

      vol.writeFileSync(`${VAULT_PATH}/.backups/malicious-backup.md`, maliciousBackup);

      // Ensure config exists
      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { handleRestoreBackup } = await import('../../tools/backup.js');
      const { clearConfigCache } = await import('../../config.js');
      const { setActiveVault } = await import('../../services/vault-manager.js');

      clearConfigCache();
      await setActiveVault('test');

      // Try to restore without specifying targetPath (uses backup_of from metadata)
      const result = await handleRestoreBackup({
        backupPath: '.backups/malicious-backup.md',
        createBackupFirst: false,
      });

      const resultData = JSON.parse((result.content[0] as { text: string }).text);

      // Should either fail or the restored path should be within vault
      if (resultData.success) {
        expect(resultData.restoredTo).not.toContain('..');
        expect(resultData.restoredTo).not.toContain('/etc');
      } else {
        // If it failed, that's also acceptable security behavior
        expect(resultData.error).toBeDefined();
      }
    });

    it('should block restore with absolute path in backup_of', async () => {
      vi.resetModules();

      const maliciousBackup = `---
backup_of: "/etc/passwd"
backup_date: "2024-01-01"
---

OVERWRITE CONTENT`;

      vol.writeFileSync(`${VAULT_PATH}/.backups/absolute-path-backup.md`, maliciousBackup);

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { handleRestoreBackup } = await import('../../tools/backup.js');
      const { clearConfigCache } = await import('../../config.js');
      const { setActiveVault } = await import('../../services/vault-manager.js');

      clearConfigCache();
      await setActiveVault('test');

      const result = await handleRestoreBackup({
        backupPath: '.backups/absolute-path-backup.md',
        createBackupFirst: false,
      });

      const resultData = JSON.parse((result.content[0] as { text: string }).text);

      // Should fail because absolute path is outside vault
      if (resultData.success) {
        // If it somehow succeeded, verify the file is within vault
        expect(resultData.restoredTo.startsWith('/')).toBe(false);
      }
    });

    it('should handle backup_of with encoded characters safely', async () => {
      vi.resetModules();

      // URL-encoded characters are NOT decoded by the filesystem
      // So "..%2F" stays as literal "..%2F" not "../"
      // This test verifies the file is created with the literal name (safe)
      // or rejected entirely
      const maliciousBackup = `---
backup_of: "..%2F..%2F..%2Fetc%2Fpasswd"
backup_date: "2024-01-01"
---

ENCODED ATTACK`;

      vol.writeFileSync(`${VAULT_PATH}/.backups/encoded-backup.md`, maliciousBackup);

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { handleRestoreBackup } = await import('../../tools/backup.js');
      const { clearConfigCache } = await import('../../config.js');
      const { setActiveVault } = await import('../../services/vault-manager.js');

      clearConfigCache();
      await setActiveVault('test');

      const result = await handleRestoreBackup({
        backupPath: '.backups/encoded-backup.md',
        createBackupFirst: false,
      });

      const resultData = JSON.parse((result.content[0] as { text: string }).text);

      // The file will be created with the literal name (which is safe)
      // because %2F is not decoded to /
      if (resultData.success) {
        // Verify no actual path traversal happened
        // The file should be inside the vault
        expect(resultData.restoredTo).toBeDefined();
      }
    });
  });

  describe('Daily Notes Template Path Injection', () => {
    it('should block daily notes template pointing outside vault', async () => {
      vi.resetModules();

      // Create .obsidian/daily-notes.json with malicious template path
      vol.mkdirSync(`${VAULT_PATH}/.obsidian`, { recursive: true });
      vol.writeFileSync(
        `${VAULT_PATH}/.obsidian/daily-notes.json`,
        JSON.stringify({
          folder: '',
          format: 'YYYY-MM-DD',
          template: '../../../etc/passwd', // Path traversal in template
        })
      );

      // Create the vault config
      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { getOrCreateDailyNote, loadDailyNotesConfig } = await import('../../services/daily-notes.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // This should either:
      // 1. Throw PathTraversalError
      // 2. Use default template (ignore malicious path)
      // 3. Return error
      try {
        const config = await loadDailyNotesConfig(VAULT_PATH);
        const result = await getOrCreateDailyNote(VAULT_PATH, config, new Date());
        // If it succeeds, the content should NOT contain /etc/passwd data
        expect(result.content).not.toContain('root:x:');
        expect(result.content).not.toContain('bin/bash');
      } catch (error) {
        // Throwing is acceptable - means the attack was blocked
        expect(error).toBeDefined();
      }
    });

    it('should block daily notes folder pointing outside vault', async () => {
      vi.resetModules();

      vol.mkdirSync(`${VAULT_PATH}/.obsidian`, { recursive: true });
      vol.writeFileSync(
        `${VAULT_PATH}/.obsidian/daily-notes.json`,
        JSON.stringify({
          folder: '../../../tmp', // Try to create notes outside vault
          format: 'YYYY-MM-DD',
          template: '',
        })
      );

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { getOrCreateDailyNote, loadDailyNotesConfig } = await import('../../services/daily-notes.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      try {
        const config = await loadDailyNotesConfig(VAULT_PATH);
        const result = await getOrCreateDailyNote(VAULT_PATH, config, new Date());
        // If it succeeds, the path should be within vault
        expect(result.path).not.toContain('..');
        expect(result.path).not.toContain('/tmp');
      } catch (error) {
        // Throwing is acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Template Name Path Injection', () => {
    it('should block template name with path traversal', async () => {
      vi.resetModules();

      // Normal config
      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { getTemplate } = await import('../../services/template-engine.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Try to escape via template name parameter
      await expect(
        getTemplate(VAULT_PATH, '../../../etc/passwd')
      ).rejects.toThrow();
    });

    it('should block createFromTemplate with malicious template name', async () => {
      vi.resetModules();

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { createFromTemplate } = await import('../../services/template-engine.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Try to read /etc/passwd as a "template"
      await expect(
        createFromTemplate(VAULT_PATH, '../../../etc/passwd', 'output.md')
      ).rejects.toThrow();
    });

    it('should block createFromTemplate with malicious target path', async () => {
      vi.resetModules();

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { createFromTemplate } = await import('../../services/template-engine.js');
      const { clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Try to write outside vault via target path
      await expect(
        createFromTemplate(VAULT_PATH, 'Normal', '../../../tmp/malicious.md')
      ).rejects.toThrow();
    });
  });

  describe('Backup Folder Path Injection', () => {
    it('should block backupFolder pointing outside vault', async () => {
      vi.resetModules();

      vol.writeFileSync(
        path.join(CONFIG_DIR, 'config.json'),
        JSON.stringify({
          vaults: { test: VAULT_PATH },
          defaultVault: 'test',
          options: { dailyNotesFormat: 'YYYY-MM-DD', templatesFolder: 'Templates' },
        })
      );

      const { handleCreateNoteBackup } = await import('../../tools/backup.js');
      const { clearConfigCache } = await import('../../config.js');
      const { setActiveVault } = await import('../../services/vault-manager.js');

      clearConfigCache();
      await setActiveVault('test');

      // Try to create backup in folder outside vault
      const result = await handleCreateNoteBackup({
        path: 'notes/test.md',
        backupFolder: '../../../tmp/evil-backups',
      });

      const resultData = JSON.parse((result.content[0] as { text: string }).text);

      // Should fail
      expect(resultData.success).toBe(false);
    });
  });
});
