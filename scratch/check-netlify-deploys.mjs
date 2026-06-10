import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function run() {
    try {
        const configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
        if (!fs.existsSync(configPath)) {
            console.error("❌ Netlify configuration file not found!");
            return;
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const userId = config.userId;
        const token = config.users[userId].auth.token;

        const SITE_ID = 'f9577207-ba86-48e6-b64d-2517891c9140';

        console.log("📡 Fetching Netlify site details and deploys...");

        const getDeploys = () => new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.netlify.com',
                path: `/api/v1/sites/${SITE_ID}/deploys?per_page=5`,
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
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`Status ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });

        const deploys = await getDeploys();
        console.log("\n📊 Recent deploys on Netlify:");
        deploys.forEach((d, idx) => {
            console.log(`[#${idx + 1}] Deploy ID: ${d.id}`);
            console.log(`   State: ${d.state}`);
            console.log(`   Context: ${d.context}`);
            console.log(`   Build Log URL: ${d.admin_url}/deploys/${d.id}`);
            console.log(`   Created At: ${d.created_at}`);
            console.log(`   Commit Title: ${d.title}`);
            console.log(`   URL: ${d.deploy_ssl_url || d.url}`);
            console.log("----------------------------------------");
        });

    } catch (e) {
        console.error("❌ Error fetching Netlify deploys:", e.message);
    }
}

run();
