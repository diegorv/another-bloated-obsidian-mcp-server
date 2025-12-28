/**
 * Real symlink escape tests
 *
 * These tests use the actual filesystem (not memfs) to test symlink protection.
 * They create real symlinks and verify the validatePath function blocks them.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validatePath } from '../../utils/path.js';
import { PathTraversalError } from '../../utils/errors.js';

describe('Symlink Escape Protection (Real Filesystem)', () => {
  let testDir: string;
  let vaultDir: string;
  let outsideDir: string;
  let secretFile: string;

  beforeEach(() => {
    // Create real temporary directories
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-test-'));
    vaultDir = path.join(testDir, 'vault');
    outsideDir = path.join(testDir, 'outside');

    // Create directory structure
    fs.mkdirSync(vaultDir, { recursive: true });
    fs.mkdirSync(path.join(vaultDir, '.obsidian'), { recursive: true });
    fs.mkdirSync(path.join(vaultDir, 'notes'), { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    // Create a secret file outside the vault
    secretFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(secretFile, 'SECRET DATA - SHOULD NOT BE ACCESSIBLE');

    // Create a normal note inside the vault
    fs.writeFileSync(path.join(vaultDir, 'notes', 'normal.md'), '# Normal Note');
  });

  afterEach(() => {
    // Clean up test directories
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should allow access to normal files inside vault', () => {
    const result = validatePath('notes/normal.md', vaultDir);
    expect(result).toContain(vaultDir);
    expect(fs.existsSync(result)).toBe(true);
  });

  it('should block symlink pointing to file outside vault', () => {
    // Create a symlink inside vault pointing to secret file outside
    const symlinkPath = path.join(vaultDir, 'notes', 'evil-link.md');

    try {
      fs.symlinkSync(secretFile, symlinkPath);
    } catch (err) {
      // Skip test if symlinks are not supported (e.g., Windows without admin)
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    // Verify symlink was created
    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);

    // validatePath should throw because the symlink points outside vault
    expect(() => validatePath('notes/evil-link.md', vaultDir)).toThrow(PathTraversalError);
  });

  it('should block symlink pointing to directory outside vault', () => {
    // Create a symlink to the outside directory
    const symlinkPath = path.join(vaultDir, 'notes', 'evil-dir');

    try {
      fs.symlinkSync(outsideDir, symlinkPath);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);

    // Trying to access a file through the symlink should be blocked
    expect(() => validatePath('notes/evil-dir/secret.txt', vaultDir)).toThrow(PathTraversalError);
  });

  it('should block nested symlinks escaping vault', () => {
    // Create a chain of symlinks
    const link1 = path.join(vaultDir, 'notes', 'link1');
    const link2 = path.join(vaultDir, 'notes', 'link2');

    try {
      // link2 -> outside directory
      fs.symlinkSync(outsideDir, link2);
      // link1 -> link2 (chain)
      fs.symlinkSync(link2, link1);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    // Following the chain should be blocked
    expect(() => validatePath('notes/link1/secret.txt', vaultDir)).toThrow(PathTraversalError);
  });

  it('should block symlink in parent directory pointing outside', () => {
    // Create a symlink in notes folder that points to outside
    const notesSymlink = path.join(vaultDir, 'evil-notes');

    try {
      fs.symlinkSync(outsideDir, notesSymlink);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    // Accessing files through the symlinked directory should fail
    expect(() => validatePath('evil-notes/secret.txt', vaultDir)).toThrow(PathTraversalError);
  });

  it('should block symlink pointing to sensitive system files', () => {
    // Try to create symlink to /etc/passwd (Unix) or similar
    const symlinkPath = path.join(vaultDir, 'notes', 'passwd-link');
    const targetPath = process.platform === 'win32' ? 'C:\\Windows\\System32\\config\\SAM' : '/etc/passwd';

    // Only create symlink if target exists
    if (!fs.existsSync(targetPath)) {
      console.log('Skipping test - target file does not exist:', targetPath);
      return;
    }

    try {
      fs.symlinkSync(targetPath, symlinkPath);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    expect(() => validatePath('notes/passwd-link', vaultDir)).toThrow(PathTraversalError);
  });

  it('should allow symlinks that stay within vault', () => {
    // Create a symlink inside vault pointing to another location inside vault
    const targetNote = path.join(vaultDir, 'notes', 'normal.md');
    const symlinkPath = path.join(vaultDir, 'notes', 'link-to-normal.md');

    try {
      fs.symlinkSync(targetNote, symlinkPath);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    // This should be allowed because it stays within vault
    const result = validatePath('notes/link-to-normal.md', vaultDir);
    expect(result).toContain(vaultDir);
  });

  it('should block symlink created after initial path check', () => {
    // This tests the TOCTOU scenario where a symlink could be created
    // between path validation and actual file access
    // Our implementation uses realpathSync which resolves at validation time

    const symlinkPath = path.join(vaultDir, 'notes', 'toctou-link.md');

    try {
      fs.symlinkSync(secretFile, symlinkPath);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    // The symlink exists and points outside - should be blocked
    expect(() => validatePath('notes/toctou-link.md', vaultDir)).toThrow(PathTraversalError);
  });

  it('should block relative symlinks escaping vault', () => {
    // Create a relative symlink that escapes via ../
    const symlinkPath = path.join(vaultDir, 'notes', 'relative-escape');

    try {
      // Create symlink with relative path that escapes
      fs.symlinkSync('../../outside', symlinkPath);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    expect(() => validatePath('notes/relative-escape/secret.txt', vaultDir)).toThrow(PathTraversalError);
  });

  it('should handle symlink to symlink chains', () => {
    // Create multiple levels of symlinks
    const innerLink = path.join(vaultDir, 'inner');
    const outerLink = path.join(vaultDir, 'outer');

    try {
      fs.symlinkSync(outsideDir, innerLink);
      fs.symlinkSync(innerLink, outerLink);
    } catch (err) {
      console.log('Skipping symlink test - symlinks not supported:', err);
      return;
    }

    // Both should be blocked
    expect(() => validatePath('inner/secret.txt', vaultDir)).toThrow(PathTraversalError);
    expect(() => validatePath('outer/secret.txt', vaultDir)).toThrow(PathTraversalError);
  });
});
