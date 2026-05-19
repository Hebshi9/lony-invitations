const https = require('https');

// Get the token from the Netlify CLI config
const fs = require('fs');
const path = require('path');
const os = require('os');

// Try to find token from Netlify config
const configPath = path.join(os.homedir(), '.netlify', 'config.json');
let token = '';

if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    token = config.users?.['67df59e178594498cfcbf2ae']?.auth?.token || '';
    console.log('Found token from config:', token ? 'Yes' : 'No');
}

if (!token) {
    // Try from AppData
    const appDataPath = path.join(process.env.APPDATA || '', 'netlify', 'Config', 'config.json');
    if (fs.existsSync(appDataPath)) {
        const config = JSON.parse(fs.readFileSync(appDataPath, 'utf8'));
        token = config.users?.['67df59e178594498cfcbf2ae']?.auth?.token || '';
        console.log('Found token from AppData:', token ? 'Yes' : 'No');
    }
}

// Also search for any netlify config
const possiblePaths = [
    path.join(os.homedir(), '.config', 'netlify', 'config.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json'),
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        console.log('Found config at:', p);
        const content = fs.readFileSync(p, 'utf8');
        console.log('Content preview:', content.substring(0, 200));
    }
}

// List env vars using the existing account
const ACCOUNT_ID = '67df59e178594498cfcbf2b0';
const SITE_ID = 'f9577207-ba86-48e6-b64d-2517891c9140';

function listEnvVars(authToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.netlify.com',
            path: `/api/v1/accounts/${ACCOUNT_ID}/env?site_id=${SITE_ID}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`\nList Env Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    const vars = JSON.parse(data);
                    console.log(`\nFound ${vars.length} env vars:`);
                    vars.forEach(v => console.log(`  ${v.key} = ${v.values?.[0]?.value?.substring(0, 30)}...`));
                } else {
                    console.log('Error:', data.substring(0, 200));
                }
                resolve();
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Try without token to see what happens
if (token) {
    listEnvVars(token);
} else {
    console.log('\nNo token found. Searching for Netlify state...');
    
    // Check .netlify/state.json in project
    const statePath = path.join(process.cwd(), '.netlify', 'state.json');
    if (fs.existsSync(statePath)) {
        console.log('Found .netlify/state.json:', fs.readFileSync(statePath, 'utf8'));
    }
    
    console.log('\nChecking all user profile directories for netlify config...');
    const searchDirs = [os.homedir()];
    for (const dir of searchDirs) {
        const target = path.join(dir, '.netlify');
        if (fs.existsSync(target)) {
            console.log(`Found ${target}:`, fs.readdirSync(target));
        }
    }
}
