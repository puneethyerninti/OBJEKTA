import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.{js,jsx}',
      'src/**/__tests__/**/*.{test,spec}.{js,jsx}',
    ],
    exclude: [
      'backend/**',
      'tests/**',
      'node_modules/**',
      'dist/**',
    ],
  },
});
