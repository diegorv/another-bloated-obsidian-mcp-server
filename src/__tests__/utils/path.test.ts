/**
 * Tests for path validation and sanitization utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validatePath,
  getRelativePath,
  ensureMarkdownExtension,
  isMarkdownFile,
  getNoteName,
  validateNoteName,
  shouldIgnorePath,
} from '../../utils/path.js';
import { PathTraversalError, InvalidPathError } from '../../utils/errors.js';

describe('validatePath', () => {
  const basePath = '/vault';

  it('should return full path for valid relative path', () => {
    const result = validatePath('note.md', basePath);
    expect(result).toBe('/vault/note.md');
  });

  it('should handle nested paths', () => {
    const result = validatePath('folder/subfolder/note.md', basePath);
    expect(result).toBe('/vault/folder/subfolder/note.md');
  });

  it('should normalize paths with extra slashes', () => {
    const result = validatePath('folder//note.md', basePath);
    expect(result).toBe('/vault/folder/note.md');
  });

  it('should normalize paths with ./', () => {
    const result = validatePath('./note.md', basePath);
    expect(result).toBe('/vault/note.md');
  });

  it('should throw PathTraversalError for .. at start', () => {
    expect(() => validatePath('../outside.md', basePath)).toThrow(PathTraversalError);
  });

  it('should throw PathTraversalError for .. in middle escaping base', () => {
    expect(() => validatePath('folder/../../outside.md', basePath)).toThrow(PathTraversalError);
  });

  it('should throw PathTraversalError for absolute paths outside base', () => {
    expect(() => validatePath('/etc/passwd', basePath)).toThrow(PathTraversalError);
  });

  it('should allow .. that stays within base', () => {
    const result = validatePath('folder/../note.md', basePath);
    expect(result).toBe('/vault/note.md');
  });

  it('should handle empty path', () => {
    const result = validatePath('', basePath);
    expect(result).toBe('/vault');
  });
});

describe('getRelativePath', () => {
  it('should return relative path from base', () => {
    const result = getRelativePath('/vault/folder/note.md', '/vault');
    expect(result).toBe('folder/note.md');
  });

  it('should return empty string for base path itself', () => {
    const result = getRelativePath('/vault', '/vault');
    expect(result).toBe('');
  });

  it('should handle deeply nested paths', () => {
    const result = getRelativePath('/vault/a/b/c/d/note.md', '/vault');
    expect(result).toBe('a/b/c/d/note.md');
  });
});

describe('ensureMarkdownExtension', () => {
  it('should add .md to path without extension', () => {
    expect(ensureMarkdownExtension('note')).toBe('note.md');
  });

  it('should not modify path with .md extension', () => {
    expect(ensureMarkdownExtension('note.md')).toBe('note.md');
  });

  it('should not modify path with .markdown extension', () => {
    expect(ensureMarkdownExtension('note.markdown')).toBe('note.markdown');
  });

  it('should handle uppercase extensions', () => {
    expect(ensureMarkdownExtension('note.MD')).toBe('note.MD');
  });

  it('should not add .md to other file types', () => {
    expect(ensureMarkdownExtension('image.png')).toBe('image.png');
    expect(ensureMarkdownExtension('document.pdf')).toBe('document.pdf');
  });

  it('should handle paths with folders', () => {
    expect(ensureMarkdownExtension('folder/note')).toBe('folder/note.md');
    expect(ensureMarkdownExtension('folder/note.md')).toBe('folder/note.md');
  });

  it('should handle paths with dots in folder names', () => {
    expect(ensureMarkdownExtension('v1.0/release')).toBe('v1.0/release.md');
  });
});

describe('isMarkdownFile', () => {
  it('should return true for .md files', () => {
    expect(isMarkdownFile('note.md')).toBe(true);
    expect(isMarkdownFile('folder/note.md')).toBe(true);
  });

  it('should return true for .markdown files', () => {
    expect(isMarkdownFile('note.markdown')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isMarkdownFile('note.MD')).toBe(true);
    expect(isMarkdownFile('note.Md')).toBe(true);
    expect(isMarkdownFile('note.MARKDOWN')).toBe(true);
  });

  it('should return false for other extensions', () => {
    expect(isMarkdownFile('image.png')).toBe(false);
    expect(isMarkdownFile('document.pdf')).toBe(false);
    expect(isMarkdownFile('data.json')).toBe(false);
    expect(isMarkdownFile('script.js')).toBe(false);
  });

  it('should return false for files without extension', () => {
    expect(isMarkdownFile('README')).toBe(false);
    expect(isMarkdownFile('Makefile')).toBe(false);
  });
});

describe('getNoteName', () => {
  it('should return name without extension', () => {
    expect(getNoteName('note.md')).toBe('note');
  });

  it('should handle .markdown extension', () => {
    expect(getNoteName('note.markdown')).toBe('note');
  });

  it('should return full name for files without extension', () => {
    expect(getNoteName('README')).toBe('README');
  });

  it('should handle paths with folders', () => {
    expect(getNoteName('folder/subfolder/note.md')).toBe('note');
  });

  it('should handle names with dots', () => {
    expect(getNoteName('version.1.0.md')).toBe('version.1.0');
  });
});

describe('validateNoteName', () => {
  it('should accept valid note names', () => {
    expect(() => validateNoteName('valid-note')).not.toThrow();
    expect(() => validateNoteName('My Note')).not.toThrow();
    expect(() => validateNoteName('note_with_underscore')).not.toThrow();
    expect(() => validateNoteName('note123')).not.toThrow();
  });

  it('should throw for empty name', () => {
    expect(() => validateNoteName('')).toThrow(InvalidPathError);
  });

  it('should throw for whitespace-only name', () => {
    expect(() => validateNoteName('   ')).toThrow(InvalidPathError);
    expect(() => validateNoteName('\t\n')).toThrow(InvalidPathError);
  });

  it('should throw for names with < character', () => {
    expect(() => validateNoteName('note<name')).toThrow(InvalidPathError);
  });

  it('should throw for names with > character', () => {
    expect(() => validateNoteName('note>name')).toThrow(InvalidPathError);
  });

  it('should throw for names with : character', () => {
    expect(() => validateNoteName('note:name')).toThrow(InvalidPathError);
  });

  it('should throw for names with " character', () => {
    expect(() => validateNoteName('note"name')).toThrow(InvalidPathError);
  });

  it('should throw for names with | character', () => {
    expect(() => validateNoteName('note|name')).toThrow(InvalidPathError);
  });

  it('should throw for names with ? character', () => {
    expect(() => validateNoteName('note?name')).toThrow(InvalidPathError);
  });

  it('should throw for names with * character', () => {
    expect(() => validateNoteName('note*name')).toThrow(InvalidPathError);
  });

  it('should throw for names with \\ character', () => {
    expect(() => validateNoteName('note\\name')).toThrow(InvalidPathError);
  });

  it('should throw for Windows reserved names', () => {
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9'];
    reservedNames.forEach((name) => {
      expect(() => validateNoteName(name)).toThrow(InvalidPathError);
    });
  });

  it('should be case insensitive for reserved names', () => {
    expect(() => validateNoteName('con')).toThrow(InvalidPathError);
    expect(() => validateNoteName('Con')).toThrow(InvalidPathError);
    expect(() => validateNoteName('CON')).toThrow(InvalidPathError);
  });
});

describe('shouldIgnorePath', () => {
  it('should ignore hidden files and folders', () => {
    expect(shouldIgnorePath('.hidden')).toBe(true);
    expect(shouldIgnorePath('.hidden/file.md')).toBe(true);
    expect(shouldIgnorePath('folder/.hidden-file')).toBe(true);
  });

  it('should ignore .obsidian folder', () => {
    expect(shouldIgnorePath('.obsidian')).toBe(true);
    expect(shouldIgnorePath('.obsidian/config.json')).toBe(true);
    expect(shouldIgnorePath('.obsidian/plugins/plugin.js')).toBe(true);
  });

  it('should ignore .git folder', () => {
    expect(shouldIgnorePath('.git')).toBe(true);
    expect(shouldIgnorePath('.git/config')).toBe(true);
  });

  it('should ignore node_modules folder', () => {
    expect(shouldIgnorePath('node_modules')).toBe(true);
    expect(shouldIgnorePath('node_modules/package/index.js')).toBe(true);
  });

  it('should ignore .trash folder', () => {
    expect(shouldIgnorePath('.trash')).toBe(true);
    expect(shouldIgnorePath('.trash/deleted-note.md')).toBe(true);
  });

  it('should not ignore regular paths', () => {
    expect(shouldIgnorePath('note.md')).toBe(false);
    expect(shouldIgnorePath('folder/note.md')).toBe(false);
    expect(shouldIgnorePath('My Notes/Projects/note.md')).toBe(false);
  });

  it('should not ignore paths with similar names', () => {
    expect(shouldIgnorePath('not-hidden')).toBe(false);
    expect(shouldIgnorePath('obsidian-notes')).toBe(false);
    expect(shouldIgnorePath('git-guide.md')).toBe(false);
  });
});
