import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/lib/**'],
      exclude: ['src/lib/exportService.ts', 'src/lib/icsParser.ts', 'src/lib/notifications.ts'],
    },
  },
});
