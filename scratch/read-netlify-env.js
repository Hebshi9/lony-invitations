const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

try {
    const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error('Netlify config not found at:', configPath);
        process.exit(1);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const userId = config.userId;
    const token = config.users[userId].auth.token;

    const ACCOUNT_ID = '67df59e178594498cfcbf2b0';
    const SITE_ID = 'f9577207-ba86-48e6-b64d-2517891c9140';

    console.log('📡 Fetching env vars from Netlify API...');

    const options = {
      hostname: 'api.netlify.com',
      path: `/api/v1/accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const vars = JSON.parse(data);
          const metaTokenVar = vars.find(v => v.key === 'META_ACCESS_TOKEN');
          if (metaTokenVar) {
              console.log('FOUND TOKEN:', JSON.stringify(metaTokenVar, null, 2));
          } else {
              console.log('META_ACCESS_TOKEN not found in Netlify env. All vars:');
              console.log(vars.map(v => v.key));
          }
        } else {
          console.error(`Error: Status ${res.statusCode}`, data.substring(0, 1000));
        }
      });
    });

    req.on('error', e => console.error('Error:', e.message));
    req.end();
} catch (e) {
    console.error('Fatal Error:', e);
}
