/**
 * Tests for tool groups configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseToolGroups,
  initToolGroups,
  getEnabledTools,
  isToolEnabled,
  getEnabledGroups,
  getGroupsHelp,
  ALL_GROUPS,
  type ToolGroup,
} from './tool-groups.js';

describe('tool-groups', () => {
  describe('parseToolGroups', () => {
    it('should return all groups for "all"', () => {
      const groups = parseToolGroups('all');
      expect(groups).toEqual(ALL_GROUPS);
    });

    it('should return all groups for empty string', () => {
      const groups = parseToolGroups('');
      expect(groups).toEqual(ALL_GROUPS);
    });

    it('should return empty array for "none"', () => {
      const groups = parseToolGroups('none');
      expect(groups).toEqual([]);
    });

    it('should parse comma-separated groups', () => {
      const groups = parseToolGroups('vault,notes,search');
      expect(groups).toContain('vault');
      expect(groups).toContain('notes');
      expect(groups).toContain('search');
      expect(groups.length).toBe(3);
    });

    it('should handle whitespace in group names', () => {
      const groups = parseToolGroups('vault , notes , search');
      expect(groups).toContain('vault');
      expect(groups).toContain('notes');
      expect(groups).toContain('search');
    });

    it('should be case insensitive', () => {
      const groups = parseToolGroups('VAULT,Notes,SEARCH');
      expect(groups).toContain('vault');
      expect(groups).toContain('notes');
      expect(groups).toContain('search');
    });

    it('should ignore unknown groups', () => {
      const groups = parseToolGroups('vault,unknown,notes');
      expect(groups).toContain('vault');
      expect(groups).toContain('notes');
      expect(groups).not.toContain('unknown');
      expect(groups.length).toBe(2);
    });

    it('should handle all known groups', () => {
      const allGroupsStr = ALL_GROUPS.join(',');
      const groups = parseToolGroups(allGroupsStr);
      expect(groups).toEqual(ALL_GROUPS);
    });
  });

  describe('ALL_GROUPS', () => {
    it('should contain all expected groups', () => {
      const expectedGroups: ToolGroup[] = [
        'vault',
        'notes',
        'search',
        'frontmatter',
        'tags',
        'links',
        'daily',
        'templates',
        'bases',
        'batch',
        'attachments',
        'backup',
      ];

      expectedGroups.forEach(group => {
        expect(ALL_GROUPS).toContain(group);
      });
    });

    it('should have 12 groups', () => {
      expect(ALL_GROUPS.length).toBe(12);
    });
  });

  describe('isToolEnabled', () => {
    beforeEach(() => {
      // Initialize with all groups
      initToolGroups();
    });

    it('should return true for vault tools when all enabled', () => {
      expect(isToolEnabled('list_vaults')).toBe(true);
      expect(isToolEnabled('set_active_vault')).toBe(true);
      expect(isToolEnabled('register_vault')).toBe(true);
    });

    it('should return true for notes tools when all enabled', () => {
      expect(isToolEnabled('list_notes')).toBe(true);
      expect(isToolEnabled('read_note')).toBe(true);
      expect(isToolEnabled('create_note')).toBe(true);
      expect(isToolEnabled('update_note')).toBe(true);
      expect(isToolEnabled('delete_note')).toBe(true);
    });

    it('should return false for unknown tools', () => {
      expect(isToolEnabled('unknown_tool')).toBe(false);
    });
  });

  describe('getEnabledGroups', () => {
    beforeEach(() => {
      initToolGroups();
    });

    it('should return all groups by default', () => {
      const groups = getEnabledGroups();
      expect(groups).toEqual(ALL_GROUPS);
    });
  });

  describe('getEnabledTools', () => {
    beforeEach(() => {
      initToolGroups();
    });

    it('should return array of tools', () => {
      const tools = getEnabledTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('getGroupsHelp', () => {
    it('should return help text', () => {
      const help = getGroupsHelp();

      expect(help).toContain('Available tool groups:');
      expect(help).toContain('vault');
      expect(help).toContain('notes');
      expect(help).toContain('search');
      expect(help).toContain('frontmatter');
      expect(help).toContain('tags');
      expect(help).toContain('links');
      expect(help).toContain('daily');
      expect(help).toContain('templates');
      expect(help).toContain('bases');
      expect(help).toContain('batch');
      expect(help).toContain('attachments');
      expect(help).toContain('backup');
    });

    it('should include special values', () => {
      const help = getGroupsHelp();

      expect(help).toContain('all');
      expect(help).toContain('none');
    });

    it('should include usage examples', () => {
      const help = getGroupsHelp();

      expect(help).toContain('--tools=');
      expect(help).toContain('OBSIDIAN_MCP_TOOLS');
    });
  });
});
