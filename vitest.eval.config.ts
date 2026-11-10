import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// pnpm eval:ai (doc 03, section 8): the AI eval cases against the live model. Needs GEMINI_PUBLIC_API_KEY in the shell.
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/eval/**/*.test.ts'], testTimeout: 30 * 60_000 } });
