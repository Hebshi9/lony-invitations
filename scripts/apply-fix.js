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
    ssl: { rejectUnauthorized: false },
});

async function applyFix() {
    try {
        await client.connect();
        console.log('Connected to database...');

        const sqlPath = path.join(__dirname, '../supabase/FIX_NOW.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing FIX_NOW.sql...');
        await client.query(sql);

        console.log('✅ FIX APPLIED SUCCESSFULLY!');
        console.log('QR tokens generated and test data created.');
    } catch (err) {
        console.error('Error applying fix:', err);
    } finally {
        await client.end();
    }
}

applyFix();
