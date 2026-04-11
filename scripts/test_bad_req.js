import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    // Intentional bad instance name or disconnected instance
     const cmd = `curl -s -X POST http://localhost:8081/message/sendText/some-disconnected-uuid -H "apikey: 429683C4C977415CAAFCCE10F7D57E11" -H "Content-Type: application/json" -d '{"number": "966562242176", "text": "Test"}'`;
    
    const sendRes = await ssh.execCommand(cmd);
    console.log("Send Result for invalid instance:");
    console.log(sendRes.stdout);
    ssh.dispose();
}).catch(console.error);
