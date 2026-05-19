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
  { key: 'SUPABASE_SERVICE_ROLE_KEY', values: [{ value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0', context: 'all' }] }
];

const body = JSON.stringify(envVars);

console.log('Adding SUPABASE_SERVICE_ROLE_KEY to Netlify...');

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
      console.log('✅ SUPABASE_SERVICE_ROLE_KEY added successfully!');
    } else {
      console.log('Error:', data.substring(0, 500));
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
