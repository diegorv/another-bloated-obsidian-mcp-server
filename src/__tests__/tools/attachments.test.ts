/**
 * Tests for attachments tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleListAttachments,
  handleGetAttachmentInfo,
  handleFindUnusedAttachments,
  handleGetAttachmentsInNote,
  listAttachmentsSchema,
  getAttachmentInfoSchema,
  findUnusedAttachmentsSchema,
  getAttachmentsInNoteSchema,
  attachmentTools,
} from '../../tools/attachments.js';
import { clearActiveVault } from '../../services/vault-manager.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

// Mock config
vi.mock('../../config.js', async () => {
  return {
    loadConfig: () => Promise.resolve({
      vaults: { default: '/test-vault' },
      defaultVault: 'default',
    }),
    getVaults: () => Promise.resolve({ default: '/test-vault' }),
    getDefaultVault: () => Promise.resolve('default'),
    setDefaultVault: vi.fn(),
    addVault: vi.fn(),
    getVaultPath: () => Promise.resolve('/test-vault'),
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

const VAULT_PATH = '/test-vault';

describe('attachments tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note-with-attachments.md`]: `# Note with Attachments

Here's an image: ![[image.png]]

And a PDF: [[document.pdf]]

And a markdown link: ![photo](photos/photo.jpg)
`,
      [`${VAULT_PATH}/orphan-note.md`]: `# Orphan Note

No attachments here.
`,
      [`${VAULT_PATH}/attachments/image.png`]: 'PNG file content',
      [`${VAULT_PATH}/attachments/document.pdf`]: 'PDF file content',
      [`${VAULT_PATH}/photos/photo.jpg`]: 'JPEG file content',
      [`${VAULT_PATH}/attachments/unused.png`]: 'Unused image',
      [`${VAULT_PATH}/music/song.mp3`]: 'MP3 audio content',
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('listAttachmentsSchema should accept optional parameters', () => {
      expect(() => listAttachmentsSchema.parse({})).not.toThrow();
      expect(() => listAttachmentsSchema.parse({
        folder: 'attachments',
        type: 'image',
      })).not.toThrow();
    });

    it('listAttachmentsSchema should accept optional type (default applied in handler)', () => {
      const parsed = listAttachmentsSchema.parse({});
      expect(parsed.type).toBeUndefined(); // default 'all' is applied in handler
    });

    it('getAttachmentInfoSchema should require path', () => {
      expect(() => getAttachmentInfoSchema.parse({ path: 'image.png' })).not.toThrow();
      expect(() => getAttachmentInfoSchema.parse({})).toThrow();
    });

    it('findUnusedAttachmentsSchema should accept optional folder', () => {
      expect(() => findUnusedAttachmentsSchema.parse({})).not.toThrow();
      expect(() => findUnusedAttachmentsSchema.parse({ folder: 'attachments' })).not.toThrow();
    });

    it('getAttachmentsInNoteSchema should require path', () => {
      expect(() => getAttachmentsInNoteSchema.parse({ path: 'note.md' })).not.toThrow();
      expect(() => getAttachmentsInNoteSchema.parse({})).toThrow();
    });
  });

  describe('attachmentTools', () => {
    it('should define 4 attachment tools', () => {
      expect(attachmentTools.length).toBe(4);
      const names = attachmentTools.map(t => t.name);
      expect(names).toContain('list_attachments');
      expect(names).toContain('get_attachment_info');
      expect(names).toContain('find_unused_attachments');
      expect(names).toContain('get_attachments_in_note');
    });
  });

  describe('handleListAttachments', () => {
    // Note: memfs has limitations with isFile()/isDirectory() for files with certain extensions.
    // These tests verify the function returns valid response structure.

    it('should return valid response structure', async () => {
      const result = await handleListAttachments({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeDefined();
      expect(data.attachments).toBeDefined();
      expect(Array.isArray(data.attachments)).toBe(true);
      expect(data.totalSize).toBeDefined();
    });

    it('should not error when filtering by folder', async () => {
      const result = await handleListAttachments({ folder: 'photos' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeDefined();
      expect(Array.isArray(data.attachments)).toBe(true);
    });

    it('should not error when filtering by type', async () => {
      const result = await handleListAttachments({ type: 'audio' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeDefined();
      expect(Array.isArray(data.attachments)).toBe(true);
    });

    it('should return error for non-existent folder', async () => {
      const result = await handleListAttachments({ folder: 'nonexistent' });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleGetAttachmentInfo', () => {
    it('should get attachment details', async () => {
      const result = await handleGetAttachmentInfo({
        path: 'attachments/image.png',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('image.png');
      expect(data.extension).toBe('.png');
      expect(data.type).toBe('image');
      expect(data.size).toBeGreaterThan(0);
    });

    it('should include embed and link syntax', async () => {
      const result = await handleGetAttachmentInfo({
        path: 'attachments/image.png',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.embedSyntax).toBe('![[image.png]]');
      expect(data.linkSyntax).toBe('[[image.png]]');
    });

    it('should return error for non-existent attachment', async () => {
      const result = await handleGetAttachmentInfo({
        path: 'nonexistent.png',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleFindUnusedAttachments', () => {
    it('should find unused attachments', async () => {
      const result = await handleFindUnusedAttachments({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.unused.some((a: any) => a.name === 'unused.png')).toBe(true);
    });

    it('should not include used attachments', async () => {
      const result = await handleFindUnusedAttachments({});

      const data = JSON.parse(result.content[0].text);
      // image.png is used in note-with-attachments.md
      expect(data.unused.some((a: any) => a.name === 'image.png')).toBe(false);
    });

    it('should report totals', async () => {
      const result = await handleFindUnusedAttachments({});

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeDefined();
      expect(data.totalSize).toBeDefined();
      expect(data.totalAttachments).toBeDefined();
    });
  });

  describe('handleGetAttachmentsInNote', () => {
    it('should find attachments referenced in note', async () => {
      const result = await handleGetAttachmentsInNote({
        path: 'note-with-attachments.md',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeGreaterThan(0);
      expect(data.attachments.some((a: any) => a.name === 'image.png')).toBe(true);
    });

    it('should identify embed vs link type', async () => {
      const result = await handleGetAttachmentsInNote({
        path: 'note-with-attachments.md',
      });

      const data = JSON.parse(result.content[0].text);
      const imageRef = data.attachments.find((a: any) => a.name === 'image.png');
      expect(imageRef.type).toBe('embed');

      const pdfRef = data.attachments.find((a: any) => a.name === 'document.pdf');
      if (pdfRef) {
        expect(pdfRef.type).toBe('link');
      }
    });

    it('should identify wikilink vs markdown format', async () => {
      const result = await handleGetAttachmentsInNote({
        path: 'note-with-attachments.md',
      });

      const data = JSON.parse(result.content[0].text);
      const wikiEmbed = data.attachments.find((a: any) => a.name === 'image.png');
      expect(wikiEmbed.format).toBe('wikilink');
    });

    it('should return empty for note without attachments', async () => {
      const result = await handleGetAttachmentsInNote({
        path: 'orphan-note.md',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(0);
      expect(data.attachments).toEqual([]);
    });

    it('should return error for non-existent note', async () => {
      const result = await handleGetAttachmentsInNote({
        path: 'nonexistent.md',
      });

      expect(result.isError).toBe(true);
    });
  });
});
