const { spawn } = require('child_process');

console.log('🔄 Starting WhatsApp Server Wrapper...');

const server = spawn('node', ['api/whatsapp-server-simple.js'], {
    stdio: 'inherit',
    env: process.env,
    shell: true
});

server.on('close', (code) => {
    console.log(`❌ Server process exited with code ${code}`);
});

server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
});

// Keep alive
setInterval(() => { }, 1000);
