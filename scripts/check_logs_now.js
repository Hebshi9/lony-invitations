import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    let res = await ssh.execCommand('tail -n 60 /root/.pm2/logs/lony-sender-error.log');
    console.log("Recent Error Log:");
    console.log(res.stdout);
    ssh.dispose();
}).catch(console.error);
