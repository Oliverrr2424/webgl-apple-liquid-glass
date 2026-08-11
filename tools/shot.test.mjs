import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { symlinkSync, unlinkSync } from 'fs';
import { join } from 'path';
import { assertSafePath, PROJECT_ROOT } from './safepath.mjs';

function withExitIntercept(fn) {
  const orig = process.exit;
  process.exit = (code) => { throw new Error(`exit:${code}`); };
  try { fn(); } finally { process.exit = orig; }
}

test('in-project path is allowed', () => {
  assert.doesNotThrow(() => assertSafePath('shots/test-output.png'));
});

test('absolute path outside project is rejected', () => {
  assert.throws(() => withExitIntercept(() => assertSafePath('/tmp/escape.png')), /exit:1/);
});

test('directory traversal path is rejected', () => {
  assert.throws(() => withExitIntercept(() => assertSafePath('../outside.png')), /exit:1/);
});

test('symlink inside project pointing outside (parent dir) is rejected', () => {
  const name = `evil-link-${randomUUID()}`;
  const symlinkPath = join(PROJECT_ROOT, 'shots', name);
  let created = false;
  try {
    symlinkSync('/tmp', symlinkPath);
    created = true;
    assert.throws(
      () => withExitIntercept(() => assertSafePath(`shots/${name}/escape.png`)),
      /exit:1/
    );
  } finally {
    if (created) try { unlinkSync(symlinkPath); } catch (_) {}
  }
});

test('output file that is a symlink is rejected', () => {
  const name = `out-symlink-${randomUUID()}.png`;
  const symlinkPath = join(PROJECT_ROOT, 'shots', name);
  let created = false;
  try {
    symlinkSync('/tmp/target.png', symlinkPath);
    created = true;
    assert.throws(
      () => withExitIntercept(() => assertSafePath(`shots/${name}`)),
      /exit:1/
    );
  } finally {
    if (created) try { unlinkSync(symlinkPath); } catch (_) {}
  }
});
