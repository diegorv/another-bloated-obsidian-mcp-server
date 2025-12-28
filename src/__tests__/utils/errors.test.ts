/**
 * Tests for custom error classes
 */

import { describe, it, expect } from 'vitest';
import {
  McpError,
  VaultNotFoundError,
  NoteNotFoundError,
  PathTraversalError,
  InvalidPathError,
  NoteAlreadyExistsError,
  FrontmatterConflictError,
  formatError,
} from '../../utils/errors.js';

describe('McpError', () => {
  it('should create error with message and code', () => {
    const error = new McpError('Test error message', 'TEST_CODE');

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('McpError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(McpError);
  });

  it('should have a stack trace', () => {
    const error = new McpError('Test', 'CODE');
    expect(error.stack).toBeDefined();
  });
});

describe('VaultNotFoundError', () => {
  it('should create error with vault name', () => {
    const error = new VaultNotFoundError('my-vault');

    expect(error.message).toBe('Vault not found: my-vault');
    expect(error.code).toBe('VAULT_NOT_FOUND');
    expect(error.name).toBe('VaultNotFoundError');
    expect(error).toBeInstanceOf(McpError);
  });

  it('should handle special characters in vault name', () => {
    const error = new VaultNotFoundError('vault with spaces & symbols!');
    expect(error.message).toContain('vault with spaces & symbols!');
  });
});

describe('NoteNotFoundError', () => {
  it('should create error with note path', () => {
    const error = new NoteNotFoundError('path/to/note.md');

    expect(error.message).toBe('Note not found: path/to/note.md');
    expect(error.code).toBe('NOTE_NOT_FOUND');
    expect(error.name).toBe('NoteNotFoundError');
    expect(error).toBeInstanceOf(McpError);
  });

  it('should handle nested paths', () => {
    const error = new NoteNotFoundError('deeply/nested/folder/note.md');
    expect(error.message).toContain('deeply/nested/folder/note.md');
  });
});

describe('PathTraversalError', () => {
  it('should create error with path', () => {
    const error = new PathTraversalError('../outside');

    expect(error.message).toBe('Path traversal detected: ../outside');
    expect(error.code).toBe('PATH_TRAVERSAL');
    expect(error.name).toBe('PathTraversalError');
    expect(error).toBeInstanceOf(McpError);
  });

  it('should handle various traversal patterns', () => {
    const patterns = ['../..', '../../etc/passwd', 'folder/../../../outside'];
    patterns.forEach((pattern) => {
      const error = new PathTraversalError(pattern);
      expect(error.message).toContain(pattern);
      expect(error.code).toBe('PATH_TRAVERSAL');
    });
  });
});

describe('InvalidPathError', () => {
  it('should create error with path and reason', () => {
    const error = new InvalidPathError('invalid<>path', 'contains invalid characters');

    expect(error.message).toBe('Invalid path "invalid<>path": contains invalid characters');
    expect(error.code).toBe('INVALID_PATH');
    expect(error.name).toBe('InvalidPathError');
    expect(error).toBeInstanceOf(McpError);
  });

  it('should handle empty path', () => {
    const error = new InvalidPathError('', 'Note name cannot be empty');
    expect(error.message).toContain('Note name cannot be empty');
  });

  it('should handle reserved names', () => {
    const error = new InvalidPathError('CON', 'Note name is a reserved system name');
    expect(error.message).toContain('reserved system name');
  });
});

describe('NoteAlreadyExistsError', () => {
  it('should create error with note path', () => {
    const error = new NoteAlreadyExistsError('existing-note.md');

    expect(error.message).toBe('Note already exists: existing-note.md');
    expect(error.code).toBe('NOTE_EXISTS');
    expect(error.name).toBe('NoteAlreadyExistsError');
    expect(error).toBeInstanceOf(McpError);
  });
});

describe('FrontmatterConflictError', () => {
  it('should create error with note path', () => {
    const error = new FrontmatterConflictError('note.md');

    expect(error.message).toContain('note.md');
    expect(error.message).toContain('---');
    expect(error.message).toContain('ignoreFrontmatterConflict');
    expect(error.code).toBe('FRONTMATTER_CONFLICT');
    expect(error.name).toBe('FrontmatterConflictError');
    expect(error).toBeInstanceOf(McpError);
  });
});

describe('formatError', () => {
  it('should format McpError with code', () => {
    const error = new McpError('Test message', 'TEST_CODE');
    const formatted = formatError(error);

    expect(formatted).toBe('[TEST_CODE] Test message');
  });

  it('should format specialized errors', () => {
    const error = new VaultNotFoundError('my-vault');
    const formatted = formatError(error);

    expect(formatted).toBe('[VAULT_NOT_FOUND] Vault not found: my-vault');
  });

  it('should format regular Error', () => {
    const error = new Error('Regular error message');
    const formatted = formatError(error);

    expect(formatted).toBe('Regular error message');
  });

  it('should format string error', () => {
    const formatted = formatError('string error');
    expect(formatted).toBe('string error');
  });

  it('should format number error', () => {
    const formatted = formatError(404);
    expect(formatted).toBe('404');
  });

  it('should format object error', () => {
    const formatted = formatError({ error: 'object error' });
    expect(formatted).toBe('[object Object]');
  });

  it('should format null and undefined', () => {
    expect(formatError(null)).toBe('null');
    expect(formatError(undefined)).toBe('undefined');
  });
});
