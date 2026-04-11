import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    const res = await ssh.execCommand('curl -s -X GET http://localhost:8081/instance/fetchInstances -H "apikey: 429683C4C977415CAAFCCE10F7D57E11"');
    try {
        console.log(JSON.stringify(JSON.parse(res.stdout), null, 2));
    } catch(e) {
        console.log("Raw output:", res.stdout);
    }
    ssh.dispose();
}).catch(console.error);
