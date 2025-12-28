/**
 * Vault management service
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  loadConfig,
  getVaults,
  getDefaultVault,
  setDefaultVault,
  addVault,
  getVaultPath,
} from '../config.js';
import { VaultNotFoundError } from '../utils/errors.js';

// Active vault state (can be different from default)
let activeVaultName: string | null = null;

/**
 * Gets the currently active vault name
 */
export async function getActiveVaultName(): Promise<string> {
  if (activeVaultName) {
    return activeVaultName;
  }

  const defaultVault = await getDefaultVault();
  if (!defaultVault) {
    throw new Error('No vaults configured. Please add a vault first.');
  }

  activeVaultName = defaultVault;
  return activeVaultName;
}

/**
 * Gets the path of the currently active vault
 */
export async function getActiveVaultPath(): Promise<string> {
  const vaultName = await getActiveVaultName();
  const vaultPath = await getVaultPath(vaultName);

  if (!vaultPath) {
    throw new VaultNotFoundError(vaultName);
  }

  return vaultPath;
}

/**
 * Sets the active vault for the current session
 */
export async function setActiveVault(name: string): Promise<void> {
  const vaultPath = await getVaultPath(name);

  if (!vaultPath) {
    throw new VaultNotFoundError(name);
  }

  // Verify vault path exists
  try {
    const stats = await fs.stat(vaultPath);
    if (!stats.isDirectory()) {
      throw new Error(`Vault path is not a directory: ${vaultPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Vault directory does not exist: ${vaultPath}`);
    }
    throw error;
  }

  activeVaultName = name;
}

/**
 * Lists all configured vaults with their paths
 */
export async function listVaults(): Promise<{ name: string; path: string; isActive: boolean }[]> {
  const vaults = await getVaults();
  const activeName = await getActiveVaultName().catch(() => null);

  return Object.entries(vaults).map(([name, vaultPath]) => ({
    name,
    path: vaultPath,
    isActive: name === activeName,
  }));
}

/**
 * Registers a new vault
 */
export async function registerVault(name: string, vaultPath: string): Promise<void> {
  // Normalize and validate path
  const normalizedPath = path.resolve(vaultPath);

  // Verify path exists and is a directory
  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${normalizedPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Directory does not exist: ${normalizedPath}`);
    }
    throw error;
  }

  // Check if it looks like an Obsidian vault
  const obsidianDir = path.join(normalizedPath, '.obsidian');
  try {
    await fs.access(obsidianDir);
  } catch {
    // Not strictly required, but warn
    console.warn(`Warning: ${normalizedPath} does not appear to be an Obsidian vault (no .obsidian folder)`);
  }

  await addVault(name, normalizedPath);
}

/**
 * Clears the active vault state (useful for testing)
 */
export function clearActiveVault(): void {
  activeVaultName = null;
}
