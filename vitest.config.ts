import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    // `*.emu.test.ts` needs a live Firestore emulator, so it must never run in `npm test`.
    // Setting `exclude` *overrides* vitest's defaults, so the node_modules/dist entries have to
    // be restated here — omitting them would make the default suite walk node_modules.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/__tests__/**/*.emu.test.ts'],
  },
});
