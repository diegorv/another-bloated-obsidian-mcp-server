/**
 * Custom error types for the Obsidian MCP Server
 */

export class McpError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export class VaultNotFoundError extends McpError {
  constructor(vaultName: string) {
    super(`Vault not found: ${vaultName}`, 'VAULT_NOT_FOUND');
    this.name = 'VaultNotFoundError';
  }
}

export class NoteNotFoundError extends McpError {
  constructor(notePath: string) {
    super(`Note not found: ${notePath}`, 'NOTE_NOT_FOUND');
    this.name = 'NoteNotFoundError';
  }
}

export class PathTraversalError extends McpError {
  constructor(path: string) {
    super(`Path traversal detected: ${path}`, 'PATH_TRAVERSAL');
    this.name = 'PathTraversalError';
  }
}

export class InvalidPathError extends McpError {
  constructor(path: string, reason: string) {
    super(`Invalid path "${path}": ${reason}`, 'INVALID_PATH');
    this.name = 'InvalidPathError';
  }
}

export class NoteAlreadyExistsError extends McpError {
  constructor(notePath: string) {
    super(`Note already exists: ${notePath}`, 'NOTE_EXISTS');
    this.name = 'NoteAlreadyExistsError';
  }
}

export function formatError(error: unknown): string {
  if (error instanceof McpError) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
