import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function run() {
    try {
        await ssh.connect({
            host: '62.171.172.76',
            username: 'root',
            password: 'AHMEDhebshi12'
        });
        
        console.log('Connected!');
        const cmd1 = await ssh.execCommand('pm2 list');
        console.log('pm2:', cmd1.stdout || cmd1.stderr);
        
        await ssh.dispose();
    } catch (e) {
        console.error(e);
    }
}
run();
