import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'src/**/*.test.ts',
        'src/__tests__/**',
        'vitest.config.ts',
      ],
    },
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 10000,
  },
});
