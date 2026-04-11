import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

ssh.connect({
    host: '62.171.172.76',
    username: 'root',
    password: 'AHMEDhebshi12'
}).then(async () => {
    // Test direct sendMedia to the known instance (even if it's considered disconnected, to see the error)
    const payload = JSON.stringify({
        number: "966562242176",
        mediatype: "image",
        caption: "Test Media from Node SSH",
        media: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/9a632cb1-92de-4239-8cd4-db58721d266c/global_invite_1775223632189.jpeg",
        fileName: "invitation.png"
    });
    
    // We ignore active check and just blast the endpoint
    const cmd = `curl -s -X POST http://localhost:8081/message/sendMedia/584f5ebf-1d32-42b2-b3de-d9a142fb96c8 -H "apikey: 429683C4C977415CAAFCCE10F7D57E11" -H "Content-Type: application/json" -d '${payload}'`;
    
    const sendRes = await ssh.execCommand(cmd);
    console.log("SendMedia Result:");
    console.log(sendRes.stdout);
    
    ssh.dispose();
}).catch(console.error);
