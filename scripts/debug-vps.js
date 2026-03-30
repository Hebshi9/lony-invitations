import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const SSH_HOST = '62.171.172.76';
const SSH_USER = 'root';
const SSH_PASS = 'AHMEDhebshi12';
const REMOTE_DIR = '/www/wwwroot/lony-sendingwa';

async function debug() {
    try {
        await ssh.connect({
            host: SSH_HOST,
            username: SSH_USER,
            password: SSH_PASS
        });
        console.log('Connected.');

        const versionCheck = await ssh.execCommand(`grep "VERSION =" ${REMOTE_DIR}/api/whatsapp-server-simple.js`);
        console.log('Remote Version Code:', versionCheck.stdout || versionCheck.stderr);

        const pm2List = await ssh.execCommand('pm2 list');
        console.log('PM2 List:\n', pm2List.stdout);

        const pm2Logs = await ssh.execCommand('pm2 logs lony-sender --lines 20 --no-daemon');
        console.log('PM2 Logs:\n', pm2Logs.stdout);

    } catch (e) {
        console.error(e.message);
    } finally {
        ssh.dispose();
    }
}
debug();
