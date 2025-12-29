/**
 * Attachment management tools
 */

import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getActiveVaultPath } from '../services/vault-manager.js';
import { validatePath, getRelativePath, shouldIgnorePath } from '../utils/path.js';
import { formatError } from '../utils/errors.js';

// Common attachment extensions
const ATTACHMENT_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.tif',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma',
  // Video
  '.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv',
  // Other
  '.zip', '.rar', '.7z', '.tar', '.gz', '.csv', '.json', '.xml',
]);

function isAttachment(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ATTACHMENT_EXTENSIONS.has(ext);
}

interface AttachmentInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  modified: string;
  type: string;
}

function getAttachmentType(ext: string): string {
  const lowerExt = ext.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.tif'].includes(lowerExt)) {
    return 'image';
  }
  if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'].includes(lowerExt)) {
    return 'document';
  }
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'].includes(lowerExt)) {
    return 'audio';
  }
  if (['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv'].includes(lowerExt)) {
    return 'video';
  }
  return 'other';
}

// Schema definitions
export const listAttachmentsSchema = z.object({
  folder: z.string().optional().describe('Folder to search for attachments'),
  type: z.enum(['image', 'document', 'audio', 'video', 'other', 'all']).optional().describe('Filter by attachment type'),
});

export const getAttachmentInfoSchema = z.object({
  path: z.string().describe('Path to the attachment file'),
});

export const findUnusedAttachmentsSchema = z.object({
  folder: z.string().optional().describe('Folder to search for attachments'),
});

export const getAttachmentsInNoteSchema = z.object({
  path: z.string().describe('Path to the note'),
});

