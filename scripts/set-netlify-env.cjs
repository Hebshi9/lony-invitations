const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const userId = config.userId;
const token = config.users[userId].auth.token;

const ACCOUNT_ID = '67df59e178594498cfcbf2b0';
const SITE_ID = 'f9577207-ba86-48e6-b64d-2517891c9140';

const envVars = [
  { key: 'VITE_SUPABASE_URL', values: [{ value: 'https://gxunxhzjqclddoobxvpz.supabase.co', context: 'all' }] },
  { key: 'VITE_SUPABASE_ANON_KEY', values: [{ value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg', context: 'all' }] },
  { key: 'META_ACCESS_TOKEN', values: [{ value: 'EAAV4hiaLibsBRrouDUKEcJYy8xhOLxI5YZA8WaQHZBHYFOZAJuuowyhWJm4mzRFPFR1F4byHCVC2pRXMdOj4ANNIY5NXwAiNHkAhpVDtUhTZCbU1JAwkwOEbMNb9xjWroKeKnT55coZCAhyGc6uvt2VzP0wYKGbMy5wxz1cXxzvoDzPZBAsbVlsoc9RAQaJnnxXwZDZD', context: 'all' }] },
  { key: 'META_PHONE_NUMBER_ID', values: [{ value: '1031606736708015', context: 'all' }] },
  { key: 'META_WABA_ID', values: [{ value: '3277627339072448', context: 'all' }] },
  { key: 'OPENAI_API_KEY', values: [{ value: 'sk-proj-REMOVED_FOR_SECURITY', context: 'all' }] },
];

const body = JSON.stringify(envVars);

console.log('Setting env vars on Netlify...');

const options = {
  hostname: 'api.netlify.com',
  path: `/api/v1/accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode === 201 || res.statusCode === 200) {
      const vars = JSON.parse(data);
      console.log(`✅ Successfully set ${vars.length} env vars:`);
      vars.forEach(v => console.log(`   ${v.key}`));
    } else {
      console.log('Error:', data.substring(0, 500));
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
