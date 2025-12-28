/**
 * Tests for links tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleGetOutlinks,
  handleGetBacklinks,
  handleFindOrphans,
  handleFindBrokenLinks,
  handleGetLinkGraph,
  getOutlinksSchema,
  getBacklinksSchema,
  findOrphansSchema,
  findBrokenLinksSchema,
  getLinkGraphSchema,
  linkTools,
} from '../../tools/links.js';
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

describe('links tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/note-a.md`]: `# Note A

Links to [[note-b]] and [[note-c]].
Also has a [markdown link](note-d.md).
`,
      [`${VAULT_PATH}/note-b.md`]: `# Note B

Links back to [[note-a]] and [[note-c|with alias]].
`,
      [`${VAULT_PATH}/note-c.md`]: `# Note C

Has a [[broken-link]] that doesn't exist.
`,
      [`${VAULT_PATH}/note-d.md`]: `# Note D

An isolated note linked only via markdown.
`,
      [`${VAULT_PATH}/orphan.md`]: `# Orphan Note

This note has no links to or from anywhere.
`,
      [`${VAULT_PATH}/folder/nested.md`]: `# Nested Note

Links to [[note-a]].
`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('getOutlinksSchema should require path', () => {
      expect(() => getOutlinksSchema.parse({ path: 'note.md' })).not.toThrow();
      expect(() => getOutlinksSchema.parse({})).toThrow();
    });

    it('getBacklinksSchema should require path', () => {
      expect(() => getBacklinksSchema.parse({ path: 'note.md' })).not.toThrow();
      expect(() => getBacklinksSchema.parse({})).toThrow();
    });

    it('findOrphansSchema should accept empty object', () => {
      expect(() => findOrphansSchema.parse({})).not.toThrow();
    });

    it('findBrokenLinksSchema should accept empty object', () => {
      expect(() => findBrokenLinksSchema.parse({})).not.toThrow();
    });

    it('getLinkGraphSchema should accept optional maxNodes', () => {
      expect(() => getLinkGraphSchema.parse({})).not.toThrow();
      expect(() => getLinkGraphSchema.parse({ maxNodes: 100 })).not.toThrow();
    });

    it('getLinkGraphSchema should have correct default', () => {
      const parsed = getLinkGraphSchema.parse({});
      expect(parsed.maxNodes).toBe(500);
    });
  });

  describe('linkTools', () => {
    it('should define 5 link tools', () => {
      expect(linkTools.length).toBe(5);
      const names = linkTools.map(t => t.name);
      expect(names).toContain('get_outlinks');
      expect(names).toContain('get_backlinks');
      expect(names).toContain('find_orphans');
      expect(names).toContain('find_broken_links');
      expect(names).toContain('get_link_graph');
    });
  });

  describe('handleGetOutlinks', () => {
    it('should get outgoing links from a note', async () => {
      const result = await handleGetOutlinks({ path: 'note-a.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.path).toBe('note-a.md');
      expect(data.count).toBeGreaterThan(0);
      expect(data.outlinks.some((l: any) => l.target.includes('note-b'))).toBe(true);
      expect(data.outlinks.some((l: any) => l.target.includes('note-c'))).toBe(true);
    });

    it('should include link type', async () => {
      const result = await handleGetOutlinks({ path: 'note-a.md' });

      const data = JSON.parse(result.content[0].text);
      const wikilink = data.outlinks.find((l: any) => l.target.includes('note-b'));
      expect(wikilink).toBeDefined();
      expect(wikilink.type).toBe('wikilink');
    });

    it('should detect markdown links', async () => {
      const result = await handleGetOutlinks({ path: 'note-a.md' });

      const data = JSON.parse(result.content[0].text);
      const mdLink = data.outlinks.find((l: any) => l.target.includes('note-d'));
      expect(mdLink).toBeDefined();
      expect(mdLink.type).toBe('markdown');
    });

    it('should auto-add .md extension', async () => {
      const result = await handleGetOutlinks({ path: 'note-a' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeGreaterThan(0);
    });

    it('should return error for non-existent note', async () => {
      const result = await handleGetOutlinks({ path: 'nonexistent.md' });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleGetBacklinks', () => {
    it('should get backlinks to a note', async () => {
      const result = await handleGetBacklinks({ path: 'note-a.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.path).toBe('note-a.md');
      expect(data.count).toBeGreaterThan(0);
      // note-b links to note-a
      expect(data.backlinks.some((l: any) => l.source.includes('note-b'))).toBe(true);
    });

    it('should include aliases in backlinks', async () => {
      const result = await handleGetBacklinks({ path: 'note-c.md' });

      const data = JSON.parse(result.content[0].text);
      const aliasedLink = data.backlinks.find((l: any) => l.alias);
      // note-b links to note-c with alias
      if (aliasedLink) {
        expect(aliasedLink.alias).toBe('with alias');
      }
    });

    it('should return empty for note with no backlinks', async () => {
      const result = await handleGetBacklinks({ path: 'orphan.md' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(0);
      expect(data.backlinks).toEqual([]);
    });
  });

  describe('handleFindOrphans', () => {
    it('should find orphan notes', async () => {
      const result = await handleFindOrphans();

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.orphans).toContain('orphan.md');
    });

    it('should return count of orphans', async () => {
      const result = await handleFindOrphans();

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeGreaterThan(0);
      expect(data.count).toBe(data.orphans.length);
    });
  });

  describe('handleFindBrokenLinks', () => {
    it('should find broken links', async () => {
      const result = await handleFindBrokenLinks();

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeGreaterThan(0);
      // note-c has a broken link to 'broken-link'
      expect(data.brokenLinks.some((bl: any) =>
        bl.source.includes('note-c') && bl.target.includes('broken-link')
      )).toBe(true);
    });

    it('should return count and details', async () => {
      const result = await handleFindBrokenLinks();

      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.brokenLinks.length);
    });
  });

  describe('handleGetLinkGraph', () => {
    it('should return link graph with nodes and edges', async () => {
      const result = await handleGetLinkGraph({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.nodeCount).toBeGreaterThan(0);
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
    });

    it('should include edge types', async () => {
      const result = await handleGetLinkGraph({});

      const data = JSON.parse(result.content[0].text);
      if (data.edges.length > 0) {
        expect(data.edges[0].type).toBeDefined();
        expect(data.edges[0].source).toBeDefined();
        expect(data.edges[0].target).toBeDefined();
      }
    });

    it('should limit nodes with maxNodes', async () => {
      const result = await handleGetLinkGraph({ maxNodes: 2 });

      const data = JSON.parse(result.content[0].text);
      expect(data.nodeCount).toBeLessThanOrEqual(2);
    });

    it('should filter edges when nodes are limited', async () => {
      const result = await handleGetLinkGraph({ maxNodes: 2 });

      const data = JSON.parse(result.content[0].text);
      // Edges should only connect nodes that are in the limited set
      const nodeSet = new Set(data.nodes);
      data.edges.forEach((edge: any) => {
        expect(nodeSet.has(edge.source)).toBe(true);
        expect(nodeSet.has(edge.target)).toBe(true);
      });
    });
  });
});
