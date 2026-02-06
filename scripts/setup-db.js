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

    // 1. Run Base Schema
    const schemaPath = path.join(__dirname, '../supabase/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('Executing base schema...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
    }

    // 2. Run Migrations
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    if (fs.existsSync(migrationsDir)) {
      console.log('Checking for migrations...');
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Ensure chronological order

      for (const file of files) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
          await client.query(sql);
          console.log(`  ✅ Success: ${file}`);
        } catch (err) {
          console.error(`  ❌ Failed: ${file}`, err.message);
          // Continue? Usually we might stop, but for dev we try to proceed to apply other fixes
        }
      }
    }

    console.log('Database setup complete!');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
