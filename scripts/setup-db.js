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
  console.error('Please get your Connection String from Supabase Settings -> Database and add it to .env');
  console.error('Format: postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function setupDatabase() {
  try {
    await client.connect();
    console.log('Connected to database...');

    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    // Split by semicolon to run statements individually if needed, but simple query usually works for DDL
    await client.query(schemaSql);

    console.log('Database setup complete! Tables and policies created.');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
