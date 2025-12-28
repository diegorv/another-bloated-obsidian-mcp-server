/**
 * Link analysis service for Obsidian vaults
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { validatePath, isMarkdownFile, shouldIgnorePath, getRelativePath, getNoteName } from '../utils/path.js';
import { extractWikilinks, extractMarkdownLinks, WikiLink, MarkdownLink } from './markdown-parser.js';

export interface LinkInfo {
  source: string;
  target: string;
  alias?: string;
  type: 'wikilink' | 'markdown';
}

export interface NoteLinks {
  path: string;
  outlinks: LinkInfo[];
  backlinks: LinkInfo[];
}

export interface LinkGraph {
  nodes: string[];
  edges: LinkInfo[];
}

/**
 * Builds a map of all notes and their outgoing links
 */
export async function buildLinkIndex(vaultPath: string): Promise<Map<string, LinkInfo[]>> {
  const linkIndex = new Map<string, LinkInfo[]>();

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = getRelativePath(fullPath, vaultPath);

      if (shouldIgnorePath(relativePath)) continue;

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && isMarkdownFile(entry.name)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const wikilinks = extractWikilinks(content);
        const markdownLinks = extractMarkdownLinks(content);

        const outlinks: LinkInfo[] = [];

        // Process wikilinks
        for (const link of wikilinks) {
          outlinks.push({
            source: relativePath,
            target: normalizeTarget(link.target),
            alias: link.alias,
            type: 'wikilink',
          });
        }

        // Process markdown links (only internal ones)
        for (const link of markdownLinks) {
          if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            outlinks.push({
              source: relativePath,
              target: normalizeTarget(link.url),
              alias: link.text,
              type: 'markdown',
            });
          }
        }

        linkIndex.set(relativePath, outlinks);
      }
    }
  }

  await scanDir(vaultPath);
  return linkIndex;
}

/**
 * Normalizes a link target to a consistent format
 */
function normalizeTarget(target: string): string {
  // Remove any anchors
  const withoutAnchor = target.split('#')[0];
  // Add .md extension if missing
  if (!withoutAnchor.endsWith('.md') && !withoutAnchor.endsWith('.markdown')) {
    return withoutAnchor + '.md';
  }
  return withoutAnchor;
}

/**
 * Gets all outgoing links from a note
 */
export async function getOutlinks(vaultPath: string, notePath: string): Promise<LinkInfo[]> {
  const fullPath = validatePath(notePath, vaultPath);
  const relativePath = getRelativePath(fullPath, vaultPath);

  const content = await fs.readFile(fullPath, 'utf-8');
  const wikilinks = extractWikilinks(content);
  const markdownLinks = extractMarkdownLinks(content);

  const outlinks: LinkInfo[] = [];

  for (const link of wikilinks) {
    outlinks.push({
      source: relativePath,
      target: normalizeTarget(link.target),
      alias: link.alias,
      type: 'wikilink',
    });
  }

  for (const link of markdownLinks) {
    if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
      outlinks.push({
        source: relativePath,
        target: normalizeTarget(link.url),
        alias: link.text,
        type: 'markdown',
      });
    }
  }

  return outlinks;
}

/**
 * Gets all notes that link to a specific note (backlinks)
 */
export async function getBacklinks(vaultPath: string, notePath: string): Promise<LinkInfo[]> {
  const linkIndex = await buildLinkIndex(vaultPath);
  const targetPath = notePath.endsWith('.md') ? notePath : notePath + '.md';
  const targetName = getNoteName(targetPath);

  const backlinks: LinkInfo[] = [];

  for (const [sourcePath, outlinks] of linkIndex.entries()) {
    for (const link of outlinks) {
      // Match by full path or just the note name
      const linkTarget = link.target;
      const linkName = getNoteName(linkTarget);

      if (
        linkTarget === targetPath ||
        linkTarget.endsWith('/' + targetPath) ||
        linkName.toLowerCase() === targetName.toLowerCase()
      ) {
        backlinks.push({
          source: sourcePath,
          target: targetPath,
          alias: link.alias,
          type: link.type,
        });
      }
    }
  }

  return backlinks;
}

/**
 * Finds orphan notes (notes with no incoming or outgoing links)
 */
export async function findOrphans(vaultPath: string): Promise<string[]> {
  const linkIndex = await buildLinkIndex(vaultPath);
  const allNotes = new Set(linkIndex.keys());
  const linkedNotes = new Set<string>();

  // Find all notes that have links or are linked to
  for (const [sourcePath, outlinks] of linkIndex.entries()) {
    if (outlinks.length > 0) {
      linkedNotes.add(sourcePath);
    }

    for (const link of outlinks) {
      // Find the actual file that matches this link
      for (const notePath of allNotes) {
        const noteName = getNoteName(notePath);
        const linkName = getNoteName(link.target);

        if (
          notePath === link.target ||
          notePath.endsWith('/' + link.target) ||
          noteName.toLowerCase() === linkName.toLowerCase()
        ) {
          linkedNotes.add(notePath);
        }
      }
    }
  }

  // Orphans are notes that are neither linking nor linked
  const orphans = Array.from(allNotes).filter((note) => !linkedNotes.has(note));
  return orphans.sort();
}

/**
 * Finds broken links (links pointing to non-existent notes)
 */
export async function findBrokenLinks(
  vaultPath: string
): Promise<{ source: string; target: string; type: string }[]> {
  const linkIndex = await buildLinkIndex(vaultPath);
  const allNotes = new Set(linkIndex.keys());
  const brokenLinks: { source: string; target: string; type: string }[] = [];

  for (const [sourcePath, outlinks] of linkIndex.entries()) {
    for (const link of outlinks) {
      // Check if the target exists
      let found = false;
      const linkName = getNoteName(link.target);

      for (const notePath of allNotes) {
        const noteName = getNoteName(notePath);

        if (
          notePath === link.target ||
          notePath.endsWith('/' + link.target) ||
          noteName.toLowerCase() === linkName.toLowerCase()
        ) {
          found = true;
          break;
        }
      }

      if (!found) {
        brokenLinks.push({
          source: sourcePath,
          target: link.target,
          type: link.type,
        });
      }
    }
  }

  return brokenLinks;
}

/**
 * Builds a complete link graph of the vault
 */
export async function buildLinkGraph(vaultPath: string): Promise<LinkGraph> {
  const linkIndex = await buildLinkIndex(vaultPath);
  const nodes = Array.from(linkIndex.keys());
  const edges: LinkInfo[] = [];

  for (const [, outlinks] of linkIndex.entries()) {
    edges.push(...outlinks);
  }

  return { nodes, edges };
}
