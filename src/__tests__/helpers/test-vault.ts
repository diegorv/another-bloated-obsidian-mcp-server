/**
 * Test vault utilities for creating mock vault structures
 */

import { vol } from 'memfs';

export interface VaultStructure {
  [path: string]: string | null; // null for directories
}

/**
 * Default test vault path
 */
export const TEST_VAULT_PATH = '/test-vault';

/**
 * Creates a mock vault structure in the virtual filesystem
 */
export function createMockVault(structure: VaultStructure = {}): void {
  const defaultStructure: VaultStructure = {
    [`${TEST_VAULT_PATH}/.obsidian/`]: null,
    ...structure,
  };

  vol.fromJSON(
    Object.fromEntries(
      Object.entries(defaultStructure).map(([key, value]) => [
        key,
        value === null ? null : value,
      ])
    )
  );
}

/**
 * Resets the virtual filesystem
 */
export function resetMockVault(): void {
  vol.reset();
}

/**
 * Creates a basic vault with some sample notes
 */
export function createBasicVault(): void {
  createMockVault({
    [`${TEST_VAULT_PATH}/note1.md`]: `---
title: Note 1
tags:
  - test
  - sample
---

# Note 1

This is a test note with some content.

## Section 1

Some text with a [[note2]] link.
`,
    [`${TEST_VAULT_PATH}/note2.md`]: `---
title: Note 2
status: draft
---

# Note 2

Another note with #inline-tag and [[note1|Note One]].
`,
    [`${TEST_VAULT_PATH}/folder/nested-note.md`]: `# Nested Note

A note in a subfolder with [[note1]] reference.
`,
    [`${TEST_VAULT_PATH}/Daily/2024-01-15.md`]: `# Daily Note

Today's tasks:
- [ ] Task 1
- [x] Task 2
`,
    [`${TEST_VAULT_PATH}/Templates/basic-template.md`]: `---
template: true
---

# {{title}}

Created: {{date}}

## Notes

`,
  });
}

/**
 * Gets the content of a file from the mock filesystem
 */
export function getMockFileContent(path: string): string | undefined {
  try {
    return vol.readFileSync(path, 'utf8') as string;
  } catch {
    return undefined;
  }
}

/**
 * Checks if a file exists in the mock filesystem
 */
export function mockFileExists(path: string): boolean {
  try {
    vol.statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists files in a directory from the mock filesystem
 */
export function listMockDirectory(path: string): string[] {
  try {
    return vol.readdirSync(path) as string[];
  } catch {
    return [];
  }
}
