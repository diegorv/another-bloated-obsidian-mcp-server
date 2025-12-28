/**
 * Tests for the logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ mtime: new Date() })),
  unlinkSync: vi.fn(),
}));

describe('Logger', () => {
  let Logger: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Reset modules to get fresh instance
    vi.resetModules();
    originalEnv = { ...process.env };

    // Re-import logger after mocks are set up
    const module = await import('../../utils/logger.js');
    Logger = module.default;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('log directory', () => {
    it('should create log directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      vi.resetModules();

      await import('../../utils/logger.js');

      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should log error messages', () => {
      Logger.error('Test error message');

      expect(fs.appendFileSync).toHaveBeenCalled();
      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('ERROR');
      expect(call[1]).toContain('Test error message');
    });

    it('should log warning messages', () => {
      Logger.warn('Test warning message');

      expect(fs.appendFileSync).toHaveBeenCalled();
      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('WARN');
      expect(call[1]).toContain('Test warning message');
    });

    it('should log info messages', () => {
      Logger.info('Test info message');

      expect(fs.appendFileSync).toHaveBeenCalled();
      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('INFO');
      expect(call[1]).toContain('Test info message');
    });
  });

  describe('log formatting', () => {
    it('should include timestamp in log messages', () => {
      Logger.info('Test message');

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      // Should match ISO timestamp format
      expect(call[1]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format Error objects with stack trace', () => {
      const error = new Error('Test error');
      Logger.error('Error occurred', error);

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('Error: Test error');
      expect(call[1]).toContain('Stack:');
    });

    it('should format object data as JSON', () => {
      const data = { key: 'value', count: 42 };
      Logger.info('Data log', data);

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('Data:');
      expect(call[1]).toContain('"key": "value"');
      expect(call[1]).toContain('"count": 42');
    });

    it('should format primitive data', () => {
      Logger.info('String data', 'test string');

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('Data: test string');
    });
  });

  describe('logToolCall', () => {
    it('should log successful tool calls', () => {
      Logger.logToolCall('test_tool', { arg: 'value' }, true);

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('INFO');
      expect(call[1]).toContain('Tool call: test_tool');
    });

    it('should log failed tool calls as errors', () => {
      const error = new Error('Tool failed');
      Logger.logToolCall('test_tool', { arg: 'value' }, false, error);

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('ERROR');
      expect(call[1]).toContain('Tool call failed: test_tool');
    });
  });

  describe('logServerEvent', () => {
    it('should log server events', () => {
      Logger.logServerEvent('startup', { version: '1.0.0' });

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      expect(call[1]).toContain('INFO');
      expect(call[1]).toContain('Server event: startup');
    });
  });

  describe('log file naming', () => {
    it('should use date-based log file names', () => {
      Logger.info('Test message');

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      const logPath = call[0] as string;

      // Should match format: mcp-server-YYYY-MM-DD.log
      expect(logPath).toMatch(/mcp-server-\d{4}-\d{2}-\d{2}\.log$/);
    });
  });

  describe('error handling', () => {
    it('should handle appendFileSync errors gracefully', () => {
      vi.mocked(fs.appendFileSync).mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

      // Should not throw
      expect(() => Logger.info('Test message')).not.toThrow();
    });
  });
});
