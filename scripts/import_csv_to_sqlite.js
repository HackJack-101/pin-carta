#!/usr/bin/env node

/*
  Import a semicolon-delimited CSV (default: ./data.csv) into a local SQLite DB (default: ./data.db)
  Requirements parity with the Python version:
  - Columns: X, Y as REAL NOT NULL; osm_id, type as TEXT NOT NULL; all others TEXT
  - Skip rows missing any NOT NULL fields
  - Create table if not exists; truncate by default unless --no-truncate is given
  - Print total/inserted/skipped counts
*/

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const Database = require('better-sqlite3');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const COLUMNS = [
    'X',
    'Y',
    'osm_id',
    'type',
    'name',
    'brand',
    'operator',
    'wheelchair',
    'opening_hours',
    'level',
    'siret',
    'profession_ref',
    'wikidata',
    'website',
    'phone',
    'email',
    'facebook',
    'address',
    'com_insee',
    'com_nom',
    'last_update',
];

const SCHEMA_TYPES = {
    X: 'REAL NOT NULL',
    Y: 'REAL NOT NULL',
    osm_id: 'TEXT NOT NULL',
    type: 'TEXT NOT NULL',
};

// Only import rows whose `type` is in this allowlist
const ALLOWED_TYPES = new Set(['bar', 'cafe', 'fast_food', 'food_court', 'ice_cream', 'pub', 'restaurant']);

function buildCreateTableSQL(table, header) {
    const cols = header.map((c) => `"${c}" ${SCHEMA_TYPES[c] || 'TEXT'}`).join(',\n  ');
    return `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${cols}\n);`;
}

function prepareInsertSQL(table, header) {
    const cols = header.map((c) => `"${c}"`).join(', ');
    const placeholders = header.map(() => '?').join(', ');
    return `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`;
}

function coerceValue(key, raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    if (key === 'X' || key === 'Y') {
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    return s;
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('csv', {
            type: 'string',
            default: 'data.csv',
            describe: 'Path to input CSV file',
        })
        .option('db', {
            type: 'string',
            default: './src/database/places.sqlite',
            describe: 'Path to output SQLite database file',
        })
        .option('table', {
            type: 'string',
            default: 'places',
            describe: 'Table name to import into',
        })
        .option('delimiter', {
            type: 'string',
            default: ';',
            describe: 'CSV delimiter',
        })
        .option('no-truncate', {
            type: 'boolean',
            default: false,
            describe: 'Do not clear the table before import',
        })
        .help()
        .strict().argv;

    const csvPath = path.resolve(argv.csv);
    const dbPath = path.resolve(argv.db);
    const table = String(argv.table);
    const delimiter = String(argv.delimiter || ';');
    const truncate = !argv['no-truncate'];

    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found: ${csvPath}`);
        process.exitCode = 1;
        return;
    }

    // Prepare CSV parser
    const parser = fs.createReadStream(csvPath, { encoding: 'utf8' }).pipe(
        parse({
            delimiter,
            columns: true, // produce objects keyed by header
            bom: true,
            relax_column_count: true,
            skip_empty_lines: true,
            trim: true,
        }),
    );

    let header = null; // filtered header list
    let total = 0;
    let inserted = 0;
    let skipped = 0;

    // Open DB
    const db = new Database(dbPath);
    try {
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // We will lazily init table and insert statement on first chunk after header known
        let insertStmt = null;
        let beginTxn = null;
        let commitTxn = null;

        // To detect header, we need the original headers from the parser. csv-parse exposes it on first record via info
        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                if (!header) {
                    // Determine header: keep only known columns, in the order defined by COLUMNS
                    const recordKeys = Object.keys(record);
                    header = COLUMNS.filter((c) => recordKeys.includes(c));
                    for (const req of ['X', 'Y', 'osm_id', 'type']) {
                        if (!header.includes(req)) {
                            throw new Error(`Required column '${req}' not found in CSV header`);
                        }
                    }

                    // Create table if needed
                    const createSQL = buildCreateTableSQL(table, header);
                    db.exec(createSQL);

                    if (truncate) {
                        db.exec(`DELETE FROM "${table}";`);
                    }

                    const insertSQL = prepareInsertSQL(table, header);
                    insertStmt = db.prepare(insertSQL);
                    beginTxn = db.prepare('BEGIN');
                    commitTxn = db.prepare('COMMIT');
                    beginTxn.run(); // start transaction
                }

                total += 1;
                // Enforce allowlist on `type`
                const rawType = record['type'];
                const typeVal = rawType == null ? null : String(rawType).trim();
                if (typeVal == null || !ALLOWED_TYPES.has(typeVal)) {
                    // Disallowed or missing type
                    skipped += 1;
                    continue;
                }
                // Build row values in header order with coercion
                const values = header.map((k) => coerceValue(k, record[k]));
                const badRequired =
                    values[header.indexOf('X')] == null ||
                    values[header.indexOf('Y')] == null ||
                    values[header.indexOf('osm_id')] == null ||
                    values[header.indexOf('type')] == null;
                if (badRequired) {
                    skipped += 1;
                    continue;
                }
                insertStmt.run(values);
                inserted += 1;
            }
        });

        parser.on('end', () => {
            // finalize
            if (beginTxn && commitTxn) {
                commitTxn.run();
            }
            console.log(`Done. Total rows: ${total}, inserted: ${inserted}, skipped (missing required fields or disallowed type): ${skipped}`);
        });

        parser.on('error', (err) => {
            // rollback if in txn
            try {
                db.exec('ROLLBACK;');
            } catch {}
            console.error('Error while parsing/importing CSV:', err.message || err);
            process.exitCode = 1;
        });
    } catch (e) {
        try {
            db.exec('ROLLBACK;');
        } catch {}
        console.error('Failed to import CSV:', e.message || e);
        process.exitCode = 1;
    } finally {
        // Delay close until stream end. Attach a handler.
        const closeDb = () => {
            try {
                db.close();
            } catch {}
        };
        // Close after the current tick to allow 'end' handler to run commit first
        parser.on('end', () => setImmediate(closeDb));
        parser.on('error', () => setImmediate(closeDb));
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
