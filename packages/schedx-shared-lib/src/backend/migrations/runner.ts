import { SqliteDatabase } from '../sqlite-wrapper';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run database migrations
 */
export async function runMigrations(db: SqliteDatabase): Promise<void> {
  console.log('Running database migrations...');

  // Read and execute the initial schema
  const schemaPath = join(__dirname, '001_initial_schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  // Split by semicolon and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  db.transaction(() => {
    for (const statement of statements) {
      db.execute(statement + ';');
    }
  });

  console.log('✅ Database migrations completed');
}

/**
 * Seed default admin user
 */
export async function seedDefaultAdmin(
  db: SqliteDatabase,
  email: string,
  password: string
): Promise<void> {
  // Check if admin already exists
  const existing = db.queryOne(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existing) {
    console.log('✅ Default admin user already exists');
    return;
  }

  // Create admin user
  const id = db.generateId();
  const now = db.now();

  db.execute(
    `INSERT INTO users (id, email, password, displayName, role, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, email, password, 'Admin', 'admin', now]
  );

  console.log('✅ Default admin user created');
}
