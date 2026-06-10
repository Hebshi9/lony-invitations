import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';

const ssh = new NodeSSH();

async function deploy() {
    try {
        console.log('Connecting to VPS...');
        await ssh.connect({
            host: '62.171.172.76',
            username: 'root',
            password: 'AHMEDhebshi12'
        });
        
        console.log('Connected! Creating directory...');
        await ssh.execCommand('mkdir -p /var/www/tahamy-engine');

        console.log('Uploading engine script and env...');
        await ssh.putFile('scripts/run-tahamy-engine.mjs', '/var/www/tahamy-engine/run-tahamy-engine.mjs');
        await ssh.putFile('.env', '/var/www/tahamy-engine/.env');
        
        // Also upload send-campaign.mjs? Wait, my engine script references '../netlify/functions/send-campaign.mjs'! 
        // I should just use the pure API fetch approach so it's standalone!
        
        console.log('Done!');
        await ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}
deploy();