// Tool implementations
export async function handleListAttachments(args: z.infer<typeof listAttachmentsSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const targetPath = args.folder ? validatePath(args.folder, vaultPath) : vaultPath;
    const attachments: AttachmentInfo[] = [];

    async function scanDir(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = getRelativePath(fullPath, vaultPath);

        if (shouldIgnorePath(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && isAttachment(entry.name)) {
          const ext = path.extname(entry.name);
          const type = getAttachmentType(ext);

          // Apply type filter
          const filterType = args.type ?? 'all';
          if (filterType !== 'all' && type !== filterType) {
            continue;
          }

          const stats = await fs.stat(fullPath);
          attachments.push({
            path: relativePath,
            name: entry.name,
            extension: ext,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type,
          });
        }
      }
    }

    await scanDir(targetPath);

    // Sort by modified date (newest first)
    attachments.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            attachments,
            count: attachments.length,
            totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
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

export async function handleGetAttachmentInfo(args: z.infer<typeof getAttachmentInfoSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const fullPath = validatePath(args.path, vaultPath);

    const stats = await fs.stat(fullPath);
    const ext = path.extname(args.path);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            path: args.path,
            name: path.basename(args.path),
            extension: ext,
            type: getAttachmentType(ext),
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            embedSyntax: `![[${path.basename(args.path)}]]`,
            linkSyntax: `[[${path.basename(args.path)}]]`,
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

export async function handleFindUnusedAttachments(args: z.infer<typeof findUnusedAttachmentsSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();

    // First, collect all attachments
    const attachments = new Map<string, AttachmentInfo>();

    async function scanForAttachments(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = getRelativePath(fullPath, vaultPath);

        if (shouldIgnorePath(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanForAttachments(fullPath);
        } else if (entry.isFile() && isAttachment(entry.name)) {
          const ext = path.extname(entry.name);
          const stats = await fs.stat(fullPath);
          attachments.set(entry.name.toLowerCase(), {
            path: relativePath,
            name: entry.name,
            extension: ext,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type: getAttachmentType(ext),
          });
        }
      }
    }

    // Then, scan all markdown files for attachment references
    const usedAttachments = new Set<string>();

    async function scanForReferences(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = getRelativePath(fullPath, vaultPath);

        if (shouldIgnorePath(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanForReferences(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = await fs.readFile(fullPath, 'utf-8');

          // Match wikilinks: ![[file]] or [[file]]
          const wikiLinkPattern = /!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
          let match;
          while ((match = wikiLinkPattern.exec(content)) !== null) {
            const linked = match[1].trim();
            const baseName = path.basename(linked).toLowerCase();
            usedAttachments.add(baseName);
          }

          // Match markdown links: ![alt](file) or [text](file)
          const mdLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
          while ((match = mdLinkPattern.exec(content)) !== null) {
            const linked = match[1].trim();
            if (!linked.startsWith('http://') && !linked.startsWith('https://')) {
              const baseName = path.basename(linked).toLowerCase();
              usedAttachments.add(baseName);
            }
          }
        }
      }
    }

    const targetPath = args.folder ? validatePath(args.folder, vaultPath) : vaultPath;
    await scanForAttachments(targetPath);
    await scanForReferences(vaultPath); // Scan all markdown files for references

    // Find unused attachments
    const unused: AttachmentInfo[] = [];
    for (const [name, info] of attachments) {
      if (!usedAttachments.has(name)) {
        unused.push(info);
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            unused,
            count: unused.length,
            totalSize: unused.reduce((sum, a) => sum + a.size, 0),
            totalAttachments: attachments.size,
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

export async function handleGetAttachmentsInNote(args: z.infer<typeof getAttachmentsInNoteSchema>) {
  try {
    const vaultPath = await getActiveVaultPath();
    const notePath = args.path.endsWith('.md') ? args.path : `${args.path}.md`;
    const fullPath = validatePath(notePath, vaultPath);

    const content = await fs.readFile(fullPath, 'utf-8');
    const attachmentsFound: Array<{ reference: string; name: string; type: 'embed' | 'link'; format: 'wikilink' | 'markdown' }> = [];

    // Match wiki embeds: ![[file]]
    const wikiEmbedPattern = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikiEmbedPattern.exec(content)) !== null) {
      const linked = match[1].trim();
      if (isAttachment(linked) || !linked.endsWith('.md')) {
        attachmentsFound.push({
          reference: match[0],
          name: linked,
          type: 'embed',
          format: 'wikilink',
        });
      }
    }

    // Match wiki links: [[file]] (without !)
    const wikiLinkPattern = /(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    while ((match = wikiLinkPattern.exec(content)) !== null) {
      const linked = match[1].trim();
      if (isAttachment(linked)) {
        attachmentsFound.push({
          reference: match[0],
          name: linked,
          type: 'link',
          format: 'wikilink',
        });
      }
    }

    // Match markdown embeds: ![alt](file)
    const mdEmbedPattern = /!\[[^\]]*\]\(([^)]+)\)/g;
    while ((match = mdEmbedPattern.exec(content)) !== null) {
      const linked = match[1].trim();
      if (!linked.startsWith('http://') && !linked.startsWith('https://')) {
        attachmentsFound.push({
          reference: match[0],
          name: path.basename(linked),
          type: 'embed',
          format: 'markdown',
        });
      }
    }

    // Match markdown links: [text](file) (without !)
    const mdLinkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
    while ((match = mdLinkPattern.exec(content)) !== null) {
      const linked = match[1].trim();
      if (!linked.startsWith('http://') && !linked.startsWith('https://') && isAttachment(linked)) {
        attachmentsFound.push({
          reference: match[0],
          name: path.basename(linked),
          type: 'link',
          format: 'markdown',
        });
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            note: args.path,
            attachments: attachmentsFound,
            count: attachmentsFound.length,
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

// Tool definitions for MCP
export const attachmentTools = [
  {
    name: 'list_attachments',
    description: 'List all non-markdown files (images, PDFs, etc.) in the vault. Can filter by folder and type.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        folder: {
          type: 'string',
          description: 'Folder to search for attachments',
        },
        type: {
          type: 'string',
          enum: ['image', 'document', 'audio', 'video', 'other', 'all'],
          description: 'Filter by attachment type (default: all)',
          default: 'all',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_attachment_info',
    description: 'Get detailed information about an attachment, including embed/link syntax.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the attachment file',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'find_unused_attachments',
    description: 'Find attachments that are not referenced by any note. Useful for cleaning up unused files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        folder: {
          type: 'string',
          description: 'Folder to search for attachments (references are always searched vault-wide)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_attachments_in_note',
    description: 'Get all attachment references (embeds and links) in a specific note.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the note',
        },
      },
      required: ['path'],
    },
  },
];
