import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function listInstances() {
    try {
        const response = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
            headers: { 'apikey': API_KEY }
        });
        const data = await response.json();
        data.forEach(i => console.log(`Name: ${i.name}, ID: ${i.instanceId || i.id}, Phone: ${i.ownerJid || 'N/A'}`));
    } catch (e) { console.error(e); }
}

listInstances();
