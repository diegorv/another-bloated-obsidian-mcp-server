/**
 * Tests for markdown parser service
 */

import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  extractTags,
  extractWikilinks,
  extractMarkdownLinks,
  updateFrontmatter,
  addTagToFrontmatter,
  removeTagFromFrontmatter,
  getNoteTitle,
  extractHeadings,
} from '../../services/markdown-parser.js';

describe('markdown-parser service', () => {
  describe('parseMarkdown', () => {
    it('should parse markdown with frontmatter', () => {
      const content = `---
title: Test Note
tags:
  - test
  - sample
---

# Test Note

Content here.
`;
      const result = parseMarkdown(content);

      expect(result.frontmatter.title).toBe('Test Note');
      expect(result.frontmatter.tags).toEqual(['test', 'sample']);
      expect(result.content).toContain('# Test Note');
    });

    it('should parse markdown without frontmatter', () => {
      const content = `# Simple Note

No frontmatter here.
`;
      const result = parseMarkdown(content);

      expect(result.frontmatter).toEqual({});
      expect(result.content).toContain('# Simple Note');
    });

    it('should extract inline tags', () => {
      const content = `# Note

Content with #tag1 and #tag2.
`;
      const result = parseMarkdown(content);

      expect(result.tags).toContain('tag1');
      expect(result.tags).toContain('tag2');
    });

    it('should extract wikilinks', () => {
      const content = `# Note

Link to [[other-note]] and [[target|display text]].
`;
      const result = parseMarkdown(content);

      expect(result.wikilinks).toHaveLength(2);
      expect(result.wikilinks[0].target).toBe('other-note');
      expect(result.wikilinks[1].target).toBe('target');
      expect(result.wikilinks[1].alias).toBe('display text');
    });

    it('should extract markdown links', () => {
      const content = `# Note

Link to [other note](./other-note.md).
`;
      const result = parseMarkdown(content);

      expect(result.markdownLinks).toHaveLength(1);
      expect(result.markdownLinks[0].text).toBe('other note');
      expect(result.markdownLinks[0].url).toBe('./other-note.md');
    });
  });

  describe('extractTags', () => {
    it('should extract tags from frontmatter array', () => {
      const content = '# Content with #inline';
      const frontmatter = { tags: ['fm-tag1', 'fm-tag2'] };

      const tags = extractTags(content, frontmatter);

      expect(tags).toContain('fm-tag1');
      expect(tags).toContain('fm-tag2');
      expect(tags).toContain('inline');
    });

    it('should extract tags from frontmatter string', () => {
      const content = '# Content';
      const frontmatter = { tags: 'single-tag' };

      const tags = extractTags(content, frontmatter);

      expect(tags).toContain('single-tag');
    });

    it('should handle tags with # prefix in frontmatter', () => {
      const content = '# Content';
      const frontmatter = { tags: ['#tag1', 'tag2'] };

      const tags = extractTags(content, frontmatter);

      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
    });

    it('should extract nested tags', () => {
      const content = '# Content with #parent/child/grandchild';

      const tags = extractTags(content);

      expect(tags).toContain('parent/child/grandchild');
    });

    it('should ignore tags in code blocks', () => {
      const content = `# Content

\`\`\`javascript
const tag = '#not-a-tag';
\`\`\`

Real #actual-tag here.
`;
      const tags = extractTags(content);

      expect(tags).not.toContain('not-a-tag');
      expect(tags).toContain('actual-tag');
    });

    it('should ignore tags in inline code', () => {
      const content = 'Content with `#inline-code` and #real-tag';

      const tags = extractTags(content);

      expect(tags).not.toContain('inline-code');
      expect(tags).toContain('real-tag');
    });

    it('should return sorted unique tags', () => {
      const content = '# Content with #zebra and #alpha and #zebra';

      const tags = extractTags(content);

      expect(tags).toEqual(['alpha', 'zebra']);
    });

    it('should handle empty content', () => {
      const tags = extractTags('');
      expect(tags).toEqual([]);
    });
  });

  describe('extractWikilinks', () => {
    it('should extract simple wikilinks', () => {
      const content = 'Link to [[note]]';

      const links = extractWikilinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('note');
      expect(links[0].alias).toBeUndefined();
      expect(links[0].raw).toBe('[[note]]');
    });

    it('should extract wikilinks with aliases', () => {
      const content = 'Link to [[target|Display Text]]';

      const links = extractWikilinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('target');
      expect(links[0].alias).toBe('Display Text');
    });

    it('should extract wikilinks with paths', () => {
      const content = 'Link to [[folder/subfolder/note]]';

      const links = extractWikilinks(content);

      expect(links[0].target).toBe('folder/subfolder/note');
    });

    it('should extract multiple wikilinks', () => {
      const content = 'Links to [[note1]], [[note2]], and [[note3|Three]]';

      const links = extractWikilinks(content);

      expect(links).toHaveLength(3);
    });

    it('should ignore wikilinks in code blocks', () => {
      const content = `
\`\`\`
[[code-link]]
\`\`\`

[[real-link]]
`;
      const links = extractWikilinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('real-link');
    });

    it('should handle empty content', () => {
      const links = extractWikilinks('');
      expect(links).toEqual([]);
    });
  });

  describe('extractMarkdownLinks', () => {
    it('should extract markdown links', () => {
      const content = 'Link to [Other Note](./other.md)';

      const links = extractMarkdownLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe('Other Note');
      expect(links[0].url).toBe('./other.md');
    });

    it('should ignore external links', () => {
      const content = `
[Internal](./note.md)
[External HTTP](http://example.com)
[External HTTPS](https://example.com)
`;
      const links = extractMarkdownLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe('Internal');
    });

    it('should extract multiple links', () => {
      const content = '[One](./one.md) and [Two](./two.md)';

      const links = extractMarkdownLinks(content);

      expect(links).toHaveLength(2);
    });

    it('should ignore links in code blocks', () => {
      const content = `
\`\`\`
[code-link](./code.md)
\`\`\`

[real-link](./real.md)
`;
      const links = extractMarkdownLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe('real-link');
    });
  });

  describe('updateFrontmatter', () => {
    it('should add frontmatter to content without it', () => {
      const content = '# Note\n\nContent';
      const updates = { title: 'New Title', status: 'draft' };

      const result = updateFrontmatter(content, updates);

      expect(result).toContain('title: New Title');
      expect(result).toContain('status: draft');
      expect(result).toContain('# Note');
    });

    it('should update existing frontmatter', () => {
      const content = `---
title: Old Title
status: draft
---

# Note
`;
      const updates = { title: 'New Title' };

      const result = updateFrontmatter(content, updates);

      expect(result).toContain('title: New Title');
      expect(result).toContain('status: draft');
    });

    it('should remove null values', () => {
      const content = `---
title: Title
status: draft
---

# Note
`;
      const updates = { status: null };

      const result = updateFrontmatter(content, updates);

      expect(result).not.toContain('status:');
    });

    it('should handle array values', () => {
      const content = '# Note';
      const updates = { tags: ['tag1', 'tag2'] };

      const result = updateFrontmatter(content, updates);

      expect(result).toContain('tags:');
      expect(result).toContain('tag1');
      expect(result).toContain('tag2');
    });
  });

  describe('addTagToFrontmatter', () => {
    it('should add tag to existing tags array', () => {
      const content = `---
tags:
  - existing
---

# Note
`;
      const result = addTagToFrontmatter(content, 'new-tag');

      expect(result).toContain('existing');
      expect(result).toContain('new-tag');
    });

    it('should create tags array if not exists', () => {
      const content = `---
title: Note
---

# Note
`;
      const result = addTagToFrontmatter(content, 'first-tag');

      expect(result).toContain('tags:');
      expect(result).toContain('first-tag');
    });

    it('should not duplicate existing tag', () => {
      const content = `---
tags:
  - existing
---

# Note
`;
      const result = addTagToFrontmatter(content, 'existing');

      const matches = result.match(/existing/g);
      expect(matches).toHaveLength(1);
    });

    it('should handle # prefix in tag', () => {
      const content = '# Note';
      const result = addTagToFrontmatter(content, '#new-tag');

      expect(result).toContain('new-tag');
      expect(result).not.toContain('#new-tag');
    });

    it('should handle tags as string in frontmatter', () => {
      const content = `---
tags: single-tag
---

# Note
`;
      const result = addTagToFrontmatter(content, 'new-tag');

      expect(result).toContain('single-tag');
      expect(result).toContain('new-tag');
    });
  });

  describe('removeTagFromFrontmatter', () => {
    it('should remove tag from tags array', () => {
      const content = `---
tags:
  - keep
  - remove-me
---

# Note
`;
      const result = removeTagFromFrontmatter(content, 'remove-me');

      expect(result).toContain('keep');
      expect(result).not.toContain('remove-me');
    });

    it('should remove tags field if empty', () => {
      const content = `---
title: Note
tags:
  - only-tag
---

# Note
`;
      const result = removeTagFromFrontmatter(content, 'only-tag');

      expect(result).not.toContain('tags:');
    });

    it('should handle # prefix in tag', () => {
      const content = `---
tags:
  - remove-me
---

# Note
`;
      const result = removeTagFromFrontmatter(content, '#remove-me');

      expect(result).not.toContain('remove-me');
    });
  });

  describe('getNoteTitle', () => {
    it('should return H1 heading as title', () => {
      const content = '# My Note Title\n\nContent here.';

      const title = getNoteTitle(content, 'filename.md');

      expect(title).toBe('My Note Title');
    });

    it('should return filename if no H1', () => {
      const content = '## Second Level\n\nNo H1 here.';

      const title = getNoteTitle(content, 'my-filename.md');

      expect(title).toBe('my-filename');
    });

    it('should handle .markdown extension', () => {
      const content = 'No heading';

      const title = getNoteTitle(content, 'note.markdown');

      expect(title).toBe('note');
    });

    it('should use first H1 if multiple exist', () => {
      const content = '# First Title\n\n# Second Title';

      const title = getNoteTitle(content, 'filename.md');

      expect(title).toBe('First Title');
    });
  });

  describe('extractHeadings', () => {
    it('should extract all headings with levels', () => {
      const content = `# H1

## H2

### H3

#### H4
`;
      const headings = extractHeadings(content);

      expect(headings).toHaveLength(4);
      expect(headings[0]).toEqual({ level: 1, text: 'H1', line: 1 });
      expect(headings[1]).toEqual({ level: 2, text: 'H2', line: 3 });
      expect(headings[2]).toEqual({ level: 3, text: 'H3', line: 5 });
      expect(headings[3]).toEqual({ level: 4, text: 'H4', line: 7 });
    });

    it('should skip headings in frontmatter', () => {
      const content = `---
title: Note
---

# Real Heading
`;
      const headings = extractHeadings(content);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('Real Heading');
    });

    it('should handle empty content', () => {
      const headings = extractHeadings('');
      expect(headings).toEqual([]);
    });

    it('should handle content with no headings', () => {
      const content = 'Just some text without headings.';

      const headings = extractHeadings(content);

      expect(headings).toEqual([]);
    });
  });
});
