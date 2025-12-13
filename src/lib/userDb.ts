import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function ensureDir(p: string) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolveUserDb(): string {
    const envPath = process.env.USER_DB_PATH?.trim();
    if (envPath) {
        ensureDir(envPath);
        return envPath;
    }
    const candidate = path.join(process.cwd(), 'src', 'database', 'user.sqlite');
    ensureDir(candidate);
    return candidate;
}

let userDb: Database.Database | null = null;

export function getUserDb() {
    if (!userDb) {
        const p = resolveUserDb();
        userDb = new Database(p);
        initUserDb(userDb);
    }
    return userDb!;
}

function initUserDb(db: Database.Database) {
    // Create users table (idempotent)
    db.exec(
        `CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT,
      image TEXT,
      created_at TEXT NOT NULL
    );`,
    );

    // Handle user_pins table (create or migrate to have user_email and scoped unique)
    const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_pins'").get();
    const cols: Array<{ name: string }> = hasTable ? (db.prepare('PRAGMA table_info(user_pins)').all() as any) : [];
    const hasUserEmail = cols.some((c) => c.name === 'user_email');
    if (!hasTable) {
        db.exec(
            `CREATE TABLE user_pins (
        id TEXT PRIMARY KEY,
        osm_id TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        user_email TEXT NOT NULL,
        UNIQUE(user_email, osm_id)
      );`,
        );
    } else if (!hasUserEmail) {
        db.exec('BEGIN TRANSACTION');
        try {
            db.exec(
                `CREATE TABLE user_pins_new (
          id TEXT PRIMARY KEY,
          osm_id TEXT NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          tags TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          user_email TEXT NOT NULL,
          UNIQUE(user_email, osm_id)
        );`,
            );
            const defaultEmail = 'j.batista@citron.io';
            db.exec(
                `INSERT OR IGNORE INTO user_pins_new (id, osm_id, status, notes, tags, created_at, updated_at, user_email)
         SELECT id, osm_id, status, notes, tags, created_at, updated_at, '${defaultEmail}' FROM user_pins;`,
            );
            db.exec('DROP TABLE user_pins');
            db.exec('ALTER TABLE user_pins_new RENAME TO user_pins');
            db.exec('COMMIT');
        } catch (e) {
            db.exec('ROLLBACK');
            throw e;
        }
    }

    // Add custom-pin columns if missing (idempotent)
    const currentCols: Array<{ name: string }> = db.prepare('PRAGMA table_info(user_pins)').all() as any;
    const colNames = currentCols.map((c) => c.name);
    if (!colNames.includes('custom_name'))     db.exec('ALTER TABLE user_pins ADD COLUMN custom_name     TEXT');
    if (!colNames.includes('custom_lat'))      db.exec('ALTER TABLE user_pins ADD COLUMN custom_lat      REAL');
    if (!colNames.includes('custom_lng'))      db.exec('ALTER TABLE user_pins ADD COLUMN custom_lng      REAL');
    if (!colNames.includes('custom_address'))  db.exec('ALTER TABLE user_pins ADD COLUMN custom_address  TEXT');
    if (!colNames.includes('custom_com_nom'))  db.exec('ALTER TABLE user_pins ADD COLUMN custom_com_nom  TEXT');
    if (!colNames.includes('custom_postal_code'))db.exec('ALTER TABLE user_pins ADD COLUMN custom_postal_code TEXT');

    // Ensure a default user exists (useful for legacy/migrations in dev)
    const now = new Date().toISOString();
    db.prepare(`INSERT OR IGNORE INTO users (email, name, image, created_at) VALUES (?, ?, ?, ?)`).run('j.batista@citron.io', 'Default User', null, now);
}
