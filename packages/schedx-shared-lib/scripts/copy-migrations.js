import { cpSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '..', 'src', 'backend', 'migrations');
const destDir = join(__dirname, '..', 'dist', 'backend', 'migrations');

console.log('Copying migrations from', srcDir, 'to', destDir);
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
cpSync(srcDir, destDir, { recursive: true });
const copiedEntries = readdirSync(destDir);
console.log(`Migrations copied successfully (${copiedEntries.length} files)`);
