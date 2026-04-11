const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    const res = await ssh.execCommand('tail -n 200 /root/.pm2/logs/lony-sender-out.log');
    const lines = res.stdout.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('No working instances')) {
            console.log(lines.slice(Math.max(0, i-10), i+2).join('\n'));
            console.log('---');
        }
    });
    ssh.dispose();
}).catch(console.error);
