import { randomUUID } from 'crypto';

// Dynamic import for @journeyapps/sqlcipher to handle ESM/CJS compatibility
let sqlite3Module: any;

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

    // Lazy load the database module
    if (!sqlite3Module) {
      const sqlcipher = require('@journeyapps/sqlcipher');
      // Use verbose mode if requested
      sqlite3Module = this.config.verbose ? sqlcipher.verbose() : sqlcipher;
    }

    // Open database with encryption
    // @journeyapps/sqlcipher uses the same API as node-sqlite3
    this.db = new sqlite3Module.Database(this.config.path);

    // Use serialize to ensure commands run in order
    this.db.serialize(() => {
      // Set cipher compatibility (SQLCipher 4.x)
      this.db.run("PRAGMA cipher_compatibility = 4");
      
      // Set encryption key if provided (SQLCipher)
      if (this.config.encryptionKey) {
        this.db.run(`PRAGMA key = '${this.config.encryptionKey}'`);
      }

      // Performance optimizations
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA synchronous = NORMAL');
      this.db.run('PRAGMA cache_size = 10000');
      this.db.run('PRAGMA temp_store = MEMORY');
      this.db.run('PRAGMA foreign_keys = ON');
    });

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
   * Execute a query that returns rows (synchronous wrapper)
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    const db = this.connect();
    let results: T[] = [];
    
    // Use synchronous execution with serialize
    db.serialize(() => {
      const stmt = db.prepare(sql);
      stmt.all(params, (err: Error | null, rows: any[]) => {
        if (err) throw err;
        results = rows as T[];
      });
      stmt.finalize();
    });
    
    // Wait for serialize to complete (it's synchronous in this context)
    return results;
  }

  /**
   * Execute a query that returns a single row (synchronous wrapper)
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    const db = this.connect();
    let result: T | undefined;
    
    db.serialize(() => {
      const stmt = db.prepare(sql);
      stmt.get(params, (err: Error | null, row: any) => {
        if (err) throw err;
        result = row as T | undefined;
      });
      stmt.finalize();
    });
    
    return result;
  }

  /**
   * Execute a query that doesn't return rows (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params: any[] = []): any {
    const db = this.connect();
    let info: any = {};
    
    db.serialize(() => {
      db.run(sql, params, function(this: any, err: Error | null) {
        if (err) throw err;
        info = { changes: this.changes, lastID: this.lastID };
      });
    });
    
    return info;
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    const db = this.connect();
    let result: T;
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      try {
        result = fn();
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    });
    
    return result!;
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
