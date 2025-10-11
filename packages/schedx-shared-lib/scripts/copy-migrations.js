import { cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '..', 'src', 'backend', 'migrations');
const destDir = join(__dirname, '..', 'dist', 'backend', 'migrations');

console.log('Copying migrations from', srcDir, 'to', destDir);
cpSync(srcDir, destDir, { recursive: true });
console.log('Migrations copied successfully');
