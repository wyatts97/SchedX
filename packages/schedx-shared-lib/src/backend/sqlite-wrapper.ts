import { randomUUID } from 'crypto';
import { createRequire } from 'module';

// Create require function for ES modules
const require = createRequire(import.meta.url);

// Import better-sqlite3
const Database = require('better-sqlite3');

export interface SqliteConfig {
  path: string;
  encryptionKey?: string;
  verbose?: boolean;
}

/**
 * SQLite database wrapper (using better-sqlite3 - synchronous)
 */
export class SqliteDatabase {
  private db: any = null;
  private config: SqliteConfig;

  constructor(config: SqliteConfig) {
    this.config = config;
  }

  /**
   * Connect to the database and initialize
   */
  connect(): any {
    if (this.db) {
      return this.db;
    }

    // Open database with better-sqlite3 (synchronous)
    this.db = new Database(this.config.path, {
      verbose: this.config.verbose ? console.log : undefined
    });

    // Performance optimizations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('foreign_keys = ON');

    // Note: better-sqlite3 doesn't support encryption natively
    // For production, consider using SQLCipher build of better-sqlite3
    if (this.config.encryptionKey) {
      console.warn('Warning: Encryption key provided but better-sqlite3 does not support encryption by default');
    }

    return this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Execute a query that returns rows (synchronous with better-sqlite3)
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute a query that returns a single row (synchronous)
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  /**
   * Execute a query that doesn't return rows (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params: any[] = []): any {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * Execute multiple statements in a transaction (synchronous)
   */
  transaction<T>(fn: () => T): T {
    const db = this.connect();
    const transaction = db.transaction(fn);
    return transaction();
  }

  /**
   * Generate a new UUID for primary keys
   */
  generateId(): string {
    return randomUUID();
  }

  /**
   * Get current timestamp in milliseconds
   */
  now(): number {
    return Date.now();
  }

  /**
   * Parse JSON field from database
   */
  parseJson<T = any>(value: string | null): T | null {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Stringify JSON field for database
   */
  stringifyJson(value: any): string | null {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
  }

  /**
   * Convert boolean to SQLite integer
   */
  toInt(value: boolean): number {
    return value ? 1 : 0;
  }

  /**
   * Convert SQLite integer to boolean
   */
  toBool(value: number): boolean {
    return value === 1;
  }
}
