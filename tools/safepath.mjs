import { resolve, dirname, sep, basename } from 'path';
import { fileURLToPath } from 'url';
import { realpathSync, mkdirSync } from 'fs';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function assertSafePath(filePath) {
  const abs = resolve(filePath);
  const parent = dirname(abs);
  mkdirSync(parent, { recursive: true });
  const realParent = realpathSync(parent);
  const realOut = resolve(realParent, basename(abs));
  if (!realOut.startsWith(PROJECT_ROOT + sep)) {
    console.error(`Output path must be inside the project directory: ${filePath}`);
    process.exit(1);
  }
}
