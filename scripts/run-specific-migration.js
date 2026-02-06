import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('Error: DATABASE_URL is not defined in .env file.');
    process.exit(1);
}

const client = new pg.Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function runMigration(filename) {
    try {
        if (!filename) {
            throw new Error('Please provide a migration filename (e.g., whatsapp_FINAL_fix.sql)');
        }

        const migrationPath = path.join(__dirname, '../supabase/migrations', filename);

        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }

        await client.connect();
        console.log('Connected to database...');

        console.log(`Running migration: ${filename}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await client.query(sql);
        console.log(`✅ Success: ${filename}`);

    } catch (err) {
        console.error('Error running migration:', err.message);
    } finally {
        await client.end();
    }
}

const migrationFile = process.argv[2];
runMigration(migrationFile);
