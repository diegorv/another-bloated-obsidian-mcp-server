/**
 * Tests for vault manager service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  getActiveVaultName,
  getActiveVaultPath,
  setActiveVault,
  listVaults,
  registerVault,
  clearActiveVault,
} from '../../services/vault-manager.js';
import { VaultNotFoundError } from '../../utils/errors.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

// Mock state - defined before vi.mock
const createMockState = () => {
  const vaults: Record<string, string> = {
    default: '/vaults/default',
    secondary: '/vaults/secondary',
  };
  const defaultVault = 'default';
  return { vaults, defaultVault };
};

// Create initial mock state
let mockState = createMockState();

// Mock config module
vi.mock('../../config.js', async () => {
  return {
    loadConfig: () => Promise.resolve({
      vaults: mockState.vaults,
      defaultVault: mockState.defaultVault,
    }),
    getVaults: () => Promise.resolve(mockState.vaults),
    getDefaultVault: () => Promise.resolve(mockState.defaultVault),
    setDefaultVault: vi.fn(),
    addVault: (name: string, path: string) => {
      mockState.vaults[name] = path;
      return Promise.resolve();
    },
    getVaultPath: (name: string) => Promise.resolve(mockState.vaults[name]),
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

describe('vault-manager service', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    // Reset mock state
    mockState = createMockState();

    // Create vault directories
    vol.fromJSON({
      '/vaults/default/.obsidian/config.json': '{}',
      '/vaults/secondary/.obsidian/config.json': '{}',
      '/vaults/new-vault/.obsidian/config.json': '{}',
      '/vaults/not-obsidian/file.txt': 'not a vault',
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('getActiveVaultName', () => {
    it('should return default vault if no active vault set', async () => {
      const name = await getActiveVaultName();

      expect(name).toBe('default');
    });

    it('should return previously set active vault', async () => {
      await setActiveVault('secondary');

      const name = await getActiveVaultName();

      expect(name).toBe('secondary');
    });
  });

  describe('getActiveVaultPath', () => {
    it('should return path of active vault', async () => {
      const path = await getActiveVaultPath();

      expect(path).toBe('/vaults/default');
    });

    it('should return path of explicitly set vault', async () => {
      await setActiveVault('secondary');

      const path = await getActiveVaultPath();

      expect(path).toBe('/vaults/secondary');
    });
  });

  describe('setActiveVault', () => {
    it('should set active vault', async () => {
      await setActiveVault('secondary');

      const name = await getActiveVaultName();
      expect(name).toBe('secondary');
    });

    it('should throw VaultNotFoundError for unknown vault', async () => {
      await expect(setActiveVault('nonexistent'))
        .rejects.toThrow(VaultNotFoundError);
    });

    it('should throw error if vault directory does not exist', async () => {
      mockState.vaults['missing'] = '/nonexistent/path';

      await expect(setActiveVault('missing'))
        .rejects.toThrow('Vault directory does not exist');
    });
  });

  describe('listVaults', () => {
    it('should list all configured vaults', async () => {
      const vaults = await listVaults();

      expect(vaults.length).toBeGreaterThanOrEqual(2);
      expect(vaults.find(v => v.name === 'default')).toBeDefined();
      expect(vaults.find(v => v.name === 'secondary')).toBeDefined();
    });

    it('should mark active vault', async () => {
      await setActiveVault('secondary');

      const vaults = await listVaults();

      const activeVault = vaults.find(v => v.isActive);
      expect(activeVault?.name).toBe('secondary');
    });

    it('should include vault paths', async () => {
      const vaults = await listVaults();

      const defaultVault = vaults.find(v => v.name === 'default');
      expect(defaultVault?.path).toBe('/vaults/default');
    });
  });

  describe('registerVault', () => {
    it('should register new vault', async () => {
      await registerVault('new-vault', '/vaults/new-vault');

      expect(mockState.vaults['new-vault']).toBe('/vaults/new-vault');
    });

    it('should throw error for non-existent directory', async () => {
      await expect(registerVault('bad', '/nonexistent'))
        .rejects.toThrow('Directory does not exist');
    });

    it('should warn if not an Obsidian vault', async () => {
      const logger = await import('../../utils/logger.js');

      await registerVault('not-obsidian', '/vaults/not-obsidian');

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('does not appear to be an Obsidian vault')
      );
    });

    it('should normalize path', async () => {
      await registerVault('test', '/vaults/../vaults/new-vault');

      expect(mockState.vaults['test']).toBe('/vaults/new-vault');
    });
  });

  describe('clearActiveVault', () => {
    it('should clear active vault state', async () => {
      await setActiveVault('secondary');
      clearActiveVault();

      const name = await getActiveVaultName();

      // Should fall back to default
      expect(name).toBe('default');
    });
  });
});
