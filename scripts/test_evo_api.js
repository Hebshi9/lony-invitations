import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    // Let's get the active instance first
    const instRes = await ssh.execCommand('curl -s -X GET http://localhost:8081/instance/fetchInstances -H "apikey: 429683C4C977415CAAFCCE10F7D57E11"');
    const instances = JSON.parse(instRes.stdout);
    const active = instances.find(i => i.connectionStatus === 'open' || i.connectionStatus === 'connected' || i.state === 'open' || i.state === 'open');
    
    if (!active) {
        console.log("No active instances found to test.");
        ssh.dispose();
        return;
    }
    
    console.log("Testing active instance:", active.name);
    
    // Test direct send to a number (let's use the test phone +966562242176 or random format)
    const payload = JSON.stringify({
        number: "966562242176",
        text: "Test Message from Node SSH"
    });
    
    const cmd = `curl -s -X POST http://localhost:8081/message/sendText/${active.name} -H "apikey: 429683C4C977415CAAFCCE10F7D57E11" -H "Content-Type: application/json" -d '${payload}'`;
    
    const sendRes = await ssh.execCommand(cmd);
    console.log("Send Result:");
    console.log(sendRes.stdout);
    
    ssh.dispose();
}).catch(console.error);
