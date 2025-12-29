import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import pino from 'pino';

// Create require function for ES modules
const require = createRequire(import.meta.url);

// Import better-sqlite3
const Database = require('better-sqlite3');

// Create logger for database operations
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime
});

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
      verbose: this.config.verbose ? ((msg: string) => logger.debug({ sql: msg }, 'SQL query')) : undefined
    });

    // Note: For production encryption, you need to compile better-sqlite3 with SQLCipher support
    // or use a pre-built SQLCipher binary. This is a development configuration.
    if (this.config.encryptionKey) {
      try {
        // Attempt to set encryption key using SQLCipher PRAGMA
        // This will only work if better-sqlite3 is compiled with SQLCipher support
        this.db.pragma(`key = '${this.config.encryptionKey}'`);
        logger.info('Database encryption key set (requires SQLCipher-enabled better-sqlite3)');
      } catch (error) {
        logger.warn({ error }, 'Database encryption not available - using unencrypted database. For production, compile better-sqlite3 with SQLCipher support.');
      }
    } else {
      logger.warn('Database encryption key not provided - database will be unencrypted');
    }

    // Performance optimizations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('wal_autocheckpoint = 1000');
    
    // Checkpoint WAL file to reclaim disk space
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      logger.debug('WAL checkpoint completed');
    } catch (error) {
      logger.warn({ error }, 'WAL checkpoint failed (non-critical)');
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
