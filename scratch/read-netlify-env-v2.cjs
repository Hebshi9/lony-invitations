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

    const SITE_ID = 'f2344ffe-34af-4526-aaf2-65e746df61df';

    console.log('📡 Fetching env vars from Netlify API for site:', SITE_ID);

    const options = {
      hostname: 'api.netlify.com',
      path: `/api/v1/sites/${SITE_ID}/env`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          const vars = JSON.parse(data);
          const metaTokenVar = vars.find(v => v.key === 'META_ACCESS_TOKEN');
          if (metaTokenVar) {
              console.log('FOUND META_ACCESS_TOKEN:', JSON.stringify(metaTokenVar, null, 2));
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
