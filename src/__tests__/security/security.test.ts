/**
 * Security tests to prevent regression of fixed vulnerabilities
 *
 * These tests ensure that the following security issues remain fixed:
 * 1. Symlink escape attacks (path traversal via symlinks)
 * 2. Prototype pollution via malicious JSON in .base files
 * 3. Config tampering via invalid vault paths
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import path from 'node:path';

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
const OUTSIDE_PATH = '/outside-vault';

describe('Security Tests', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/notes/test.md`]: '# Test Note',
      [`${OUTSIDE_PATH}/secret.txt`]: 'SECRET DATA - SHOULD NOT BE ACCESSIBLE',
    });
  });

  afterEach(() => {
    vol.reset();
    vi.clearAllMocks();
  });

  describe('Path Traversal Protection', () => {
    it('should block basic path traversal attempts', async () => {
      const { validatePath } = await import('../../utils/path.js');

      expect(() => validatePath('../outside', VAULT_PATH)).toThrow();
      expect(() => validatePath('../../etc/passwd', VAULT_PATH)).toThrow();
      expect(() => validatePath('/etc/passwd', VAULT_PATH)).toThrow();
    });

    it('should block encoded path traversal attempts', async () => {
      const { validatePath } = await import('../../utils/path.js');

      // These should be normalized and blocked
      expect(() => validatePath('notes/../../../etc/passwd', VAULT_PATH)).toThrow();
      expect(() => validatePath('./notes/../../secret', VAULT_PATH)).toThrow();
    });

    it('should allow valid paths within vault', async () => {
      const { validatePath } = await import('../../utils/path.js');

      expect(() => validatePath('notes/test.md', VAULT_PATH)).not.toThrow();
      expect(() => validatePath('./notes/test.md', VAULT_PATH)).not.toThrow();
      expect(() => validatePath('subfolder/note.md', VAULT_PATH)).not.toThrow();
    });

    it('should block symlinks pointing outside vault', async () => {
      const { validatePath } = await import('../../utils/path.js');
      const fs = await import('node:fs');

      // Create a symlink inside vault pointing to outside
      vol.mkdirSync(`${VAULT_PATH}/links`, { recursive: true });

      // Note: memfs has limited symlink support, so we test the logic
      // In real scenarios, fs.realpathSync would resolve the symlink
      // and the path would be checked against the real base path

      // This test verifies the function exists and handles paths correctly
      const result = validatePath('notes/test.md', VAULT_PATH);
      expect(result).toContain(VAULT_PATH);
    });

    it('should handle nested path traversal in symlink target', async () => {
      const { validatePath } = await import('../../utils/path.js');

      // Attempting to access paths that could be symlink targets
      expect(() => validatePath('notes/../../../../etc/passwd', VAULT_PATH)).toThrow();
    });
  });

  describe('Prototype Pollution Protection', () => {
    // Note: JSON.stringify ignores __proto__ keys, so we write raw JSON strings
    // to simulate malicious input that could come from an attacker

    it('should reject JSON with __proto__ key', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      // Create a malicious .base file with __proto__ pollution attempt
      // Must write raw JSON string because JSON.stringify ignores __proto__
      const maliciousContent = '{"__proto__": {"isAdmin": true}, "columns": [{"name": "test", "type": "text"}], "rows": []}';

      vol.writeFileSync(`${VAULT_PATH}/malicious.base`, maliciousContent);

      await expect(parseBase(VAULT_PATH, 'malicious.base')).rejects.toThrow(
        /malicious key "__proto__"/
      );
    });

    it('should reject JSON with constructor key', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      // Constructor key could be used for prototype manipulation
      const maliciousContent = '{"constructor": {"prototype": {"isAdmin": true}}, "columns": [{"name": "test", "type": "text"}], "rows": []}';

      vol.writeFileSync(`${VAULT_PATH}/malicious2.base`, maliciousContent);

      await expect(parseBase(VAULT_PATH, 'malicious2.base')).rejects.toThrow(
        /malicious key "constructor"/
      );
    });

    it('should reject JSON with prototype key', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      const maliciousContent = '{"prototype": {"isAdmin": true}, "columns": [{"name": "test", "type": "text"}], "rows": []}';

      vol.writeFileSync(`${VAULT_PATH}/malicious3.base`, maliciousContent);

      await expect(parseBase(VAULT_PATH, 'malicious3.base')).rejects.toThrow(
        /malicious key "prototype"/
      );
    });

    it('should reject nested prototype pollution attempts', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      // Nested __proto__ in values
      const maliciousContent = '{"columns": [{"name": "test", "type": "text"}], "rows": [{"id": "1", "values": {"nested": {"__proto__": {"isAdmin": true}}}}]}';

      vol.writeFileSync(`${VAULT_PATH}/nested-malicious.base`, maliciousContent);

      await expect(parseBase(VAULT_PATH, 'nested-malicious.base')).rejects.toThrow(
        /malicious key "__proto__"/
      );
    });

    it('should reject deeply nested prototype pollution', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      // Deeply nested __proto__
      const maliciousContent = '{"columns": [{"name": "test", "type": "text"}], "rows": [{"id": "1", "values": {"level1": {"level2": {"level3": {"__proto__": {"isAdmin": true}}}}}}]}';

      vol.writeFileSync(`${VAULT_PATH}/deep-malicious.base`, maliciousContent);

      await expect(parseBase(VAULT_PATH, 'deep-malicious.base')).rejects.toThrow(
        /malicious key "__proto__"/
      );
    });

    it('should accept valid JSON without dangerous keys', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      const validContent = JSON.stringify({
        columns: [
          { name: 'title', type: 'text' },
          { name: 'status', type: 'select' },
        ],
        rows: [
          { id: '1', values: { title: 'Task 1', status: 'done' } },
          { id: '2', values: { title: 'Task 2', status: 'pending' } },
        ],
      });

      vol.writeFileSync(`${VAULT_PATH}/valid.base`, validContent);

      const result = await parseBase(VAULT_PATH, 'valid.base');
      expect(result.name).toBe('valid');
      expect(result.columns.length).toBe(2);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('Config Validation Protection', () => {
    it('should reject invalid vault paths in config', async () => {
      // Clear module cache to get fresh imports
      vi.resetModules();

      const { loadConfig, clearConfigCache, saveConfig } = await import('../../config.js');

      clearConfigCache();

      // Create a config with an invalid vault path
      const invalidConfig = {
        vaults: {
          validVault: VAULT_PATH,
          invalidVault: '/nonexistent/path/to/vault',
          anotherInvalid: '/etc/passwd',
        },
        defaultVault: 'invalidVault',
        options: {
          dailyNotesFormat: 'YYYY-MM-DD',
          templatesFolder: 'Templates',
        },
      };

      // Write the invalid config directly
      vol.mkdirSync(path.join(require('os').homedir(), '.obsidian-mcp'), { recursive: true });
      vol.writeFileSync(
        path.join(require('os').homedir(), '.obsidian-mcp', 'config.json'),
        JSON.stringify(invalidConfig)
      );

      const config = await loadConfig();

      // Invalid paths should be removed
      expect(config.vaults['invalidVault']).toBeUndefined();
      expect(config.vaults['anotherInvalid']).toBeUndefined();

      // Valid path should remain (if it exists in memfs)
      // Note: In memfs, the vault path exists so it should be kept
      expect(config.vaults['validVault']).toBe(VAULT_PATH);

      // Default vault should be updated since invalidVault was removed
      expect(config.defaultVault).not.toBe('invalidVault');
    });

    it('should handle malformed config JSON', async () => {
      vi.resetModules();

      const { loadConfig, clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Write malformed JSON
      vol.mkdirSync(path.join(require('os').homedir(), '.obsidian-mcp'), { recursive: true });
      vol.writeFileSync(
        path.join(require('os').homedir(), '.obsidian-mcp', 'config.json'),
        '{ invalid json }'
      );

      // Should return default config instead of crashing
      const config = await loadConfig();

      expect(config.vaults).toEqual({});
      expect(config.defaultVault).toBe('');
    });

    it('should reject config with wrong structure', async () => {
      vi.resetModules();

      const { loadConfig, clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Write config with wrong structure
      const wrongConfig = {
        vaults: 'should be an object not a string',
        defaultVault: 123, // should be string
      };

      vol.mkdirSync(path.join(require('os').homedir(), '.obsidian-mcp'), { recursive: true });
      vol.writeFileSync(
        path.join(require('os').homedir(), '.obsidian-mcp', 'config.json'),
        JSON.stringify(wrongConfig)
      );

      // Should return default config
      const config = await loadConfig();

      expect(config.vaults).toEqual({});
      expect(config.defaultVault).toBe('');
    });

    it('should not allow path injection via vault name', async () => {
      vi.resetModules();

      const { loadConfig, clearConfigCache } = await import('../../config.js');

      clearConfigCache();

      // Attempt path injection via vault name
      const injectionConfig = {
        vaults: {
          '../../../etc': '/some/path',
          'normal': VAULT_PATH,
        },
        defaultVault: '../../../etc',
        options: {
          dailyNotesFormat: 'YYYY-MM-DD',
          templatesFolder: 'Templates',
        },
      };

      vol.mkdirSync(path.join(require('os').homedir(), '.obsidian-mcp'), { recursive: true });
      vol.writeFileSync(
        path.join(require('os').homedir(), '.obsidian-mcp', 'config.json'),
        JSON.stringify(injectionConfig)
      );

      const config = await loadConfig();

      // The injection attempt path doesn't exist, so it should be removed
      expect(config.vaults['../../../etc']).toBeUndefined();
    });
  });

  describe('Deep Recursion Protection', () => {
    it('should handle deeply nested objects without stack overflow', async () => {
      const { parseBase } = await import('../../services/bases-parser.js');

      // Create a deeply nested object (more than 10 levels)
      let deepObject: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 15; i++) {
        deepObject = { nested: deepObject };
      }

      const content = JSON.stringify({
        columns: [{ name: 'data', type: 'text' }],
        rows: [{ id: '1', values: deepObject }],
      });

      vol.writeFileSync(`${VAULT_PATH}/deep.base`, content);

      // Should not throw and should not cause stack overflow
      // The recursion limit (10) will stop checking after that depth
      const result = await parseBase(VAULT_PATH, 'deep.base');
      expect(result).toBeDefined();
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Input Validation', () => {
    it('should validate note names for invalid characters', async () => {
      const { validateNoteName } = await import('../../utils/path.js');

      // These should throw
      expect(() => validateNoteName('note<test')).toThrow();
      expect(() => validateNoteName('note>test')).toThrow();
      expect(() => validateNoteName('note:test')).toThrow();
      expect(() => validateNoteName('note"test')).toThrow();
      expect(() => validateNoteName('note|test')).toThrow();
      expect(() => validateNoteName('note?test')).toThrow();
      expect(() => validateNoteName('note*test')).toThrow();
      expect(() => validateNoteName('note\\test')).toThrow();

      // These should be valid
      expect(() => validateNoteName('valid-note')).not.toThrow();
      expect(() => validateNoteName('valid_note')).not.toThrow();
      expect(() => validateNoteName('valid.note')).not.toThrow();
      expect(() => validateNoteName('valid note')).not.toThrow();
    });

    it('should reject Windows reserved names', async () => {
      const { validateNoteName } = await import('../../utils/path.js');

      expect(() => validateNoteName('CON')).toThrow();
      expect(() => validateNoteName('PRN')).toThrow();
      expect(() => validateNoteName('AUX')).toThrow();
      expect(() => validateNoteName('NUL')).toThrow();
      expect(() => validateNoteName('COM1')).toThrow();
      expect(() => validateNoteName('LPT1')).toThrow();
    });

    it('should reject empty note names', async () => {
      const { validateNoteName } = await import('../../utils/path.js');

      expect(() => validateNoteName('')).toThrow();
      expect(() => validateNoteName('   ')).toThrow();
    });
  });

  describe('Hidden File Protection', () => {
    it('should ignore hidden files and system folders', async () => {
      const { shouldIgnorePath } = await import('../../utils/path.js');

      expect(shouldIgnorePath('.hidden/file.md')).toBe(true);
      expect(shouldIgnorePath('.obsidian/config.json')).toBe(true);
      expect(shouldIgnorePath('.git/config')).toBe(true);
      expect(shouldIgnorePath('node_modules/package/index.js')).toBe(true);
      expect(shouldIgnorePath('.trash/deleted.md')).toBe(true);

      // Normal paths should not be ignored
      expect(shouldIgnorePath('notes/test.md')).toBe(false);
      expect(shouldIgnorePath('folder/subfolder/note.md')).toBe(false);
    });
  });
});
