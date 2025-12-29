/**
 * Configuration management for Another bloated Obsidian MCP Server
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import type { Config } from './types/index.js';

/**
 * Zod schema for config validation
 * Ensures config structure is valid and prevents injection attacks
 */
const configSchema = z.object({
  vaults: z.record(z.string()),
  defaultVault: z.string(),
  options: z.object({
    dailyNotesFormat: z.string(),
    templatesFolder: z.string(),
  }).optional(),
});

/**
 * Validates that a relative path is safe (no path traversal)
 * Returns true if path is safe, false if it contains traversal attempts
 */
function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath) return true;

  // Reject absolute paths
  if (path.isAbsolute(relativePath)) {
    return false;
  }

  // Normalize and check for path traversal
  const normalized = path.normalize(relativePath);

  // Reject if it starts with .. or contains ../ or ..\
  if (normalized.startsWith('..') || normalized.includes('../') || normalized.includes('..\\')) {
    return false;
  }

  return true;
}

/**
 * Validates that a vault path exists and is a directory
 * Also checks for .obsidian folder to confirm it's a valid vault
 */
function isValidVaultPath(vaultPath: string): boolean {
  try {
    const stats = fsSync.statSync(vaultPath);
    if (!stats.isDirectory()) {
      return false;
    }
    // Check if .obsidian folder exists (indicates valid Obsidian vault)
    const obsidianPath = path.join(vaultPath, '.obsidian');
    try {
      const obsidianStats = fsSync.statSync(obsidianPath);
      return obsidianStats.isDirectory();
    } catch {
      // .obsidian folder doesn't exist - might still be a valid directory
      // but warn that it might not be an Obsidian vault
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Validates and sanitizes loaded config
 * Removes invalid vault paths and ensures structure is correct
 */
function validateAndSanitizeConfig(rawConfig: unknown): Config {
  // First, validate structure with Zod
  const parseResult = configSchema.safeParse(rawConfig);

  if (!parseResult.success) {
    // Invalid structure, return default config
    return { ...DEFAULT_CONFIG };
  }

  const config = parseResult.data;

  // Validate each vault path exists
  const validVaults: Record<string, string> = {};
  for (const [name, vaultPath] of Object.entries(config.vaults)) {
    if (isValidVaultPath(vaultPath)) {
      validVaults[name] = vaultPath;
    }
    // Invalid paths are silently removed for security
  }

  // Update default vault if it was removed
  let defaultVault = config.defaultVault;
  if (defaultVault && !validVaults[defaultVault]) {
    const vaultNames = Object.keys(validVaults);
    defaultVault = vaultNames[0] || '';
  }

  // Sanitize options - validate templatesFolder doesn't contain path traversal
  let options = config.options || DEFAULT_CONFIG.options;
  if (options && !isSafeRelativePath(options.templatesFolder)) {
    // Reset to default if templatesFolder contains path traversal
    options = {
      ...options,
      templatesFolder: DEFAULT_CONFIG.options.templatesFolder,
    };
  }

  return {
    vaults: validVaults,
    defaultVault,
    options,
  };
}

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
 * Validates vault paths exist to prevent config tampering attacks
 */
export async function loadConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const rawConfig = JSON.parse(content);
    // Validate and sanitize the config to prevent tampering attacks
    const config = validateAndSanitizeConfig(rawConfig);
    cachedConfig = config;
    return config;
  } catch {
    // Config doesn't exist or is invalid, return default
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
