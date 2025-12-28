/**
 * Global test setup for Vitest
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress console.error output during tests unless in debug mode
if (!process.env.DEBUG_TESTS) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}
