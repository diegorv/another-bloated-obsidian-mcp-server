/**
 * Tests for templates tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  handleListTemplates,
  handleGetTemplate,
  handleApplyTemplate,
  handleCreateFromTemplate,
  listTemplatesSchema,
  getTemplateSchema,
  applyTemplateSchema,
  createFromTemplateSchema,
  templateTools,
} from '../../tools/templates.js';
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
      options: { templatesFolder: 'Templates' },
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

describe('templates tools', () => {
  beforeEach(() => {
    vol.reset();
    clearActiveVault();

    vol.fromJSON({
      [`${VAULT_PATH}/.obsidian/config.json`]: '{}',
      [`${VAULT_PATH}/Templates/Note.md`]: `# {{title}}

Created: {{date}}

## Content

`,
      [`${VAULT_PATH}/Templates/Meeting.md`]: `# Meeting: {{title}}

Date: {{date}}
Attendees: {{attendees}}

## Agenda

## Notes

## Action Items

`,
      [`${VAULT_PATH}/Templates/Project.md`]: `---
status: active
---

# Project: {{title}}

## Overview

## Goals

## Timeline

`,
    });
  });

  afterEach(() => {
    vol.reset();
    clearActiveVault();
  });

  describe('schemas', () => {
    it('listTemplatesSchema should accept empty object', () => {
      expect(() => listTemplatesSchema.parse({})).not.toThrow();
    });

    it('getTemplateSchema should require name', () => {
      expect(() => getTemplateSchema.parse({ name: 'Note' })).not.toThrow();
      expect(() => getTemplateSchema.parse({})).toThrow();
    });

    it('applyTemplateSchema should require name', () => {
      expect(() => applyTemplateSchema.parse({ name: 'Note' })).not.toThrow();
      expect(() => applyTemplateSchema.parse({
        name: 'Note',
        title: 'My Note',
        variables: { author: 'John' },
      })).not.toThrow();
      expect(() => applyTemplateSchema.parse({})).toThrow();
    });

    it('createFromTemplateSchema should require template and path', () => {
      expect(() => createFromTemplateSchema.parse({
        template: 'Note',
        path: 'new-note.md',
      })).not.toThrow();
      expect(() => createFromTemplateSchema.parse({
        template: 'Note',
        path: 'new-note.md',
        title: 'My Note',
        variables: { author: 'John' },
      })).not.toThrow();
      expect(() => createFromTemplateSchema.parse({ template: 'Note' })).toThrow();
      expect(() => createFromTemplateSchema.parse({ path: 'new-note.md' })).toThrow();
    });
  });

  describe('templateTools', () => {
    it('should define 4 template tools', () => {
      expect(templateTools.length).toBe(4);
      const names = templateTools.map(t => t.name);
      expect(names).toContain('list_templates');
      expect(names).toContain('get_template');
      expect(names).toContain('apply_template');
      expect(names).toContain('create_from_template');
    });
  });

  describe('handleListTemplates', () => {
    it('should list all templates', async () => {
      const result = await handleListTemplates();

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(3);
      // Templates can be strings or objects with name property
      const templateNames = data.templates.map((t: any) => typeof t === 'string' ? t : t.name);
      expect(templateNames).toContain('Note');
      expect(templateNames).toContain('Meeting');
      expect(templateNames).toContain('Project');
    });

    it('should return folder information', async () => {
      const result = await handleListTemplates();

      const data = JSON.parse(result.content[0].text);
      expect(data.folder).toBeDefined();
    });
  });

  describe('handleGetTemplate', () => {
    it('should get template content', async () => {
      const result = await handleGetTemplate({ name: 'Note' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('Note');
      expect(data.content).toContain('{{title}}');
      expect(data.content).toContain('{{date}}');
    });

    it('should return error for non-existent template', async () => {
      const result = await handleGetTemplate({ name: 'NonExistent' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeDefined();
    });
  });

  describe('handleApplyTemplate', () => {
    it('should apply template with title', async () => {
      const result = await handleApplyTemplate({
        name: 'Note',
        title: 'My Test Note',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('Note');
      expect(data.processedContent).toContain('# My Test Note');
    });

    it('should replace date placeholder', async () => {
      const result = await handleApplyTemplate({
        name: 'Note',
        title: 'Test',
      });

      const data = JSON.parse(result.content[0].text);
      // Date should be replaced with actual date (not contain {{date}})
      expect(data.processedContent).not.toContain('{{date}}');
    });

    it('should apply custom variables', async () => {
      const result = await handleApplyTemplate({
        name: 'Meeting',
        title: 'Team Sync',
        variables: { attendees: 'Alice, Bob, Charlie' },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.processedContent).toContain('Alice, Bob, Charlie');
    });

    it('should return error for non-existent template', async () => {
      const result = await handleApplyTemplate({
        name: 'NonExistent',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleCreateFromTemplate', () => {
    it('should create note from template', async () => {
      const result = await handleCreateFromTemplate({
        template: 'Note',
        path: 'new-note.md',
        title: 'Created Note',
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.path).toBe('new-note.md');
      expect(data.template).toBe('Note');

      // Verify file was created
      const content = vol.readFileSync(`${VAULT_PATH}/new-note.md`, 'utf8') as string;
      expect(content).toContain('# Created Note');
    });

    it('should create note with custom variables', async () => {
      const result = await handleCreateFromTemplate({
        template: 'Meeting',
        path: 'meetings/team-sync.md',
        title: 'Team Sync',
        variables: { attendees: 'Everyone' },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);

      // Verify content includes custom variables
      const content = vol.readFileSync(`${VAULT_PATH}/meetings/team-sync.md`, 'utf8') as string;
      expect(content).toContain('Everyone');
    });

    it('should create note with frontmatter', async () => {
      const result = await handleCreateFromTemplate({
        template: 'Project',
        path: 'projects/new-project.md',
        title: 'New Project',
      });

      expect(result.isError).toBeUndefined();

      // Verify frontmatter is preserved
      const content = vol.readFileSync(`${VAULT_PATH}/projects/new-project.md`, 'utf8') as string;
      expect(content).toContain('status: active');
    });

    it('should return error for non-existent template', async () => {
      const result = await handleCreateFromTemplate({
        template: 'NonExistent',
        path: 'new-note.md',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
    });
  });
});
