/**
 * Tests for notes tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleListNotes,
  handleReadNote,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  handleRenameNote,
  handleMoveNote,
  listNotesSchema,
  readNoteSchema,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  renameNoteSchema,
  moveNoteSchema,
  noteTools,
} from '../../tools/notes.js';
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

describe('notes tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `---
title: Note 1
tags:
  - test
---

# Note 1

Content of note 1.
`,
      [`${VAULT_PATH}/note2.md`]: `# Note 2

Simple note without frontmatter.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

Note in subfolder.
`,
      [`${VAULT_PATH}/folder/deep/deeper.md`]: `# Deep Note

Very nested.
`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('listNotesSchema should accept all optional params', () => {
      expect(() => listNotesSchema.parse({})).not.toThrow();
      expect(() => listNotesSchema.parse({
        folder: 'test',
        recursive: false,
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 10,
        offset: 5,
        namePattern: '^test',
      })).not.toThrow();
    });

    it('readNoteSchema should require path', () => {
      expect(() => readNoteSchema.parse({ path: 'test.md' })).not.toThrow();
      expect(() => readNoteSchema.parse({})).toThrow();
    });

    it('createNoteSchema should require path and content', () => {
      expect(() => createNoteSchema.parse({
        path: 'test.md',
        content: '# Test',
      })).not.toThrow();
      expect(() => createNoteSchema.parse({ path: 'test.md' })).toThrow();
      expect(() => createNoteSchema.parse({ content: '# Test' })).toThrow();
    });

    it('updateNoteSchema should require path and content', () => {
      expect(() => updateNoteSchema.parse({
        path: 'test.md',
        content: '# Updated',
      })).not.toThrow();
      expect(() => updateNoteSchema.parse({ path: 'test.md' })).toThrow();
    });

    it('deleteNoteSchema should require path', () => {
      expect(() => deleteNoteSchema.parse({ path: 'test.md' })).not.toThrow();
      expect(() => deleteNoteSchema.parse({})).toThrow();
    });

    it('renameNoteSchema should require oldPath and newPath', () => {
      expect(() => renameNoteSchema.parse({
        oldPath: 'old.md',
        newPath: 'new.md',
      })).not.toThrow();
      expect(() => renameNoteSchema.parse({ oldPath: 'old.md' })).toThrow();
    });

    it('moveNoteSchema should require path and destinationFolder', () => {
      expect(() => moveNoteSchema.parse({
        path: 'note.md',
        destinationFolder: 'folder',
      })).not.toThrow();
      expect(() => moveNoteSchema.parse({ path: 'note.md' })).toThrow();
    });
  });

  describe('noteTools', () => {
    it('should define all 7 note tools', () => {
      expect(noteTools.length).toBe(7);
      expect(noteTools.map(t => t.name)).toContain('list_notes');
      expect(noteTools.map(t => t.name)).toContain('read_note');
      expect(noteTools.map(t => t.name)).toContain('create_note');
      expect(noteTools.map(t => t.name)).toContain('update_note');
      expect(noteTools.map(t => t.name)).toContain('delete_note');
      expect(noteTools.map(t => t.name)).toContain('rename_note');
      expect(noteTools.map(t => t.name)).toContain('move_note');
    });
  });

  describe('handleListNotes', () => {
    it('should list all notes', async () => {
      const result = await handleListNotes({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(4);
      expect(data.total).toBe(4);
    });

    it('should filter by folder', async () => {
      const result = await handleListNotes({ folder: 'folder' });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });

    it('should list non-recursively', async () => {
      const result = await handleListNotes({ recursive: false });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
    });

    it('should apply pagination', async () => {
      const result = await handleListNotes({ limit: 2, offset: 0 });

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      expect(data.total).toBe(4);
      expect(data.hasMore).toBe(true);
    });

    it('should sort by name', async () => {
      const result = await handleListNotes({ sortBy: 'name', sortOrder: 'asc' });

      const data = JSON.parse(result.content[0].text);
      const names = data.notes.map((n: any) => n.name);
      expect(names).toEqual([...names].sort());
    });

    it('should filter by name pattern', async () => {
      const result = await handleListNotes({ namePattern: '^note' });

      const data = JSON.parse(result.content[0].text);
      expect(data.notes.every((n: any) => n.name.startsWith('note'))).toBe(true);
    });
  });

  describe('handleReadNote', () => {
    it('should read note with frontmatter', async () => {
      const result = await handleReadNote({ path: 'note1.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.frontmatter).toBeDefined();
      expect(data.frontmatter.title).toBe('Note 1');
      expect(data.content).toContain('# Note 1');
    });

    it('should read note without frontmatter', async () => {
      const result = await handleReadNote({ path: 'note2.md' });

      const data = JSON.parse(result.content[0].text);
      expect(data.frontmatter).toBeUndefined();
      expect(data.content).toContain('# Note 2');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleReadNote({ path: 'nonexistent.md' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('not found');
    });
  });

  describe('handleCreateNote', () => {
    it('should create note without frontmatter', async () => {
      const result = await handleCreateNote({
        path: 'new-note.md',
        content: '# New Note\n\nContent here.',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.path).toBe('new-note.md');
    });

    it('should create note with frontmatter', async () => {
      const result = await handleCreateNote({
        path: 'new-note.md',
        content: '# New Note',
        frontmatter: { title: 'New Note', tags: ['test'] },
      });

      expect(result.isError).toBeUndefined();

      // Verify frontmatter was added
      const readResult = await handleReadNote({ path: 'new-note.md' });
      const noteData = JSON.parse(readResult.content[0].text);
      expect(noteData.frontmatter.title).toBe('New Note');
    });

    it('should create parent directories', async () => {
      const result = await handleCreateNote({
        path: 'new/nested/note.md',
        content: '# Nested',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should return error for existing note', async () => {
      const result = await handleCreateNote({
        path: 'note1.md',
        content: '# Duplicate',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('exists');
    });
  });

  describe('handleUpdateNote', () => {
    it('should overwrite note content', async () => {
      const result = await handleUpdateNote({
        path: 'note2.md',
        content: '# Replaced Content',
        mode: 'overwrite',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.mode).toBe('overwrite');
    });

    it('should append to note', async () => {
      const result = await handleUpdateNote({
        path: 'note2.md',
        content: '\n\n## Appended',
        mode: 'append',
      });

      expect(result.isError).toBeUndefined();

      const readResult = await handleReadNote({ path: 'note2.md' });
      const noteData = JSON.parse(readResult.content[0].text);
      expect(noteData.content).toContain('# Note 2');
      expect(noteData.content).toContain('## Appended');
    });

    it('should prepend to note', async () => {
      const result = await handleUpdateNote({
        path: 'note2.md',
        content: '## Prepended\n\n',
        mode: 'prepend',
      });

      expect(result.isError).toBeUndefined();

      const readResult = await handleReadNote({ path: 'note2.md' });
      const noteData = JSON.parse(readResult.content[0].text);
      expect(noteData.content).toContain('## Prepended');
    });

    it('should replace text in note', async () => {
      const result = await handleUpdateNote({
        path: 'note2.md',
        content: 'Replaced Note 2',
        mode: 'replace',
        search: 'Note 2',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.replacements).toBe(1);
    });

    it('should require search for replace mode', async () => {
      const result = await handleUpdateNote({
        path: 'note2.md',
        content: 'replacement',
        mode: 'replace',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('search');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleUpdateNote({
        path: 'nonexistent.md',
        content: 'content',
        mode: 'overwrite',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleDeleteNote', () => {
    it('should delete note', async () => {
      const result = await handleDeleteNote({ path: 'note2.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe('note2.md');

      // Verify deletion
      const readResult = await handleReadNote({ path: 'note2.md' });
      expect(readResult.isError).toBe(true);
    });

    it('should return error for non-existent note', async () => {
      const result = await handleDeleteNote({ path: 'nonexistent.md' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
    });
  });

  describe('handleRenameNote', () => {
    it('should rename note', async () => {
      const result = await handleRenameNote({
        oldPath: 'note2.md',
        newPath: 'renamed.md',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.oldPath).toBe('note2.md');
      expect(data.newPath).toBe('renamed.md');

      // Verify rename
      const oldResult = await handleReadNote({ path: 'note2.md' });
      expect(oldResult.isError).toBe(true);

      const newResult = await handleReadNote({ path: 'renamed.md' });
      expect(newResult.isError).toBeUndefined();
    });

    it('should return error for non-existent note', async () => {
      const result = await handleRenameNote({
        oldPath: 'nonexistent.md',
        newPath: 'new.md',
      });

      expect(result.isError).toBe(true);
    });

    it('should return error when target exists', async () => {
      const result = await handleRenameNote({
        oldPath: 'note1.md',
        newPath: 'note2.md',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleMoveNote', () => {
    it('should move note to folder', async () => {
      const result = await handleMoveNote({
        path: 'note2.md',
        destinationFolder: 'folder',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.newPath).toBe('folder/note2.md');

      // Verify move
      const oldResult = await handleReadNote({ path: 'note2.md' });
      expect(oldResult.isError).toBe(true);

      const newResult = await handleReadNote({ path: 'folder/note2.md' });
      expect(newResult.isError).toBeUndefined();
    });

    it('should move note to vault root', async () => {
      const result = await handleMoveNote({
        path: 'folder/nested.md',
        destinationFolder: '',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.newPath).toBe('nested.md');
    });

    it('should return error for non-existent note', async () => {
      const result = await handleMoveNote({
        path: 'nonexistent.md',
        destinationFolder: 'folder',
      });

      expect(result.isError).toBe(true);
    });
  });
});
