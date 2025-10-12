import { cpSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '..', 'src', 'backend', 'migrations');
const destDir = join(__dirname, '..', 'dist', 'backend', 'migrations');

console.log('Copying SQL migrations from', srcDir, 'to', destDir);
mkdirSync(destDir, { recursive: true });

// Only copy .sql files, not .ts files (those are compiled by tsc)
const sqlFiles = readdirSync(srcDir).filter(f => f.endsWith('.sql'));
sqlFiles.forEach(file => {
  cpSync(join(srcDir, file), join(destDir, file));
});

console.log(`Migrations copied successfully (${sqlFiles.length} SQL files)`);
