/**
 * Backup tools for Obsidian vaults
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { validatePath, getRelativePath, shouldIgnorePath, ensureMarkdownExtension } from '../utils/path.js';
import { formatError, NoteNotFoundError } from '../utils/errors.js';

// Schema definitions
export const createNoteBackupSchema = z.object({
  path: z.string().describe('Path to the note to backup'),
  backupFolder: z.string().optional().default('.backups').describe('Folder to store backups (relative to vault)'),
});

export const listBackupsSchema = z.object({
  notePath: z.string().optional().describe('Filter backups for a specific note'),
  backupFolder: z.string().optional().default('.backups').describe('Folder where backups are stored'),
});

export const restoreBackupSchema = z.object({
  backupPath: z.string().describe('Path to the backup file to restore'),
  targetPath: z.string().optional().describe('Target path for restored note (defaults to original location)'),
  createBackupFirst: z.boolean().optional().default(true).describe('Create a backup of current note before restoring'),
});

export const deleteOldBackupsSchema = z.object({
  keepLast: z.number().optional().default(5).describe('Number of recent backups to keep per note'),
  backupFolder: z.string().optional().default('.backups').describe('Folder where backups are stored'),
  dryRun: z.boolean().optional().default(false).describe('If true, only report what would be deleted'),
});

interface BackupInfo {
  path: string;
  originalNote: string;
  timestamp: string;
  size: number;
}

function generateBackupFilename(notePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(notePath, '.md');
  const dirName = path.dirname(notePath);
  const safeDir = dirName === '.' ? '' : dirName.replace(/\//g, '_') + '_';
  return `${safeDir}${baseName}_${timestamp}.md`;
}

function parseBackupFilename(filename: string): { originalNote: string; timestamp: string } | null {
  // Match pattern: [folder_]notename_YYYY-MM-DDTHH-MM-SS-sssZ.md
  const match = filename.match(/^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.md$/);
  if (!match) return null;

  const nameWithFolder = match[1];
  const timestamp = match[2].replace(/-/g, (m, i, s) => {
    // Convert back to ISO format
    if (i === 4 || i === 7) return '-'; // Keep date separators
    if (i === 10) return 'T';
    if (i === 13 || i === 16) return ':';
    if (i === 19) return '.';
    return m;
  });

  // Reconstruct original path
  const parts = nameWithFolder.split('_');
  let originalNote: string;
  if (parts.length > 1) {
    const noteName = parts.pop()!;
    const folder = parts.join('/');
    originalNote = `${folder}/${noteName}.md`;
  } else {
    originalNote = `${nameWithFolder}.md`;
  }

  return { originalNote, timestamp };
}

// Tool implementations
export async function handleCreateNoteBackup(args: z.infer<typeof createNoteBackupSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const notePath = ensureMarkdownExtension(args.path);
    const fullNotePath = validatePath(notePath, vaultPath);

    // Check if note exists
    try {
      await fs.access(fullNotePath);
    } catch {
      throw new NoteNotFoundError(notePath);
    }

    // Create backup folder if it doesn't exist
    const backupFolderPath = validatePath(args.backupFolder, vaultPath);
    await fs.mkdir(backupFolderPath, { recursive: true });

    // Read note content
    const content = await fs.readFile(fullNotePath, 'utf-8');

    // Generate backup filename
    const backupFilename = generateBackupFilename(notePath);
    const backupPath = path.join(backupFolderPath, backupFilename);

    // Write backup with metadata header
    const backupContent = `---
backup_of: "${notePath}"
backup_date: "${new Date().toISOString()}"
---

${content}`;

    await fs.writeFile(backupPath, backupContent, 'utf-8');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            originalNote: notePath,
            backupPath: getRelativePath(backupPath, vaultPath),
            timestamp: new Date().toISOString(),
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

export async function handleListBackups(args: z.infer<typeof listBackupsSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const backupFolderPath = validatePath(args.backupFolder, vaultPath);

    // Check if backup folder exists
    try {
      await fs.access(backupFolderPath);
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              backups: [],
              count: 0,
              message: `Backup folder "${args.backupFolder}" does not exist`,
            }, null, 2),
          },
        ],
      };
    }

    const entries = await fs.readdir(backupFolderPath, { withFileTypes: true });
    const backups: BackupInfo[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const parsed = parseBackupFilename(entry.name);
      if (!parsed) continue;

      // Filter by note path if specified
      if (args.notePath) {
        const normalizedNotePath = ensureMarkdownExtension(args.notePath);
        if (parsed.originalNote !== normalizedNotePath) continue;
      }

      const fullPath = path.join(backupFolderPath, entry.name);
      const stats = await fs.stat(fullPath);

      backups.push({
        path: getRelativePath(fullPath, vaultPath),
        originalNote: parsed.originalNote,
        timestamp: parsed.timestamp,
        size: stats.size,
      });
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            backups,
            count: backups.length,
          }, null, 2),
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

export async function handleRestoreBackup(args: z.infer<typeof restoreBackupSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const backupFullPath = validatePath(args.backupPath, vaultPath);

    // Read backup file
    let backupContent: string;
    try {
      backupContent = await fs.readFile(backupFullPath, 'utf-8');
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Backup file not found: ${args.backupPath}`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Parse backup metadata to get original note path
    const metadataMatch = backupContent.match(/^---\n([\s\S]*?)\n---\n\n/);
    let originalNotePath: string | undefined;
    let contentWithoutMetadata = backupContent;

    if (metadataMatch) {
      const metadata = metadataMatch[1];
      const backupOfMatch = metadata.match(/backup_of:\s*"([^"]+)"/);
      if (backupOfMatch) {
        originalNotePath = backupOfMatch[1];
      }
      contentWithoutMetadata = backupContent.slice(metadataMatch[0].length);
    }

    const targetPath = args.targetPath
      ? ensureMarkdownExtension(args.targetPath)
      : originalNotePath;

    if (!targetPath) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'Could not determine target path. Please specify targetPath parameter.',
            }),
          },
        ],
        isError: true,
      };
    }

    const targetFullPath = validatePath(targetPath, vaultPath);

    // Create backup of current note if it exists
    let backupCreated: string | undefined;
    if (args.createBackupFirst) {
      try {
        await fs.access(targetFullPath);
        // Note exists, create backup
        const result = await handleCreateNoteBackup({ path: targetPath, backupFolder: '.backups' });
        const resultData = JSON.parse((result.content[0] as { text: string }).text);
        if (resultData.success) {
          backupCreated = resultData.backupPath;
        }
      } catch {
        // Note doesn't exist, no need to backup
      }
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetFullPath), { recursive: true });

    // Write restored content
    await fs.writeFile(targetFullPath, contentWithoutMetadata, 'utf-8');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            restoredTo: targetPath,
            fromBackup: args.backupPath,
            previousBackupCreated: backupCreated,
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

export async function handleDeleteOldBackups(args: z.infer<typeof deleteOldBackupsSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const backupFolderPath = validatePath(args.backupFolder, vaultPath);

    // Check if backup folder exists
    try {
      await fs.access(backupFolderPath);
    } catch {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              deleted: [],
              count: 0,
              message: `Backup folder "${args.backupFolder}" does not exist`,
            }),
          },
        ],
      };
    }

    const entries = await fs.readdir(backupFolderPath, { withFileTypes: true });

    // Group backups by original note
    const backupsByNote = new Map<string, Array<{ path: string; timestamp: string }>>();

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const parsed = parseBackupFilename(entry.name);
      if (!parsed) continue;

      const fullPath = path.join(backupFolderPath, entry.name);

      if (!backupsByNote.has(parsed.originalNote)) {
        backupsByNote.set(parsed.originalNote, []);
      }
      backupsByNote.get(parsed.originalNote)!.push({
        path: fullPath,
        timestamp: parsed.timestamp,
      });
    }

    const toDelete: string[] = [];

    for (const [, backups] of backupsByNote) {
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Mark older backups for deletion
      for (let i = args.keepLast; i < backups.length; i++) {
        toDelete.push(backups[i].path);
      }
    }

    const deleted: string[] = [];
    if (!args.dryRun) {
      for (const backupPath of toDelete) {
        try {
          await fs.unlink(backupPath);
          deleted.push(getRelativePath(backupPath, vaultPath));
        } catch {
          // Skip files that can't be deleted
        }
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            deleted: args.dryRun ? [] : deleted,
            wouldDelete: args.dryRun ? toDelete.map((p) => getRelativePath(p, vaultPath)) : undefined,
            count: args.dryRun ? toDelete.length : deleted.length,
            dryRun: args.dryRun,
          }, null, 2),
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
export const backupTools = [
  {
    name: 'create_note_backup',
    description: 'Create a backup copy of a note. Stores in .backups folder with timestamp.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note to backup',
        },
        backupFolder: {
          type: 'string',
          description: 'Folder to store backups (default: .backups)',
          default: '.backups',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_backups',
    description: 'List available backups. Can filter by specific note.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        notePath: {
          type: 'string',
          description: 'Filter backups for a specific note',
        },
        backupFolder: {
          type: 'string',
          description: 'Folder where backups are stored (default: .backups)',
          default: '.backups',
        },
      },
      required: [],
    },
  },
  {
    name: 'restore_backup',
    description: 'Restore a note from a backup. Optionally creates a backup of current content first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        backupPath: {
          type: 'string',
          description: 'Path to the backup file to restore',
        },
        targetPath: {
          type: 'string',
          description: 'Target path for restored note (defaults to original location)',
        },
        createBackupFirst: {
          type: 'boolean',
          description: 'Create a backup of current note before restoring (default: true)',
          default: true,
        },
      },
      required: ['backupPath'],
    },
  },
  {
    name: 'delete_old_backups',
    description: 'Delete old backups, keeping only the most recent ones per note.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        keepLast: {
          type: 'number',
          description: 'Number of recent backups to keep per note (default: 5)',
          default: 5,
        },
        backupFolder: {
          type: 'string',
          description: 'Folder where backups are stored (default: .backups)',
          default: '.backups',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only report what would be deleted without actually deleting',
          default: false,
        },
      },
      required: [],
    },
  },
];
