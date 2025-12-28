/**
 * Tests for filesystem service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  listNotes,
  readNote,
  createNote,
  updateNote,
  deleteNote,
  renameNote,
  moveNote,
  noteExists,
  getNoteStats,
} from '../../services/filesystem.js';
import {
  NoteNotFoundError,
  NoteAlreadyExistsError,
  FrontmatterConflictError,
} from '../../utils/errors.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const VAULT_PATH = '/test-vault';

describe('filesystem service', () => {
  beforeEach(() => {
    vol.reset();
    // Create basic vault structure
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note1.md`]: `---
title: Note 1
tags:
  - test
---

# Note 1

Content here.
`,
      [`${VAULT_PATH}/note2.md`]: `# Note 2

Simple note without frontmatter.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

In a subfolder.
`,
      [`${VAULT_PATH}/folder/deep/deeper.md`]: `# Deep Note

Very nested.
`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('listNotes', () => {
    it('should list all notes in vault', async () => {
      const result = await listNotes(VAULT_PATH);

      expect(result.total).toBe(4);
      expect(result.notes.map(n => n.name)).toContain('note1');
      expect(result.notes.map(n => n.name)).toContain('note2');
      expect(result.notes.map(n => n.name)).toContain('nested');
      expect(result.notes.map(n => n.name)).toContain('deeper');
    });

    it('should list notes in specific folder', async () => {
      const result = await listNotes(VAULT_PATH, { folder: 'folder' });

      expect(result.total).toBe(2);
      expect(result.notes.map(n => n.name)).toContain('nested');
      expect(result.notes.map(n => n.name)).toContain('deeper');
    });

    it('should list notes non-recursively', async () => {
      const result = await listNotes(VAULT_PATH, { recursive: false });

      expect(result.total).toBe(2);
      expect(result.notes.map(n => n.name)).toContain('note1');
      expect(result.notes.map(n => n.name)).toContain('note2');
      expect(result.notes.map(n => n.name)).not.toContain('nested');
    });

    it('should sort notes by name ascending', async () => {
      const result = await listNotes(VAULT_PATH, { sortBy: 'name', sortOrder: 'asc' });

      const names = result.notes.map(n => n.name);
      expect(names).toEqual([...names].sort());
    });

    it('should sort notes by name descending', async () => {
      const result = await listNotes(VAULT_PATH, { sortBy: 'name', sortOrder: 'desc' });

      const names = result.notes.map(n => n.name);
      expect(names).toEqual([...names].sort().reverse());
    });

    it('should apply pagination with limit', async () => {
      const result = await listNotes(VAULT_PATH, { limit: 2 });

      expect(result.notes.length).toBe(2);
      expect(result.total).toBe(4);
    });

    it('should apply pagination with offset', async () => {
      const result = await listNotes(VAULT_PATH, { limit: 2, offset: 2 });

      expect(result.notes.length).toBe(2);
      expect(result.total).toBe(4);
    });

    it('should filter by name pattern', async () => {
      const result = await listNotes(VAULT_PATH, { namePattern: '^note' });

      expect(result.total).toBe(2);
      expect(result.notes.every(n => n.name.startsWith('note'))).toBe(true);
    });

    it('should throw error for invalid name pattern regex', async () => {
      await expect(listNotes(VAULT_PATH, { namePattern: '[invalid' }))
        .rejects.toThrow('Invalid name pattern regex');
    });

    it('should ignore hidden files and .obsidian folder', async () => {
      const result = await listNotes(VAULT_PATH);

      const paths = result.notes.map(n => n.path);
      expect(paths.every(p => !p.includes('.obsidian'))).toBe(true);
    });
  });

  describe('readNote', () => {
    it('should read note with frontmatter', async () => {
      const result = await readNote(VAULT_PATH, 'note1.md');

      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter?.title).toBe('Note 1');
      expect(result.frontmatter?.tags).toEqual(['test']);
      expect(result.content).toContain('# Note 1');
    });

    it('should read note without frontmatter', async () => {
      const result = await readNote(VAULT_PATH, 'note2.md');

      expect(result.frontmatter).toBeUndefined();
      expect(result.content).toContain('# Note 2');
    });

    it('should auto-add .md extension', async () => {
      const result = await readNote(VAULT_PATH, 'note1');

      expect(result.frontmatter?.title).toBe('Note 1');
    });

    it('should throw NoteNotFoundError for non-existent note', async () => {
      await expect(readNote(VAULT_PATH, 'nonexistent.md'))
        .rejects.toThrow(NoteNotFoundError);
    });

    it('should read nested notes', async () => {
      const result = await readNote(VAULT_PATH, 'folder/nested.md');

      expect(result.content).toContain('# Nested Note');
    });
  });

  describe('createNote', () => {
    it('should create note without frontmatter', async () => {
      await createNote(VAULT_PATH, 'new-note.md', '# New Note\n\nContent');

      const result = await readNote(VAULT_PATH, 'new-note.md');
      expect(result.content).toContain('# New Note');
    });

    it('should create note with frontmatter', async () => {
      await createNote(VAULT_PATH, 'new-note.md', '# New Note', {
        title: 'New Note',
        tags: ['new'],
      });

      const result = await readNote(VAULT_PATH, 'new-note.md');
      expect(result.frontmatter?.title).toBe('New Note');
      expect(result.frontmatter?.tags).toEqual(['new']);
    });

    it('should auto-add .md extension', async () => {
      await createNote(VAULT_PATH, 'new-note', '# New Note');

      const exists = await noteExists(VAULT_PATH, 'new-note.md');
      expect(exists).toBe(true);
    });

    it('should create parent directories if needed', async () => {
      await createNote(VAULT_PATH, 'new-folder/sub/note.md', '# New Note');

      const result = await readNote(VAULT_PATH, 'new-folder/sub/note.md');
      expect(result.content).toContain('# New Note');
    });

    it('should throw NoteAlreadyExistsError for existing note', async () => {
      await expect(createNote(VAULT_PATH, 'note1.md', 'content'))
        .rejects.toThrow(NoteAlreadyExistsError);
    });
  });

  describe('updateNote', () => {
    it('should overwrite note content', async () => {
      await updateNote(VAULT_PATH, 'note2.md', '# Replaced Content', 'overwrite');

      const result = await readNote(VAULT_PATH, 'note2.md');
      expect(result.content).toBe('# Replaced Content');
    });

    it('should append content to note', async () => {
      await updateNote(VAULT_PATH, 'note2.md', '\n## Appended', 'append');

      const result = await readNote(VAULT_PATH, 'note2.md');
      expect(result.content).toContain('# Note 2');
      expect(result.content).toContain('## Appended');
    });

    it('should prepend content to note without frontmatter', async () => {
      await updateNote(VAULT_PATH, 'note2.md', '## Prepended\n\n', 'prepend');

      const result = await readNote(VAULT_PATH, 'note2.md');
      expect(result.content.indexOf('## Prepended')).toBeLessThan(
        result.content.indexOf('# Note 2')
      );
    });

    it('should prepend content after frontmatter', async () => {
      await updateNote(VAULT_PATH, 'note1.md', 'Prepended text\n\n', 'prepend');

      const content = vol.readFileSync(`${VAULT_PATH}/note1.md`, 'utf8') as string;
      // Frontmatter should still be at the beginning
      expect(content.startsWith('---')).toBe(true);
      expect(content).toContain('Prepended text');
    });

    it('should throw FrontmatterConflictError when prepending content with ---', async () => {
      await expect(
        updateNote(VAULT_PATH, 'note1.md', '---\ntitle: New\n---', 'prepend')
      ).rejects.toThrow(FrontmatterConflictError);
    });

    it('should allow prepending --- content with ignoreFrontmatterConflict', async () => {
      await updateNote(
        VAULT_PATH,
        'note1.md',
        '---\ntitle: New\n---',
        'prepend',
        { ignoreFrontmatterConflict: true }
      );

      const content = vol.readFileSync(`${VAULT_PATH}/note1.md`, 'utf8') as string;
      expect(content).toContain('title: New');
    });

    it('should replace text in note', async () => {
      const replacements = await updateNote(
        VAULT_PATH,
        'note2.md',
        'Replaced Note',
        'replace',
        { replaceOptions: { search: 'Note 2', replaceAll: false } }
      );

      expect(replacements).toBe(1);
      const result = await readNote(VAULT_PATH, 'note2.md');
      expect(result.content).toContain('Replaced Note');
      expect(result.content).not.toContain('Note 2');
    });

    it('should replace all occurrences with replaceAll', async () => {
      vol.writeFileSync(`${VAULT_PATH}/test.md`, 'word word word');

      const replacements = await updateNote(
        VAULT_PATH,
        'test.md',
        'replaced',
        'replace',
        { replaceOptions: { search: 'word', replaceAll: true } }
      );

      expect(replacements).toBe(3);
      const result = await readNote(VAULT_PATH, 'test.md');
      expect(result.content).toBe('replaced replaced replaced');
    });

    it('should support regex replacement', async () => {
      vol.writeFileSync(`${VAULT_PATH}/test.md`, 'Date: 15-01-2024');

      await updateNote(
        VAULT_PATH,
        'test.md',
        '$3-$2-$1',
        'replace',
        {
          replaceOptions: {
            search: '(\\d{2})-(\\d{2})-(\\d{4})',
            useRegex: true,
            replaceAll: false,
          },
        }
      );

      const result = await readNote(VAULT_PATH, 'test.md');
      expect(result.content).toBe('Date: 2024-01-15');
    });

    it('should throw NoteNotFoundError for non-existent note', async () => {
      await expect(updateNote(VAULT_PATH, 'nonexistent.md', 'content', 'overwrite'))
        .rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('deleteNote', () => {
    it('should delete existing note', async () => {
      await deleteNote(VAULT_PATH, 'note2.md');

      const exists = await noteExists(VAULT_PATH, 'note2.md');
      expect(exists).toBe(false);
    });

    it('should throw NoteNotFoundError for non-existent note', async () => {
      await expect(deleteNote(VAULT_PATH, 'nonexistent.md'))
        .rejects.toThrow(NoteNotFoundError);
    });
  });

  describe('renameNote', () => {
    it('should rename note', async () => {
      await renameNote(VAULT_PATH, 'note2.md', 'renamed.md');

      const oldExists = await noteExists(VAULT_PATH, 'note2.md');
      const newExists = await noteExists(VAULT_PATH, 'renamed.md');
      expect(oldExists).toBe(false);
      expect(newExists).toBe(true);
    });

    it('should move note to different folder', async () => {
      await renameNote(VAULT_PATH, 'note2.md', 'folder/moved.md');

      const oldExists = await noteExists(VAULT_PATH, 'note2.md');
      const newExists = await noteExists(VAULT_PATH, 'folder/moved.md');
      expect(oldExists).toBe(false);
      expect(newExists).toBe(true);
    });

    it('should throw NoteNotFoundError for non-existent source', async () => {
      await expect(renameNote(VAULT_PATH, 'nonexistent.md', 'new.md'))
        .rejects.toThrow(NoteNotFoundError);
    });

    it('should throw NoteAlreadyExistsError when target exists', async () => {
      await expect(renameNote(VAULT_PATH, 'note1.md', 'note2.md'))
        .rejects.toThrow(NoteAlreadyExistsError);
    });

    it('should update links in other notes when updateLinks is true', async () => {
      // Create note with link
      vol.writeFileSync(`${VAULT_PATH}/linking.md`, 'Link to [[note2]]');

      const linksUpdated = await renameNote(VAULT_PATH, 'note2.md', 'renamed.md', true);

      const linkingContent = vol.readFileSync(`${VAULT_PATH}/linking.md`, 'utf8') as string;
      expect(linkingContent).toContain('[[renamed]]');
      expect(linksUpdated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('moveNote', () => {
    it('should move note to destination folder', async () => {
      const result = await moveNote(VAULT_PATH, 'note2.md', 'folder');

      expect(result.newPath).toBe('folder/note2.md');
      const oldExists = await noteExists(VAULT_PATH, 'note2.md');
      const newExists = await noteExists(VAULT_PATH, 'folder/note2.md');
      expect(oldExists).toBe(false);
      expect(newExists).toBe(true);
    });

    it('should move note to vault root', async () => {
      const result = await moveNote(VAULT_PATH, 'folder/nested.md', '');

      expect(result.newPath).toBe('nested.md');
    });

    it('should create destination folder if needed', async () => {
      const result = await moveNote(VAULT_PATH, 'note2.md', 'new/nested/folder');

      expect(result.newPath).toBe('new/nested/folder/note2.md');
    });
  });

  describe('noteExists', () => {
    it('should return true for existing note', async () => {
      const exists = await noteExists(VAULT_PATH, 'note1.md');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent note', async () => {
      const exists = await noteExists(VAULT_PATH, 'nonexistent.md');
      expect(exists).toBe(false);
    });

    it('should auto-add .md extension', async () => {
      const exists = await noteExists(VAULT_PATH, 'note1');
      expect(exists).toBe(true);
    });
  });

  describe('getNoteStats', () => {
    it('should return note statistics', async () => {
      const stats = await getNoteStats(VAULT_PATH, 'note1.md');

      expect(stats.created).toBeDefined();
      expect(stats.modified).toBeDefined();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should throw NoteNotFoundError for non-existent note', async () => {
      await expect(getNoteStats(VAULT_PATH, 'nonexistent.md'))
        .rejects.toThrow(NoteNotFoundError);
    });
  });
});
