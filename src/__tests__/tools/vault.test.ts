/**
 * Tests for vault tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleListVaults,
  handleSetActiveVault,
  handleRegisterVault,
  listVaultsSchema,
  setActiveVaultSchema,
  registerVaultSchema,
  vaultTools,
} from '../../tools/vault.js';
import { clearActiveVault } from '../../services/vault-manager.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

// Mock state for config
const createMockState = () => ({
  vaults: {
    default: '/vaults/default',
    secondary: '/vaults/secondary',
  } as Record<string, string>,
  defaultVault: 'default',
});

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

describe('vault tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();
    mockState = createMockState();

    vol.fromJSON({
      '/vaults/default/.obsidian/config.json': '{}',
      '/vaults/secondary/.obsidian/config.json': '{}',
      '/vaults/new-vault/.obsidian/config.json': '{}',
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('listVaultsSchema should accept empty object', () => {
      expect(() => listVaultsSchema.parse({})).not.toThrow();
    });

    it('setActiveVaultSchema should require vault', () => {
      expect(() => setActiveVaultSchema.parse({ vault: 'test' })).not.toThrow();
      expect(() => setActiveVaultSchema.parse({})).toThrow();
    });

    it('registerVaultSchema should require name and path', () => {
      expect(() => registerVaultSchema.parse({ name: 'test', path: '/path' })).not.toThrow();
      expect(() => registerVaultSchema.parse({ name: 'test' })).toThrow();
      expect(() => registerVaultSchema.parse({ path: '/path' })).toThrow();
    });
  });

  describe('vaultTools', () => {
    it('should define list_vaults tool', () => {
      const tool = vaultTools.find(t => t.name === 'list_vaults');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('List');
    });

    it('should define set_active_vault tool', () => {
      const tool = vaultTools.find(t => t.name === 'set_active_vault');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain('vault');
    });

    it('should define register_vault tool', () => {
      const tool = vaultTools.find(t => t.name === 'register_vault');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain('name');
      expect(tool?.inputSchema.required).toContain('path');
    });
  });

  describe('handleListVaults', () => {
    it('should return list of vaults', async () => {
      const result = await handleListVaults();

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const data = JSON.parse(result.content[0].text);
      expect(data.vaults).toContain('default');
      expect(data.vaults).toContain('secondary');
    });

    it('should show active vault', async () => {
      const result = await handleListVaults();
      const data = JSON.parse(result.content[0].text);

      expect(data.active).toBe('default');
    });

    it('should include vault details', async () => {
      const result = await handleListVaults();
      const data = JSON.parse(result.content[0].text);

      expect(data.details).toBeDefined();
      expect(data.details.length).toBeGreaterThan(0);
      expect(data.details[0].name).toBeDefined();
      expect(data.details[0].path).toBeDefined();
    });
  });

  describe('handleSetActiveVault', () => {
    it('should set active vault successfully', async () => {
      const result = await handleSetActiveVault({ vault: 'secondary' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.vault).toBe('secondary');
    });

    it('should return error for non-existent vault', async () => {
      const result = await handleSetActiveVault({ vault: 'nonexistent' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleRegisterVault', () => {
    it('should register new vault successfully', async () => {
      const result = await handleRegisterVault({
        name: 'new-vault',
        path: '/vaults/new-vault',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.message).toContain('new-vault');
    });

    it('should return error for non-existent path', async () => {
      const result = await handleRegisterVault({
        name: 'bad',
        path: '/nonexistent/path',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('does not exist');
    });
  });
});
