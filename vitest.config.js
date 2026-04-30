import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests from the test/ directory
    include: ['test/**/*.test.js'],
    // Node environment (no browser globals needed for engine tests)
    environment: 'node',
    // Reasonable defaults
    globals: false,
    // Show all test names
    reporters: 'verbose'
  }
});
