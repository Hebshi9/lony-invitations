import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
async function run() {
    await ssh.connect({ host: '62.171.172.76', username: 'root', password: 'AHMEDhebshi12' });
    const cmd = await ssh.execCommand('cd /var/www/tahamy-engine && npm i @supabase/supabase-js node-fetch dotenv && pm2 start run-tahamy-engine.mjs --name "tahamy-bot"');
    console.log(cmd.stdout || cmd.stderr);
    await ssh.dispose();
}
run();
