import { resolve, dirname, sep, basename, join } from 'path';
import { fileURLToPath } from 'url';
import {
  realpathSync,
  mkdirSync,
  lstatSync,
  mkdtempSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'fs';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function reject(filePath) {
  console.error(`Output path must be inside the project directory: ${filePath}`);
  process.exit(1);
}

export function assertSafePath(filePath) {
  const abs = resolve(filePath);

  // Walk up to the nearest existing ancestor without creating anything
  let ancestor = dirname(abs);
  const suffix = [basename(abs)];
  while (true) {
    try { realpathSync(ancestor); break; } catch (_) {}
    const parent = dirname(ancestor);
    if (parent === ancestor) break; // reached filesystem root
    suffix.unshift(basename(ancestor));
    ancestor = parent;
  }
  const realOut = join(realpathSync(ancestor), ...suffix);

  // Containment check before any mutation
  if (!realOut.startsWith(PROJECT_ROOT + sep)) reject(filePath);

  // Reject an existing output file that is itself a symlink
  try {
    if (lstatSync(abs).isSymbolicLink()) reject(filePath);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e; // file doesn't exist yet — fine; rethrow anything else
  }

  // Safe to create parent directories now
  mkdirSync(dirname(abs), { recursive: true });
  return abs;
}

export function writeSafeFile(filePath, data) {
  const abs = assertSafePath(filePath);
  const tempDir = mkdtempSync(join(dirname(abs), '.shot-'));
  const tempPath = join(tempDir, basename(abs));

  try {
    writeFileSync(tempPath, data, { flag: 'wx' });
    // Renaming replaces the directory entry instead of following an existing
    // destination inode, so hard links cannot redirect the write elsewhere.
    renameSync(tempPath, abs);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
