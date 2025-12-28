/**
 * Test fixtures and sample data for unit tests
 */

/**
 * Sample frontmatter data
 */
export const sampleFrontmatter = {
  simple: {
    title: 'Test Note',
    date: '2024-01-15',
  },
  withTags: {
    title: 'Tagged Note',
    tags: ['test', 'sample', 'example'],
  },
  complex: {
    title: 'Complex Note',
    tags: ['test'],
    status: 'draft',
    priority: 1,
    author: 'Test Author',
    created: '2024-01-15T10:00:00Z',
    aliases: ['alias1', 'alias2'],
  },
};

/**
 * Sample markdown content
 */
export const sampleMarkdown = {
  basic: `# Test Note

This is a basic test note.

## Section 1

Some content here.
`,
  withFrontmatter: `---
title: Test Note
tags:
  - test
---

# Test Note

Content after frontmatter.
`,
  withLinks: `# Note with Links

Here's a [[wikilink]] and a [[target|aliased link]].

Also a [markdown link](./other-note.md).

And another [[folder/nested-note]].
`,
  withTags: `# Tagged Note

This note has #inline-tag and #another-tag.

Also nested #parent/child tags.
`,
  withCodeBlocks: `# Code Example

Here's some code:

\`\`\`javascript
const link = '[[not-a-link]]';
const tag = '#not-a-tag';
\`\`\`

And inline \`#not-a-tag\` code.

But #real-tag is a tag.
`,
  withHeadings: `---
title: Heading Test
---

# Main Title

Some intro text.

## Section 1

Content for section 1.

### Subsection 1.1

More details.

## Section 2

Another section.

### Subsection 2.1

#### Deep heading

Very nested content.
`,
  dailyNote: `# 2024-01-15

## Morning

- Started the day
- Had coffee

## Tasks

- [ ] Task 1
- [x] Task 2
- [ ] Task 3

## Notes

Some random notes for today.
`,
  template: `---
template: true
---

# {{title}}

Created: {{date}}
Author: {{author}}

## Description

{{description}}

## Tags

{{tags}}
`,
};

/**
 * Sample wikilinks for testing
 */
export const sampleWikilinks = [
  { raw: '[[simple-link]]', target: 'simple-link', alias: undefined },
  { raw: '[[target|Display Text]]', target: 'target', alias: 'Display Text' },
  { raw: '[[folder/nested-note]]', target: 'folder/nested-note', alias: undefined },
  { raw: '[[path/to/note|Alias]]', target: 'path/to/note', alias: 'Alias' },
];

/**
 * Sample tags for testing
 */
export const sampleTags = {
  inline: ['inline-tag', 'another-tag', 'parent/child'],
  frontmatter: ['test', 'sample', 'example'],
  mixed: ['inline-tag', 'test', 'sample'],
};

/**
 * Sample search results
 */
export const sampleSearchResults = {
  basic: [
    {
      path: 'note1.md',
      matches: [
        { line: 5, content: 'This is a test note', context: [] },
      ],
    },
  ],
  withContext: [
    {
      path: 'note1.md',
      matches: [
        {
          line: 5,
          content: 'This is a test note',
          context: {
            before: ['', '# Note 1'],
            after: ['', '## Section 1'],
          },
        },
      ],
    },
  ],
};

/**
 * Sample vault configuration
 */
export const sampleVaultConfig = {
  vaults: {
    default: '/path/to/default',
    secondary: '/path/to/secondary',
  },
  defaultVault: 'default',
  options: {
    dailyNotesFormat: 'YYYY-MM-DD',
    templatesFolder: 'Templates',
  },
};

/**
 * Sample base (database) content
 */
export const sampleBase = `---
base: true
columns:
  - name: title
    type: text
  - name: status
    type: select
    options:
      - todo
      - in-progress
      - done
  - name: priority
    type: number
---

| title | status | priority |
|-------|--------|----------|
| Task 1 | todo | 1 |
| Task 2 | in-progress | 2 |
| Task 3 | done | 3 |
`;

/**
 * Invalid inputs for error testing
 */
export const invalidInputs = {
  paths: [
    '../outside-vault',
    '/absolute/path',
    '../../etc/passwd',
    'folder/../../../outside',
  ],
  noteNames: [
    '',
    '   ',
    'note<>name',
    'note:name',
    'note|name',
    'note?name',
    'note*name',
    'CON',
    'PRN',
    'AUX',
    'NUL',
  ],
  regex: [
    '[invalid',
    '(unclosed',
    '*invalid',
    '+invalid',
  ],
};
