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

async function applyStorage() {
    try {
        await client.connect();
        console.log('Connected to database...');

        const sqlPath = path.join(__dirname, '../supabase/STORAGE_SETUP.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying Storage Setup...');
        await client.query(sqlContent);

        console.log('Storage setup complete! Bucket "cards" created.');
    } catch (err) {
        console.error('Error applying storage setup:', err);
    } finally {
        await client.end();
    }
}

applyStorage();
