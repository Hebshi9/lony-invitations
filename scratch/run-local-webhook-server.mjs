import http from 'http';
import dotenv from 'dotenv';
import { handler as webhookHandler } from '../netlify/functions/meta-webhook.mjs';

dotenv.config({ path: './.env' });

const PORT = 8888;

const server = http.createServer(async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            console.log(`\n📥 Received POST request to: ${req.url}`);
            
            try {
                // Construct Netlify-like event request object
                const netlifyEvent = {
                    httpMethod: 'POST',
                    body: body,
                    headers: req.headers,
                    queryStringParameters: {} // populate if needed
                };

                console.log('🤖 Invoking meta-webhook handler...');
                const response = await webhookHandler(netlifyEvent, {});
                
                console.log(`📤 Handler returned status code: ${response.statusCode}`);
                
                res.writeHead(response.statusCode, { 'Content-Type': 'application/json' });
                res.end(response.body);
            } catch (err) {
                console.error('❌ Error executing handler:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`🟢 Local Netlify Function Server running on http://localhost:${PORT}`);
    console.log(`📍 Webhook endpoint: http://localhost:${PORT}/.netlify/functions/meta-webhook`);
});
