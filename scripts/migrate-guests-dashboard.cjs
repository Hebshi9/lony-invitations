const pg = require('pg');
require('dotenv').config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database for migration...');
    const sql = `
      ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_message_status TEXT;
      ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_error_message TEXT;
      CREATE INDEX IF NOT EXISTS idx_guests_phone_suffix ON guests (right(phone, 9));
    `;
    await client.query(sql);
    console.log('Migration SUCCESS: last_message_status and last_error_message added to guests table.');
  } catch (err) {
    console.error('Migration FAILED:', err.message);
  } finally {
    await client.end();
  }
}

run();
