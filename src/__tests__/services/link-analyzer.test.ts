/**
 * Tests for link analyzer service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  buildLinkIndex,
  getOutlinks,
  getBacklinks,
  findOrphans,
  findBrokenLinks,
  buildLinkGraph,
} from '../../services/link-analyzer.js';

// Mock fs/promises with memfs
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const VAULT_PATH = '/test-vault';

describe('link-analyzer service', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note-a.md`]: `# Note A

This note links to [[note-b]] and [[note-c|Note C Display]].

Also has a [markdown link](./note-d.md).
`,
      [`${VAULT_PATH}/note-b.md`]: `# Note B

This links back to [[note-a]] and to [[note-c]].
`,
      [`${VAULT_PATH}/note-c.md`]: `# Note C

This links to [[note-a]].
`,
      [`${VAULT_PATH}/note-d.md`]: `# Note D

A note with no outgoing links.
`,
      [`${VAULT_PATH}/orphan.md`]: `# Orphan Note

This note has no links in or out.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

Links to [[note-a]] and [[nonexistent-note]].
`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('buildLinkIndex', () => {
    it('should build index of all links in vault', async () => {
      const index = await buildLinkIndex(VAULT_PATH);

      expect(index.size).toBeGreaterThan(0);
      expect(index.has('note-a.md')).toBe(true);
    });

    it('should index wikilinks', async () => {
      const index = await buildLinkIndex(VAULT_PATH);
      const noteALinks = index.get('note-a.md');

      expect(noteALinks).toBeDefined();
      expect(noteALinks?.some(l => l.target === 'note-b.md')).toBe(true);
    });

    it('should index markdown links', async () => {
      const index = await buildLinkIndex(VAULT_PATH);
      const noteALinks = index.get('note-a.md');

      expect(noteALinks?.some(l => l.target.includes('note-d') && l.type === 'markdown')).toBe(true);
    });

    it('should include link aliases', async () => {
      const index = await buildLinkIndex(VAULT_PATH);
      const noteALinks = index.get('note-a.md');

      const noteCLink = noteALinks?.find(l => l.target === 'note-c.md');
      expect(noteCLink?.alias).toBe('Note C Display');
    });

    it('should not include notes in .obsidian folder', async () => {
      const index = await buildLinkIndex(VAULT_PATH);

      const keys = Array.from(index.keys());
      expect(keys.every(k => !k.includes('.obsidian'))).toBe(true);
    });
  });

  describe('getOutlinks', () => {
    it('should return all outgoing links from a note', async () => {
      const outlinks = await getOutlinks(VAULT_PATH, 'note-a.md');

      expect(outlinks.length).toBe(3);
      expect(outlinks.some(l => l.target === 'note-b.md')).toBe(true);
      expect(outlinks.some(l => l.target === 'note-c.md')).toBe(true);
      // Markdown link ./note-d.md gets normalized to ./note-d.md
      expect(outlinks.some(l => l.target.includes('note-d'))).toBe(true);
    });

    it('should include link type', async () => {
      const outlinks = await getOutlinks(VAULT_PATH, 'note-a.md');

      expect(outlinks.some(l => l.type === 'wikilink')).toBe(true);
      expect(outlinks.some(l => l.type === 'markdown')).toBe(true);
    });

    it('should return empty array for note with no links', async () => {
      const outlinks = await getOutlinks(VAULT_PATH, 'orphan.md');

      expect(outlinks).toEqual([]);
    });

    it('should handle nested notes', async () => {
      const outlinks = await getOutlinks(VAULT_PATH, 'folder/nested.md');

      expect(outlinks.length).toBe(2);
    });
  });

  describe('getBacklinks', () => {
    it('should return all notes linking to a specific note', async () => {
      const backlinks = await getBacklinks(VAULT_PATH, 'note-a.md');

      expect(backlinks.length).toBeGreaterThan(0);
      expect(backlinks.some(l => l.source === 'note-b.md')).toBe(true);
      expect(backlinks.some(l => l.source === 'note-c.md')).toBe(true);
    });

    it('should include backlinks from nested notes', async () => {
      const backlinks = await getBacklinks(VAULT_PATH, 'note-a.md');

      expect(backlinks.some(l => l.source === 'folder/nested.md')).toBe(true);
    });

    it('should return empty array for note with no backlinks', async () => {
      const backlinks = await getBacklinks(VAULT_PATH, 'orphan.md');

      expect(backlinks).toEqual([]);
    });

    it('should handle note path without .md extension', async () => {
      const backlinks = await getBacklinks(VAULT_PATH, 'note-a');

      expect(backlinks.length).toBeGreaterThan(0);
    });
  });

  describe('findOrphans', () => {
    it('should find notes with no links in or out', async () => {
      const orphans = await findOrphans(VAULT_PATH);

      expect(orphans).toContain('orphan.md');
    });

    it('should not include notes that have links', async () => {
      const orphans = await findOrphans(VAULT_PATH);

      expect(orphans).not.toContain('note-a.md');
      expect(orphans).not.toContain('note-b.md');
    });

    it('should not include notes that are linked to', async () => {
      const orphans = await findOrphans(VAULT_PATH);

      // note-d has no outlinks but is linked from note-a
      expect(orphans).not.toContain('note-d.md');
    });

    it('should return sorted array', async () => {
      const orphans = await findOrphans(VAULT_PATH);

      expect(orphans).toEqual([...orphans].sort());
    });
  });

  describe('findBrokenLinks', () => {
    it('should find links pointing to non-existent notes', async () => {
      const brokenLinks = await findBrokenLinks(VAULT_PATH);

      expect(brokenLinks.some(l => l.target === 'nonexistent-note.md')).toBe(true);
    });

    it('should include source information', async () => {
      const brokenLinks = await findBrokenLinks(VAULT_PATH);

      const brokenLink = brokenLinks.find(l => l.target === 'nonexistent-note.md');
      expect(brokenLink?.source).toBe('folder/nested.md');
    });

    it('should include link type', async () => {
      const brokenLinks = await findBrokenLinks(VAULT_PATH);

      const brokenLink = brokenLinks.find(l => l.target === 'nonexistent-note.md');
      expect(brokenLink?.type).toBe('wikilink');
    });

    it('should not include valid links', async () => {
      const brokenLinks = await findBrokenLinks(VAULT_PATH);

      expect(brokenLinks.every(l => l.target !== 'note-a.md')).toBe(true);
      expect(brokenLinks.every(l => l.target !== 'note-b.md')).toBe(true);
    });

    it('should return empty array when no broken links', async () => {
      // Remove the note with broken link
      vol.unlinkSync(`${VAULT_PATH}/folder/nested.md`);

      const brokenLinks = await findBrokenLinks(VAULT_PATH);

      expect(brokenLinks).toEqual([]);
    });
  });

  describe('buildLinkGraph', () => {
    it('should return nodes as array of note paths', async () => {
      const graph = await buildLinkGraph(VAULT_PATH);

      expect(graph.nodes).toContain('note-a.md');
      expect(graph.nodes).toContain('note-b.md');
      expect(graph.nodes).toContain('orphan.md');
    });

    it('should return edges as array of link info', async () => {
      const graph = await buildLinkGraph(VAULT_PATH);

      expect(graph.edges.length).toBeGreaterThan(0);
      expect(graph.edges.some(e => e.source === 'note-a.md' && e.target === 'note-b.md')).toBe(true);
    });

    it('should include all link types in edges', async () => {
      const graph = await buildLinkGraph(VAULT_PATH);

      expect(graph.edges.some(e => e.type === 'wikilink')).toBe(true);
      expect(graph.edges.some(e => e.type === 'markdown')).toBe(true);
    });

    it('should not include hidden folders in nodes', async () => {
      const graph = await buildLinkGraph(VAULT_PATH);

      expect(graph.nodes.every(n => !n.includes('.obsidian'))).toBe(true);
    });
  });
});
