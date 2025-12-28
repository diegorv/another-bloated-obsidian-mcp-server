/**
 * Markdown parsing utilities for Obsidian
 */

import matter from 'gray-matter';

// Regex patterns for Obsidian-specific syntax
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const TAG_PATTERN = /#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
const FRONTMATTER_TAG_PATTERN = /^tags:\s*\[([^\]]*)\]|^tags:\s*\n((?:\s*-\s*.+\n?)*)/m;

export interface ParsedNote {
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  wikilinks: WikiLink[];
  markdownLinks: MarkdownLink[];
}

export interface WikiLink {
  target: string;
  alias?: string;
  raw: string;
}

export interface MarkdownLink {
  text: string;
  url: string;
  raw: string;
}

/**
 * Parses a markdown file and extracts metadata
 */
export function parseMarkdown(content: string): ParsedNote {
  const parsed = matter(content);

  return {
    content: parsed.content,
    frontmatter: parsed.data,
    tags: extractTags(content, parsed.data),
    wikilinks: extractWikilinks(parsed.content),
    markdownLinks: extractMarkdownLinks(parsed.content),
  };
}

/**
 * Extracts all tags from content and frontmatter
 */
export function extractTags(content: string, frontmatter?: Record<string, unknown>): string[] {
  const tags = new Set<string>();

  // Extract tags from frontmatter
  if (frontmatter?.tags) {
    const fmTags = frontmatter.tags;
    if (Array.isArray(fmTags)) {
      fmTags.forEach((tag) => {
        if (typeof tag === 'string') {
          tags.add(tag.startsWith('#') ? tag.slice(1) : tag);
        }
      });
    } else if (typeof fmTags === 'string') {
      tags.add(fmTags.startsWith('#') ? fmTags.slice(1) : fmTags);
    }
  }

  // Extract inline tags from content (excluding code blocks)
  const contentWithoutCode = removeCodeBlocks(content);
  let match;
  while ((match = TAG_PATTERN.exec(contentWithoutCode)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags).sort();
}

/**
 * Extracts all wikilinks from content
 */
export function extractWikilinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  const contentWithoutCode = removeCodeBlocks(content);

  let match;
  while ((match = WIKILINK_PATTERN.exec(contentWithoutCode)) !== null) {
    links.push({
      target: match[1].trim(),
      alias: match[2]?.trim(),
      raw: match[0],
    });
  }

  return links;
}

/**
 * Extracts all markdown links from content
 */
export function extractMarkdownLinks(content: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const contentWithoutCode = removeCodeBlocks(content);

  let match;
  while ((match = MARKDOWN_LINK_PATTERN.exec(contentWithoutCode)) !== null) {
    // Skip external links
    if (!match[2].startsWith('http://') && !match[2].startsWith('https://')) {
      links.push({
        text: match[1],
        url: match[2],
        raw: match[0],
      });
    }
  }

  return links;
}

/**
 * Removes code blocks from content for parsing
 */
function removeCodeBlocks(content: string): string {
  // Remove fenced code blocks
  let result = content.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  result = result.replace(/`[^`]+`/g, '');
  return result;
}

/**
 * Updates frontmatter in a markdown string
 */
export function updateFrontmatter(
  content: string,
  updates: Record<string, unknown>
): string {
  const parsed = matter(content);
  const newFrontmatter = { ...parsed.data, ...updates };

  // Remove null/undefined values
  Object.keys(newFrontmatter).forEach((key) => {
    if (newFrontmatter[key] === null || newFrontmatter[key] === undefined) {
      delete newFrontmatter[key];
    }
  });

  return matter.stringify(parsed.content, newFrontmatter);
}

/**
 * Adds a tag to a note's frontmatter
 */
export function addTagToFrontmatter(content: string, tag: string): string {
  const parsed = matter(content);
  const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;

  let tags: string[] = [];
  if (Array.isArray(parsed.data.tags)) {
    tags = [...parsed.data.tags];
  } else if (typeof parsed.data.tags === 'string') {
    tags = [parsed.data.tags];
  }

  if (!tags.includes(normalizedTag)) {
    tags.push(normalizedTag);
  }

  return matter.stringify(parsed.content, { ...parsed.data, tags });
}

/**
 * Removes a tag from a note's frontmatter
 */
export function removeTagFromFrontmatter(content: string, tag: string): string {
  const parsed = matter(content);
  const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;

  let tags: string[] = [];
  if (Array.isArray(parsed.data.tags)) {
    tags = parsed.data.tags.filter((t: string) => t !== normalizedTag);
  } else if (typeof parsed.data.tags === 'string' && parsed.data.tags !== normalizedTag) {
    tags = [parsed.data.tags];
  }

  if (tags.length === 0) {
    const { tags: _, ...rest } = parsed.data;
    return matter.stringify(parsed.content, rest);
  }

  return matter.stringify(parsed.content, { ...parsed.data, tags });
}

/**
 * Gets the title of a note (first H1 or filename)
 */
export function getNoteTitle(content: string, filename: string): string {
  // Check for first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fall back to filename without extension
  return filename.replace(/\.(md|markdown)$/, '');
}

/**
 * Extracts all headings from a note
 */
export function extractHeadings(content: string): { level: number; text: string; line: number }[] {
  const headings: { level: number; text: string; line: number }[] = [];
  const lines = content.split('\n');

  // Skip frontmatter
  let inFrontmatter = false;
  let startIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line === '---') {
      inFrontmatter = false;
      startIndex = i + 1;
      continue;
    }
    if (inFrontmatter) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      headings.push({
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
        line: i + 1,
      });
    }
  }

  return headings;
}
