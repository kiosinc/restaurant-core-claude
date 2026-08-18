import { defineConfig } from 'vitest/config';

/**
 * Emulator-only vitest project (P42 / rcc#166).
 *
 * These tests talk to a real Firestore (the emulator), because the two things they prove —
 * a `create()` `ALREADY_EXISTS` precondition failure and a transaction abort under
 * contention — are exactly what a mocked Firestore cannot observe: a mock returns canned
 * success to both racing callers.
 *
 * Run with:
 *   firebase emulators:exec --only firestore --project demo-p42 "npm run test:emulator"
 *
 * `emulators:exec` injects `FIRESTORE_EMULATOR_HOST` into the child process; the suite
 * self-skips without it (see `describe.skipIf` in the test file), so a run reporting
 * "skipped" means the variable did not reach the test process.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.emu.test.ts'],
    // Real RPCs plus deliberate lease-expiry waits: more headroom than the 5 s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
