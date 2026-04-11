import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    // 1. Fetch instances exactly like whatsapp-server-simple.js does
    const instRes = await ssh.execCommand('curl -s -X GET http://localhost:8081/instance/fetchInstances -H "apikey: 429683C4C977415CAAFCCE10F7D57E11"');
    const instances = JSON.parse(instRes.stdout);
    
    console.log("Found Instances:");
    instances.forEach(i => {
        console.log(`- ${i.name} | Status: ${i.connectionStatus || i.state || i.status}`);
    });
    
    // Find the connected one
    const active = instances.find(i => {
        const s = i.connectionStatus || i.state || i.status;
        return s === 'open' || s === 'connected';
    });
    
    if (!active) {
        console.log("❌ No active instance found right now!");
    } else {
        console.log("✅ Active instance found: " + active.name);
    }
    
    ssh.dispose();
}).catch(console.error);
