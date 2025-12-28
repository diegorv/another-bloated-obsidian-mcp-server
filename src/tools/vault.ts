/**
 * Vault management tools
 */

import { z } from 'zod';
import {
  listVaults,
  setActiveVault,
  getActiveVaultName,
  registerVault,
} from '../services/vault-manager.js';
import { formatError } from '../utils/errors.js';

// Schema definitions
export const listVaultsSchema = z.object({});

export const setActiveVaultSchema = z.object({
  vault: z.string().describe('Name of the vault to set as active'),
});

export const registerVaultSchema = z.object({
  name: z.string().describe('Name to identify the vault'),
  path: z.string().describe('Absolute path to the vault directory'),
});

// Tool implementations
export async function handleListVaults() {
  try {
    const vaults = await listVaults();
    const active = await getActiveVaultName().catch(() => null);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              vaults: vaults.map((v) => v.name),
              active: active || '',
              details: vaults,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleSetActiveVault(args: z.infer<typeof setActiveVaultSchema>) {
  try {
    await setActiveVault(args.vault);
    const active = await getActiveVaultName();

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, vault: active }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

export async function handleRegisterVault(args: z.infer<typeof registerVaultSchema>) {
  try {
    await registerVault(args.name, args.path);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: `Vault "${args.name}" registered at ${args.path}`,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: formatError(error) }),
        },
      ],
      isError: true,
    };
  }
}

// Tool definitions for MCP
export const vaultTools = [
  {
    name: 'list_vaults',
    description: 'List all configured Obsidian vaults and show which one is currently active',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'set_active_vault',
    description: 'Set the active vault for subsequent operations',
    inputSchema: {
      type: 'object' as const,
      properties: {
        vault: {
          type: 'string',
          description: 'Name of the vault to set as active',
        },
      },
      required: ['vault'],
    },
  },
  {
    name: 'register_vault',
    description: 'Register a new Obsidian vault with a name and path',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name to identify the vault',
        },
        path: {
          type: 'string',
          description: 'Absolute path to the vault directory',
        },
      },
      required: ['name', 'path'],
    },
  },
];
