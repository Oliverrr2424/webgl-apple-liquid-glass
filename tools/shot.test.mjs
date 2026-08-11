import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlinkSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { assertSafePath, PROJECT_ROOT } from './safepath.mjs';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));

test('in-project path is allowed', () => {
  assert.doesNotThrow(() => assertSafePath('shots/test-output.png'));
});

test('absolute path outside project is rejected', () => {
  assert.throws(
    () => {
      // assertSafePath calls process.exit(1), so we intercept it
      const orig = process.exit;
      process.exit = (code) => { throw new Error(`exit:${code}`); };
      try {
        assertSafePath('/tmp/escape.png');
      } finally {
        process.exit = orig;
      }
    },
    /exit:1/
  );
});

test('directory traversal path is rejected', () => {
  assert.throws(
    () => {
      const orig = process.exit;
      process.exit = (code) => { throw new Error(`exit:${code}`); };
      try {
        assertSafePath('../outside.png');
      } finally {
        process.exit = orig;
      }
    },
    /exit:1/
  );
});

test('symlink inside project pointing outside is rejected', () => {
  const symlinkPath = join(PROJECT_ROOT, 'shots', 'evil-link');
  try {
    symlinkSync('/tmp', symlinkPath);
    assert.throws(
      () => {
        const orig = process.exit;
        process.exit = (code) => { throw new Error(`exit:${code}`); };
        try {
          assertSafePath('shots/evil-link/escape.png');
        } finally {
          process.exit = orig;
        }
      },
      /exit:1/
    );
  } finally {
    try { unlinkSync(symlinkPath); } catch (_) {}
  }
});
