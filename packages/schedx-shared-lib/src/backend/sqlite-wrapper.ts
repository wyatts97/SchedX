import Database from '@journeyapps/sqlcipher';
import { randomUUID } from 'crypto';

export interface SqliteConfig {
  path: string;
  encryptionKey?: string;
  verbose?: boolean;
}

/**
 * SQLite database wrapper with encryption support
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

    // Open database with encryption if key provided
    const options: any = this.config.verbose ? { verbose: console.log } : {};
    this.db = new (Database as any)(this.config.path, options);

    // Set encryption key if provided (SQLCipher)
    if (this.config.encryptionKey) {
      this.db.pragma(`key = '${this.config.encryptionKey}'`);
    }

    // Performance optimizations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('foreign_keys = ON');

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
   * Execute a query that returns rows
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.connect();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute a query that returns a single row
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
   * Execute multiple statements in a transaction
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
