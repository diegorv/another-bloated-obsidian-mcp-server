/**
 * Tests for template engine service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  listTemplates,
  getTemplate,
  applyTemplateVariables,
  createFromTemplate,
} from '../../services/template-engine.js';

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
    loadConfig: () =>
      Promise.resolve({
        options: {
          templatesFolder: 'Templates',
        },
      }),
  };
});

const VAULT_PATH = '/test-vault';

describe('template-engine service', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/Templates/basic.md`]: `# {{title}}

Created: {{date}}

## Content

`,
      [`${VAULT_PATH}/Templates/meeting.md`]: `# Meeting: {{title}}

Date: {{date}}
Time: {{time}}

## Attendees

## Agenda

## Notes

## Action Items

`,
      [`${VAULT_PATH}/Templates/with-custom.md`]: `# {{title}}

Author: {{author}}
Project: {{project}}

## Description

{{description}}
`,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('listTemplates', () => {
    it('should list all templates in Templates folder', async () => {
      const templates = await listTemplates(VAULT_PATH);

      expect(templates.length).toBe(3);
      expect(templates.map(t => t.name)).toContain('basic');
      expect(templates.map(t => t.name)).toContain('meeting');
    });

    it('should include template paths', async () => {
      const templates = await listTemplates(VAULT_PATH);

      const basic = templates.find(t => t.name === 'basic');
      expect(basic?.path).toBe('Templates/basic.md');
    });

    it('should sort templates alphabetically', async () => {
      const templates = await listTemplates(VAULT_PATH);

      const names = templates.map(t => t.name);
      expect(names).toEqual([...names].sort());
    });

    it('should return empty array if Templates folder not exists', async () => {
      vol.rmdirSync(`${VAULT_PATH}/Templates`, { recursive: true });

      const templates = await listTemplates(VAULT_PATH);

      expect(templates).toEqual([]);
    });
  });

  describe('getTemplate', () => {
    it('should get template content', async () => {
      const content = await getTemplate(VAULT_PATH, 'basic');

      expect(content).toContain('{{title}}');
      expect(content).toContain('{{date}}');
    });

    it('should handle template name with .md extension', async () => {
      const content = await getTemplate(VAULT_PATH, 'basic.md');

      expect(content).toContain('{{title}}');
    });

    it('should throw error for non-existent template', async () => {
      await expect(getTemplate(VAULT_PATH, 'nonexistent'))
        .rejects.toThrow();
    });
  });

  describe('applyTemplateVariables', () => {
    it('should replace {{title}}', () => {
      const content = '# {{title}}\n\nContent';
      const result = applyTemplateVariables(content, { title: 'My Note' });

      expect(result).toBe('# My Note\n\nContent');
    });

    it('should replace {{date}} with default format', () => {
      const content = 'Date: {{date}}';
      const date = new Date(2024, 0, 15);
      const result = applyTemplateVariables(content, { date });

      expect(result).toBe('Date: 2024-01-15');
    });

    it('should replace {{time}} with default format', () => {
      const content = 'Time: {{time}}';
      const date = new Date(2024, 0, 15, 14, 30);
      const result = applyTemplateVariables(content, { date });

      expect(result).toBe('Time: 14:30');
    });

    it('should replace {{date:FORMAT}} with custom format', () => {
      const content = 'Date: {{date:DD MMM YYYY}}';
      const date = new Date(2024, 0, 15);
      const result = applyTemplateVariables(content, { date });

      expect(result).toBe('Date: 15 Jan 2024');
    });

    it('should replace custom variables', () => {
      const content = 'Author: {{author}}, Project: {{project}}';
      const result = applyTemplateVariables(content, {
        customVars: {
          author: 'John Doe',
          project: 'Test Project',
        },
      });

      expect(result).toBe('Author: John Doe, Project: Test Project');
    });

    it('should be case insensitive for built-in variables', () => {
      const content = '{{TITLE}} {{Title}} {{title}}';
      const result = applyTemplateVariables(content, { title: 'Test' });

      expect(result).toBe('Test Test Test');
    });

    it('should handle multiple replacements', () => {
      const content = '{{date}} and {{date}} again';
      const date = new Date(2024, 0, 15);
      const result = applyTemplateVariables(content, { date });

      expect(result).toBe('2024-01-15 and 2024-01-15 again');
    });
  });

  describe('createFromTemplate', () => {
    it('should create note from template', async () => {
      const result = await createFromTemplate(
        VAULT_PATH,
        'basic',
        'Notes/new-note.md',
        { title: 'My New Note' }
      );

      expect(result.path).toBe('Notes/new-note.md');
      expect(result.content).toContain('# My New Note');
    });

    it('should use filename as title if not provided', async () => {
      const result = await createFromTemplate(
        VAULT_PATH,
        'basic',
        'Notes/my-note.md'
      );

      expect(result.content).toContain('# my-note');
    });

    it('should add .md extension if missing', async () => {
      const result = await createFromTemplate(
        VAULT_PATH,
        'basic',
        'Notes/new-note'
      );

      expect(result.path).toBe('Notes/new-note.md');
    });

    it('should create parent directories if needed', async () => {
      const result = await createFromTemplate(
        VAULT_PATH,
        'basic',
        'Deep/Nested/Folder/note.md'
      );

      expect(result.path).toBe('Deep/Nested/Folder/note.md');
    });

    it('should apply custom variables', async () => {
      const result = await createFromTemplate(
        VAULT_PATH,
        'with-custom',
        'Notes/project-note.md',
        {
          title: 'Project Doc',
          customVars: {
            author: 'Jane Doe',
            project: 'Alpha',
            description: 'Project description here',
          },
        }
      );

      expect(result.content).toContain('Author: Jane Doe');
      expect(result.content).toContain('Project: Alpha');
      expect(result.content).toContain('Project description here');
    });
  });
});
