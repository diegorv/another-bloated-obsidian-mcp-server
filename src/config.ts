/**
 * Configuration management for the Obsidian MCP Server
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Config } from './types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.obsidian-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  vaults: {},
  defaultVault: '',
  options: {
    dailyNotesFormat: 'YYYY-MM-DD',
    templatesFolder: 'Templates',
  },
};

let cachedConfig: Config | null = null;

/**
 * Ensures the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

/**
 * Loads the configuration from disk
 */
export async function loadConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config: Config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    cachedConfig = config;
    return config;
  } catch {
    // Config doesn't exist, return default
    const config: Config = { ...DEFAULT_CONFIG };
    cachedConfig = config;
    return config;
  }
}

/**
 * Saves the configuration to disk
 */
export async function saveConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
}

/**
 * Adds or updates a vault in the configuration
 */
export async function addVault(name: string, vaultPath: string): Promise<void> {
  const config = await loadConfig();
  config.vaults[name] = vaultPath;

  // Set as default if it's the first vault
  if (!config.defaultVault) {
    config.defaultVault = name;
  }

  await saveConfig(config);
}

/**
 * Removes a vault from the configuration
 */
export async function removeVault(name: string): Promise<void> {
  const config = await loadConfig();
  delete config.vaults[name];

  // Update default if needed
  if (config.defaultVault === name) {
    const vaultNames = Object.keys(config.vaults);
    config.defaultVault = vaultNames[0] || '';
  }

  await saveConfig(config);
}

/**
 * Gets the path for a vault by name
 */
export async function getVaultPath(name: string): Promise<string | null> {
  const config = await loadConfig();
  return config.vaults[name] || null;
}

/**
 * Gets all configured vaults
 */
export async function getVaults(): Promise<Record<string, string>> {
  const config = await loadConfig();
  return config.vaults;
}

/**
 * Gets the default vault name
 */
export async function getDefaultVault(): Promise<string> {
  const config = await loadConfig();
  return config.defaultVault;
}

/**
 * Sets the default vault
 */
export async function setDefaultVault(name: string): Promise<void> {
  const config = await loadConfig();
  if (!config.vaults[name]) {
    throw new Error(`Vault "${name}" not found`);
  }
  config.defaultVault = name;
  await saveConfig(config);
}

/**
 * Clears the config cache (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
