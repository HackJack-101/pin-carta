#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const Database = require('better-sqlite3');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Placeholder mapping - will be loaded from file
let INSEE_TO_POSTAL = {};

/**
 * Load the INSEE to postal code mapping from a CSV file.
 * @param {string} filePath - Path to the INSEE to postal CSV file
 * @param {string} delimiter - CSV delimiter
 * @returns {Promise<Object>} - Object mapping INSEE codes to postal codes
 */
async function loadInseeToPostal(filePath, delimiter) {
    if (!fs.existsSync(filePath)) {
        console.error(`INSEE to postal CSV file not found: ${filePath}`);
        process.exitCode = 1;
        return {};
    }

    return new Promise((resolve, reject) => {
        const mapping = {};

        const parser = fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(
            parse({
                delimiter,
                columns: true,
                bom: true,
                relax_column_count: true,
                skip_empty_lines: true,
                trim: true,
            }),
        );

        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                const inseeCode = record['Code_commune_INSEE'];
                const postalCode = record['Code_postal'];

                if (inseeCode && postalCode) {
                    // Some communes may have multiple postal codes; we keep the first one
                    if (!mapping[inseeCode]) {
                        mapping[inseeCode] = postalCode;
                    }
                }
            }
        });

        parser.on('end', () => {
            resolve(mapping);
        });

        parser.on('error', (err) => {
            console.error('Error parsing INSEE to postal CSV:', err.message || err);
            reject(err);
        });
    });
}

/**
 * Ensure the postal_code column exists in the places table.
 * @param {Database} db - SQLite database instance
 * @param {string} table - Table name
 */
function ensurePostalCodeColumn(db, table) {
    // Check if column exists
    const tableInfo = db.prepare(`PRAGMA table_info("${table}")`).all();
    const hasPostalCode = tableInfo.some((col) => col.name === 'postal_code');

    if (!hasPostalCode) {
        console.log(`Adding 'postal_code' column to table '${table}'...`);
        db.exec(`ALTER TABLE "${table}" ADD COLUMN "postal_code" TEXT`);
        console.log(`Column 'postal_code' added successfully.\n`);
    } else {
        console.log(`Column 'postal_code' already exists in table '${table}'.\n`);
    }
}

/**
 * Update rows without postal codes in batches.
 * @param {Database} db - SQLite database instance
 * @param {string} table - Table name
 * @param {Object} inseeToPostal - Mapping of INSEE codes to postal codes
 * @param {number} batchSize - Number of rows to process per batch
 */
function updatePostalCodes(db, table, inseeToPostal, batchSize) {
    // First, count total rows that need updating
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${table}" WHERE postal_code IS NULL`).get();
    const totalRows = countResult.count;

    if (totalRows === 0) {
        console.log('No rows need updating. All postal codes are already set.\n');
        return { totalProcessed: 0, totalUpdated: 0, totalNotFound: 0 };
    }

    console.log(`Found ${totalRows} rows without postal codes.\n`);

    // Prepare statements - use OFFSET to iterate through rows exactly once
    const selectStmt = db.prepare(`
        SELECT rowid, postal_code, name 
        FROM "${table}" 
        WHERE postal_code IS NULL 
        LIMIT ? OFFSET ?
    `);

    const updateStmt = db.prepare(`
        UPDATE "${table}" 
        SET postal_code = ? 
        WHERE rowid = ?
    `);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalNotFound = 0;
    let offset = 0;

    // Process in batches using OFFSET to iterate through all rows exactly once
    while (offset < totalRows) {
        const batchNumber = Math.floor(offset / batchSize) + 1;
        const rows = selectStmt.all(batchSize, offset);

        if (rows.length === 0) {
            break;
        }

        console.log(`Processing batch ${batchNumber}/${Math.ceil(totalRows / batchSize)} (${rows.length} rows)...`);

        // Use a transaction for each batch
        const updateBatch = db.transaction((rows) => {
            for (const row of rows) {
                totalProcessed++;
                const inseeCode = row.com_insee;

                if (!inseeCode) {
                    console.warn(`  Warning: No INSEE code for place "${row.name}" (rowid: ${row.rowid})`);
                    totalNotFound++;
                    continue;
                }

                const postalCode = inseeToPostal[inseeCode];

                if (postalCode) {
                    updateStmt.run(postalCode, row.rowid);
                    totalUpdated++;
                } else {
                    console.warn(`  Warning: No postal code found for place "${row.name}" with INSEE code ${inseeCode}`);
                    totalNotFound++;
                }
            }
        });

        updateBatch(rows);
        offset += batchSize;
    }

    return { totalProcessed, totalUpdated, totalNotFound };
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('insee', {
            type: 'string',
            default: './fixtures/laposte_hexasmal.csv',
            describe: 'Path to INSEE to postal code CSV file',
        })
        .option('db', {
            type: 'string',
            default: './src/database/places.sqlite',
            describe: 'Path to SQLite database file to update',
        })
        .option('table', {
            type: 'string',
            default: 'places',
            describe: 'Table name to update',
        })
        .option('delimiter', {
            type: 'string',
            default: ';',
            describe: 'CSV delimiter',
        })
        .option('batch-size', {
            type: 'number',
            default: 500,
            describe: 'Number of rows to process per batch',
        })
        .help()
        .strict().argv;

    const inseePath = path.resolve(argv.insee);
    const dbPath = path.resolve(argv.db);
    const table = String(argv.table);
    const delimiter = String(argv.delimiter || ';');
    const batchSize = argv['batch-size'] || 500;

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
        console.error(`Database file not found: ${dbPath}`);
        process.exitCode = 1;
        return;
    }

    console.log('='.repeat(60));
    console.log('INSEE to Postal Code Transformation');
    console.log('='.repeat(60));
    console.log(`Database: ${dbPath}`);
    console.log(`Table: ${table}`);
    console.log(`Batch size: ${batchSize}`);
    console.log('='.repeat(60) + '\n');

    // Load INSEE to postal mapping
    console.log('Step 1: Loading INSEE to postal code mapping...');
    INSEE_TO_POSTAL = await loadInseeToPostal(inseePath, delimiter);
    console.log(`Loaded ${Object.keys(INSEE_TO_POSTAL).length} INSEE to postal mappings.\n`);

    // Open database
    const db = new Database(dbPath);
    try {
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // Step 1: Ensure postal_code column exists
        console.log('Step 2: Ensuring postal_code column exists...');
        ensurePostalCodeColumn(db, table);

        // Step 2: Update rows without postal codes
        console.log('Step 3: Updating postal codes...\n');
        const { totalProcessed, totalUpdated, totalNotFound } = updatePostalCodes(db, table, INSEE_TO_POSTAL, batchSize);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('Summary');
        console.log('='.repeat(60));
        console.log(`Total rows processed: ${totalProcessed}`);
        console.log(`Successfully updated: ${totalUpdated}`);
        console.log(`Skipped (no postal code found): ${totalNotFound}`);
        console.log('='.repeat(60));
    } catch (e) {
        console.error('Failed to update postal codes:', e.message || e);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
