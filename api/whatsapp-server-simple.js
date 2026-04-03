// Evolution API Adapter Server
import { createRequire } from "module";
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import rsvpAI from '../src/services/rsvp-ai-service.js';
import { fillTemplate, getTemplateVariables } from '../src/services/message-templates.js';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const VERSION = '1.0.6'; // Last updated: 2026-03-17 - Webhook format fix
const app = express();
const PORT = process.env.PORT || 3001;

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://localhost:8081';
// This API Key must match what we set in docker-compose
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[DEBUG_REQ] >>> ${new Date().toISOString()} | ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        const bodyStr = req.body ? JSON.stringify(req.body) : '';
        console.log(`[DEBUG_BODY]`, bodyStr.substring(0, 500));
    }
    next();
});

// Initialize Supabase
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Job State Management & Global Message Queue
let jobState = {
    isRunning: false,
    isPaused: false,
    eventId: null,
    accountId: null,
    autoFollowup: true,
    stats: {
        pending: 0,
        sent: 0,
        failed: 0,
        queued: 0
    },
    lastLog: null,
    shouldStop: false
};

const preparingLocks = new Set();

// --- GLOBAL MESSAGE QUEUE (ANTI-BAN & COLLISION PREVENTION) ---
// This queue ensures webhook replies and batch campaigns NEVER execute at the exact same millisecond.
class MessageQueueManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.lockedMessageIds = new Set(); // Prevents double queuing of the same message ID
    }

    // Add item to queue (types: 'batch', 'webhook_priority')
    push(item) {
        // Prevent double queuing of batch items
        if (item.messageId) {
            if (this.lockedMessageIds.has(item.messageId)) {
                console.log(`[Queue] ⚠️ Message ${item.messageId} is already in the queue. Skipping duplicate.`);
                return;
            }
            this.lockedMessageIds.add(item.messageId);
        }

        if (item.priority === 'high') {
            // High priority (like webhook QR cards) jump to the front of the queue, but behind the currently processing item.
            // Wait! If we unshift it, it will be pulled next.
            this.queue.unshift(item);
        } else {
            this.queue.push(item);
        }
        
        console.log(`[Queue] 📥 Item added (${item.type}). Queue length: ${this.queue.length}`);
        
        // Asynchronously start processing if not already running
        if (!this.isProcessing) {
            this.processNext();
        }
    }

    async processNext() {
        if (this.isProcessing) return;
        if (this.queue.length === 0) {
            this.lockedMessageIds.clear(); // Safe to clean up memory when empty
            return;
        }

        this.isProcessing = true;
        const item = this.queue.shift();

        try {
            console.log(`[Queue] ⚙️ Processing item type: ${item.type}...`);
            await item.execute();
            if (item.messageId) this.lockedMessageIds.delete(item.messageId);
        } catch (e) {
            console.error(`[Queue] ❌ Error executing item:`, e.message);
            if (item.messageId) this.lockedMessageIds.delete(item.messageId);
        } finally {
            this.isProcessing = false;
            // Recursively process next
            if (this.queue.length > 0) {
                // Short break between queue reads to yield event loop
                setTimeout(() => this.processNext(), 100);
            }
        }
    }
    
    clear() {
        this.queue = [];
        this.lockedMessageIds.clear();
        this.isProcessing = false;
    }
}

const globalQueue = new MessageQueueManager();

// --- Persistent Logging Helper ---
const logFile = require('path').join(process.cwd(), 'whatsapp_activity.log');
const fs = require('fs');
function persistLog(msg) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    try {
        fs.appendFileSync(logFile, entry);
    } catch (e) {
        console.error('Failed to write to log file:', e.message);
    }
}

// Cache for the active Evolution instance name (discovered from Manager)
let cachedInstanceName = null;
let cachedInstanceExpiry = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getSpeedDelay = (mode) => {
    switch (mode) {
        case 'fast': return 2000;      // 2 sec (safer than 1)
        case 'balanced': return 5000;  // 5 sec
        case 'safe': return 10000;     // 10 sec
        default: return 5000;
    }
};

// --- Phone Normalization Helper ---
function normalizePhone(phone) {
    if (!phone) return '';
    // Strip everything except digits
    let clean = phone.replace(/[^0-9]/g, '');
    // Convert 05xxxxxxxx to 9665xxxxxxxx (Saudi local format)
    if (clean.startsWith('05') && clean.length === 10) {
        clean = '966' + clean.substring(1);
    }
    // Convert 5xxxxxxxx (9 digits) to 9665xxxxxxxx
    if (clean.startsWith('5') && clean.length === 9) {
        clean = '966' + clean;
    }
    return clean;
}

// --- Anti-Ban Spintax Helper (Text Masking) ---
function applySpintax(text) {
    if (!text) return '';
    // 1. Invisible characters (Zero-width space) randomly inserted to change text hash
    const zws = '\u200B';
    // 2. Minor random emoji/punctuation variance
    const variations = [
        '{| }', '{.|..|...}', '{✨|🌟|⭐| |}', '{\n|\n\n}', '{🌹|🌸|🤍|}'
    ];
    
    let spintaxed = text;
    // Replace standard Spintax formats {a|b|c} if they exist in the template
    const spintaxRegex = /{([^{}]*)}/g;
    spintaxed = spintaxed.replace(spintaxRegex, (match, contents) => {
        const parts = contents.split('|');
        return parts[Math.floor(Math.random() * parts.length)];
    });

    // Automatically append an invisible hash-breaker at the end
    const hashes = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    const randomHash = hashes[Math.floor(Math.random() * hashes.length)].repeat(Math.floor(Math.random() * 3) + 1);
    
    return spintaxed + randomHash;
}

/**
 * Discover all instances from Evolution API and return the target connected one
 */
async function discoverActiveInstance() {
    const targetInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'lony';

    // Use cache if still valid (cache for 30 seconds)
    if (cachedInstanceName === targetInstanceName && Date.now() < cachedInstanceExpiry) {
        return cachedInstanceName;
    }

    try {
        const instancesResp = await callEvolution('/instance/fetchInstances');
        const instancesList = instancesResp.data || (Array.isArray(instancesResp) ? instancesResp : []);

        // Find the specific instance by name pattern
        let targetInstance = instancesList.find(inst => {
            const name = (inst.instanceName || inst.name || inst.id || inst.instanceId || '').toLowerCase();
            return name === targetInstanceName.toLowerCase();
        });

        const isTargetOpen = targetInstance && ['open', 'connected'].includes((targetInstance.connectionStatus || targetInstance.state || targetInstance.status || '').toLowerCase());

        // FALLBACK: If the exact target is not found OR it's disconnected, pick ANY open instance
        if (!isTargetOpen) {
            const fallbackInstance = instancesList.find(inst => {
                const status = (inst.connectionStatus || inst.state || inst.status || '').toLowerCase();
                return status === 'open' || status === 'connected';
            });
            if (fallbackInstance) {
                console.log(`✨ Fallback: Using ${fallbackInstance.name} because main target is missing or disconnected.`);
                targetInstance = fallbackInstance;
            }
        }

        if (targetInstance) {
            const status = targetInstance.connectionStatus || targetInstance.state || targetInstance.status || '';
            const name = targetInstance.instanceName || targetInstance.name || targetInstance.id || targetInstance.instanceId;

            if (status === 'open' || status === 'connected') {
                console.log(`🔍 Discovered target instance: "${name}" (Status: ${status})`);
                cachedInstanceName = name;
                cachedInstanceExpiry = Date.now() + 30000; // Cache for 30 sec
                return name;
            } else {
                console.log(`⚠️ Target instance "${name}" exists but is NOT connected (Status: ${status}). Please scan QR.`);
                return name; // Return it anyway so attempts go to it and fail explicitly
            }
        }

        console.log(`❌ Target instance "${targetInstanceName}" not found in Evolution Manager, and no other connected instances exist.`);
        return null;

    } catch (e) {
        console.error('❌ Instance discovery failed:', e.message);
    }
    return null;
}

// --- Evolution API Helpers ---

const evoHeaders = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY
};

async function callEvolution(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: evoHeaders
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${EVOLUTION_URL}${endpoint}`, options);
        const status = response.status;
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error(`Evolution API Response Error (${endpoint}): Not JSON`, text.substring(0, 100));
            return { status, error: 'Invalid JSON from Evolution', raw: text };
        }

        // Return a unified object. If data is an array, put it in .data
        if (Array.isArray(data)) {
            return { status, data };
        }
        return { status, ...data };
    } catch (error) {
        console.error(`Evolution API Connection Refused on ${EVOLUTION_URL}${endpoint}:`, error.message);
        return { error: error.message, status: 503 };
    }
}

async function callEvolutionWithInstance(endpointPrefix, instanceCandidate, method, body) {
    // STRATEGY: First try cached active instance, then candidate, then auto-discover

    // 1. If we have a cached active instance, try that FIRST (most likely to work)
    if (cachedInstanceName && Date.now() < cachedInstanceExpiry && cachedInstanceName !== instanceCandidate) {
        console.log(`[Proxy] Using cached active instance: ${cachedInstanceName}`);
        let result = await callEvolution(`${endpointPrefix}/${cachedInstanceName}`, method, body);
        if (!isInstanceError(result)) return result;
        // Cache was stale, clear it
        cachedInstanceName = null;
        cachedInstanceExpiry = 0;
    }

    // 2. Try with the candidate ID/Name as-is
    console.log(`[Proxy] Trying instance: ${instanceCandidate} ...`);
    let result = await callEvolution(`${endpointPrefix}/${instanceCandidate}`, method, body);

    // 3. If candidate failed, auto-discover
    if (isInstanceError(result)) {
        console.log(`⚠️  Instance "${instanceCandidate}" failed (${result.status}). Auto-discovering...`);

        const discoveredName = await discoverActiveInstance();
        if (discoveredName && discoveredName !== instanceCandidate) {
            console.log(`✨ Using discovered instance: "${discoveredName}"`);
            result = await callEvolution(`${endpointPrefix}/${discoveredName}`, method, body);
        }

        if (isInstanceError(result)) {
            console.error('❌ All instance attempts failed. Last error:', result.status, result.message || result.error);
            return result; // RETURN the actual JSON containing the message instead of generic 500 error!
        }
    }
    return result;
}

// Helper to check if an Evolution API response indicates an instance error
function isInstanceError(result) {
    if (!result) return true;
    if (result.status === 404 || result.status === 500 || result.status === 503) return true;
    const msg = result.response?.message || result.message || result.error || '';
    if (typeof msg === 'string') {
        const errorPatterns = ['instance does not exist', 'Connection Closed', 'not found', 'ECONNREFUSED', 'No open instances'];
        return errorPatterns.some(p => msg.toLowerCase().includes(p.toLowerCase()));
    }
    return false;
}

// --- Routes ---

app.get('/', (req, res) => {
    res.json({
        status: 'running',
        backend: 'Evolution API Adapter',
        message: '🚀 Lony WhatsApp Server (Evolution Edition)',
        public_url: process.env.PUBLIC_URL || 'NOT_SET'
    });
});

// Diagnostic: Test if Webhook is reachable
app.get('/api/whatsapp/test-webhook', (req, res) => {
    persistLog(`[Diagnostic] Webhook Test Endpoint pinged from ${req.ip}`);
    res.json({ 
        success: true, 
        message: 'Webhook endpoint reachable!', 
        version: VERSION,
        time: new Date().toISOString() 
    });
});

// Diagnostic: Force Re-register Webhooks (Changed to GET for easier link access)
app.get('/api/whatsapp/force-register-webhooks', async (req, res) => {
    persistLog(`[Diagnostic] Force Webhook Registration manually triggered.`);
    try {
        const PUBLIC_URL = process.env.PUBLIC_URL;
        if (!PUBLIC_URL) throw new Error('PUBLIC_URL is not set in .env');

        const instancesResp = await callEvolution('/instance/fetchInstances');
        const instancesList = instancesResp.data || (Array.isArray(instancesResp) ? instancesResp : []);
        
        let results = [];
        const targetInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'lony';

        for (const inst of instancesList) {
            const instName = inst.instanceName || inst.name || inst.id || inst.instanceId;
            if (!instName) continue;
            
            // Re-register target instance
            if (instName.toLowerCase() === targetInstanceName.toLowerCase()) {
                const webhookUrl = `${PUBLIC_URL}/webhook`;
                persistLog(`[Webhook] Registering webhook for "${instName}" -> ${webhookUrl}`);

                // Evolution API v2.3.7 requires: { webhook: { enabled: true, url, events } }
                let setResult = await callEvolution(`/webhook/set/${instName}`, 'POST', {
                    webhook: {
                        enabled: true,
                        url: webhookUrl,
                        webhook_by_events: false,
                        webhook_base64: false,
                        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                    }
                });

                // Fallback: flat format for older Evolution versions
                if (setResult.status === 400 || setResult.error) {
                    persistLog(`[Webhook] Nested format failed, trying flat...`);
                    setResult = await callEvolution(`/webhook/set/${instName}`, 'POST', {
                        enabled: true,
                        url: webhookUrl,
                        webhook_by_events: false,
                        webhook_base64: false,
                        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                    });
                }

                const success = !setResult.error && setResult.status !== 400;
                persistLog(`[Webhook] Registration for "${instName}": ${success ? '✅ SUCCESS' : '❌ FAILED'} - ${JSON.stringify(setResult).substring(0, 200)}`);
                results.push({ name: instName, success, result: setResult });
            }
        }
        res.json({ success: true, results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Account Management (Database + Evolution API Sync)
app.get('/api/whatsapp/accounts', async (req, res) => {
    try {
        console.log('🔍 Fetching accounts (DB + Evolution Sync)...');

        // === 1. Fetch from DB ===
        let dbAccounts = [];
        try {
            const dbPromise = supabase
                .from('whatsapp_accounts')
                .select('*')
                .order('created_at', { ascending: false });
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'DB Timeout' } }), 3000));
            const result = await Promise.race([dbPromise, timeoutPromise]);
            if (result?.data) dbAccounts = result.data;
            if (result?.error) console.warn('DB fetch issue:', result.error.message);
        } catch (e) {
            console.warn('DB fetch error:', e.message);
        }

        // === 2. Fetch LIVE instances from Evolution API ===
        let evoInstances = [];
        try {
            const instancesResp = await callEvolution('/instance/fetchInstances');
            evoInstances = instancesResp.data || (Array.isArray(instancesResp) ? instancesResp : []);
            console.log(`📡 Evolution API returned ${evoInstances.length} instance(s)`);
        } catch (e) {
            console.warn('Evolution fetch failed:', e.message);
        }

        // === 3. Merge: DB accounts + Evolution instances ===
        const mergedAccounts = [];
        const seenIds = new Set();

        // Process Evolution instances FIRST (source of truth for connection status)
        for (const inst of evoInstances) {
            const instName = inst.instanceName || inst.name || inst.id || inst.instanceId;
            const instStatus = inst.connectionStatus || inst.state || inst.status || 'disconnected';
            const isConnected = instStatus === 'open' || instStatus === 'connected';
            const ownerJid = inst.owner || inst.ownerJid || '';
            const ownerPhone = ownerJid.split('@')[0] || '';

            // Try to find matching DB account
            const dbMatch = dbAccounts.find(a =>
                a.id === instName ||
                a.phone === instName ||
                a.phone === ownerPhone ||
                normalizePhone(a.phone) === normalizePhone(ownerPhone)
            );

            if (dbMatch) {
                // Merge DB data with live status
                mergedAccounts.push({
                    ...dbMatch,
                    evolution_instance: instName,
                    connected: isConnected,
                    status: isConnected ? 'connected' : 'disconnected',
                    owner_phone: ownerPhone
                });
                seenIds.add(dbMatch.id);
            } else {
                // Instance exists in Evolution but NOT in DB -> add it!
                console.log(`🆕 Found Evolution instance "${instName}" not in DB. Adding it...`);
                mergedAccounts.push({
                    id: instName,
                    phone: ownerPhone || instName,
                    name: `${instName} (Evolution)`,
                    evolution_instance: instName,
                    connected: isConnected,
                    status: isConnected ? 'connected' : 'disconnected',
                    daily_limit: 1000,
                    is_active: true,
                    owner_phone: ownerPhone
                });
                seenIds.add(instName);

                // Also try to sync to DB for persistence (best-effort)
                if (ownerPhone) {
                    supabase.from('whatsapp_accounts').upsert({
                        id: instName,
                        phone: ownerPhone,
                        name: `${instName} (Evolution)`,
                        status: isConnected ? 'connected' : 'disconnected',
                        daily_limit: 1000
                    }, { onConflict: 'id', ignoreDuplicates: true }).then(() => { }).catch(() => { });
                }
            }

            // Update cached instance if connected
            if (isConnected) {
                cachedInstanceName = instName;
                cachedInstanceExpiry = Date.now() + 30000;
            }
        }

        // Add any DB accounts NOT found in Evolution (offline/legacy)
        for (const acc of dbAccounts) {
            if (!seenIds.has(acc.id)) {
                mergedAccounts.push({
                    ...acc,
                    connected: false,
                    status: 'disconnected'
                });
            }
        }

        // FALLBACK: Inject Admin Account if nothing found
        if (mergedAccounts.length === 0) {
            const adminPhone = process.env.ADMIN_PHONE || '+966503678789';
            const adminId = normalizePhone(adminPhone);
            mergedAccounts.push({
                id: adminId,
                phone: adminId,
                name: 'رقم الإدارة (System)',
                status: 'disconnected',
                daily_limit: 1000,
                connected: false,
                is_active: true
            });
        }

        console.log(`✅ Returning ${mergedAccounts.length} account(s). Connected: ${mergedAccounts.filter(a => a.connected).length}`);
        res.json({ success: true, accounts: mergedAccounts });
    } catch (error) {
        console.error('Error fetching accounts (CRITICAL):', error);
        // Absolute fail-safe
        const adminId = '966503678789';
        res.json({
            success: true,
            accounts: [{
                id: adminId,
                phone: adminId,
                name: 'رقم الإدارة (Rescue)',
                status: 'disconnected',
                connected: false
            }]
        });
    }
});

app.post('/api/whatsapp/accounts', async (req, res) => {
    try {
        const { phone, name, daily_limit } = req.body;

        // 1. Upsert into Supabase to get/generate a UUID
        const { data: upsertData, error: upsertError } = await supabase
            .from('whatsapp_accounts')
            .upsert({
                phone: phone,
                name: name || phone,
                daily_limit: daily_limit || 170,
                status: 'disconnected'
            }, { onConflict: 'phone' })
            .select()
            .single();

        if (upsertError) throw upsertError;

        const accountId = upsertData.id;

        // 2. Create instance in Evolution using the UUID
        await callEvolution('/instance/create', 'POST', {
            instanceName: accountId,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        });

        // 3. Auto-register webhook for this new instance
        const PUBLIC_URL = process.env.PUBLIC_URL;
        if (PUBLIC_URL) {
            try {
                await callEvolution(`/webhook/set/${accountId}`, 'POST', {
                    url: `${PUBLIC_URL}/webhook`,
                    webhook_by_events: false,
                    webhook_base64: false,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                });
                console.log(`✅ Webhook auto-registered for new instance: ${accountId}`);
            } catch (e) {
                console.warn(`⚠️ Could not register webhook for ${accountId}:`, e.message);
            }
        }

        res.json({ success: true, account: { id: accountId, phone, name } });
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/whatsapp/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete from Evolution
        await callEvolution(`/instance/logout/${id}`, 'DELETE');
        await callEvolution(`/instance/delete/${id}`, 'DELETE');

        // Delete from DB
        await supabase.from('whatsapp_accounts').delete().eq('id', id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Connection & QR
app.post('/api/whatsapp/connect/:accountId', async (req, res) => {
    const { accountId } = req.params;

    try {
        // First check if this instance already exists in Evolution (could be created via Manager)
        const stateCheck = await callEvolution(`/instance/connectionState/${accountId}`);

        if (stateCheck?.instance?.state === 'open') {
            // Already connected! Just register webhook and return
            console.log(`✅ Instance "${accountId}" already connected.`);
            const PUBLIC_URL = process.env.PUBLIC_URL;
            if (PUBLIC_URL) {
                await callEvolution(`/webhook/set/${accountId}`, 'POST', {
                    url: `${PUBLIC_URL}/webhook`,
                    webhook_by_events: false,
                    webhook_base64: false,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                }).catch(() => { });
            }
            cachedInstanceName = accountId;
            cachedInstanceExpiry = Date.now() + 30000;
            return res.json({ success: true, message: 'Already connected!', connected: true });
        }

        // If instance doesn't exist or is closed, create/ensure it
        if (stateCheck.status === 404 || stateCheck.error) {
            console.log(`📱 Creating new instance "${accountId}"...`);
            await callEvolution('/instance/create', 'POST', {
                instanceName: accountId,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            });
        }

        // Invoke connect to trigger QR generation
        const connectRes = await callEvolution(`/instance/connect/${accountId}`, 'GET');

        // Register webhook
        const PUBLIC_URL = process.env.PUBLIC_URL;
        if (PUBLIC_URL) {
            await callEvolution(`/webhook/set/${accountId}`, 'POST', {
                url: `${PUBLIC_URL}/webhook`,
                webhook_by_events: false,
                webhook_base64: false,
                events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
            }).catch(() => { });
        }

        res.json({ success: true, message: 'Initializing... Scan QR code.', debug: connectRes });
    } catch (error) {
        console.error('Connect error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/whatsapp/qr-status/:accountId', async (req, res) => {
    const { accountId } = req.params;

    // Check connection state - try direct first, then discover
    let stateRes = await callEvolution(`/instance/connectionState/${accountId}`);
    let isConnected = stateRes?.instance?.state === 'open';

    // If direct check failed, try auto-discovering the instance
    if (!isConnected && isInstanceError(stateRes)) {
        const discovered = await discoverActiveInstance();
        if (discovered && discovered !== accountId) {
            stateRes = await callEvolution(`/instance/connectionState/${discovered}`);
            isConnected = stateRes?.instance?.state === 'open';
        }
    }

    if (isConnected) {
        // Update DB
        try { await supabase.from('whatsapp_accounts').update({ status: 'connected' }).eq('id', accountId); } catch (e) { }
        cachedInstanceName = accountId;
        cachedInstanceExpiry = Date.now() + 30000;
        return res.json({ success: true, connected: true, qr: null });
    }

    // Fetch QR
    const qrRes = await callEvolution(`/instance/connect/${accountId}`);
    // In Evolution V2, qrRes often looks like: { "instance": "...", "base64": "..." }
    const qr = qrRes?.base64 || qrRes?.code || qrRes?.qrcode?.base64 || qrRes?.qrcode?.code;

    res.json({ success: true, connected: false, qr });
});

app.post('/api/whatsapp/disconnect/:accountId', async (req, res) => {
    const { accountId } = req.params;
    await callEvolution(`/instance/logout/${accountId}`, 'DELETE');

    await supabase.from('whatsapp_accounts').update({ status: 'disconnected' }).eq('id', accountId);

    res.json({ success: true });
});

// Serve local card images (accessible from Docker via host.docker.internal:3001/cards/...)
const __evo_filename = fileURLToPath(import.meta.url);
const __evo_dirname = require('path').dirname(__evo_filename);
const cardsDir = require('path').join(__evo_dirname, '..', 'test-cards');
const fsCheck = require('fs');
if (!fsCheck.existsSync(cardsDir)) fsCheck.mkdirSync(cardsDir, { recursive: true });
app.use('/cards', express.static(cardsDir));
console.log(`🖼️  Serving card images from: ${cardsDir}`);

// =====================================================
// === RSVP HELPER FUNCTIONS ===
// =====================================================

// --- Throttle for owner notifications (1 per 30s per event) ---
const ownerNotifyThrottle = {}; // eventId -> { lastSent, pending: [] }

// Helper: check if a guest is a sample/test entry
function isSampleGuest(guest) {
    const name = (guest.name || '').toLowerCase();
    const phone = (guest.phone || '');
    return name.includes('عينة') || name.includes('sample') || name.includes('test') || phone.includes('000000') || !phone;
}

async function notifyEventOwner(eventId, guestName, rsvpStatus, accountId) {
    try {
        // DON'T send per-guest WhatsApp notification
        // Just log it and check if ALL guests have responded -> send full report
        console.log(`[Notify] 📝 ${guestName}: ${rsvpStatus} (Event: ${eventId}) — logged internally`);

        // Check if ALL real guests have responded -> send summary immediately
        const { data: allGuests } = await supabase
            .from('guests')
            .select('name, phone, rsvp_status')
            .eq('event_id', eventId);

        if (!allGuests) return;

        const realGuests = allGuests.filter(g => !isSampleGuest(g));
        const pending = realGuests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending');

        if (pending.length === 0 && realGuests.length > 0) {
            console.log(`[Notify] 🎉 ALL ${realGuests.length} real guests responded! Sending immediate summary.`);
            await sendSmartSummaryForEvent(eventId, accountId);
        }
    } catch (e) {
        console.error('[Notify] ❌ Error:', e.message);
    }
}

// Send a clean, formatted summary report to the client
async function sendSmartSummaryForEvent(eventId, accountIdHint) {
    try {
        const { data: event } = await supabase
            .from('events')
            .select('id, name, client_phone, magic_link_token, summary_sent_at')
            .eq('id', eventId)
            .single();

        if (!event?.client_phone) return;
        if (event.summary_sent_at) {
            console.log(`[Summary] ⏭️ Summary already sent for ${event.name}. Skipping.`);
            return;
        }

        const { data: allGuests } = await supabase
            .from('guests')
            .select('name, phone, rsvp_status')
            .eq('event_id', eventId);

        if (!allGuests) return;

        // Filter out samples
        const realGuests = allGuests.filter(g => !isSampleGuest(g));
        const confirmed = realGuests.filter(g => g.rsvp_status === 'confirmed');
        const declined = realGuests.filter(g => g.rsvp_status === 'declined');
        const noReply = realGuests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending');

        // Dashboard link
        const dashboardLink = event.magic_link_token
            ? `https://lonyinvit.netlify.app/host/${event.magic_link_token}`
            : '';

        // Build clean report
        let msg = `📊 *تقرير مناسبتك: ${event.name}*\n━━━━━━━━━━━━━━━━━━━\n`;
        msg += `\n📋 إجمالي المدعوين: *${realGuests.length}*`;
        msg += `\n✅ أكدوا الحضور: *${confirmed.length}*`;
        msg += `\n❌ اعتذروا: *${declined.length}*`;
        msg += `\n⏳ ما ردوا: *${noReply.length}*`;

        // List confirmed
        if (confirmed.length > 0) {
            msg += `\n\n━━━━━━━━━━━━━━━━━━━`;
            msg += `\n✅ *المؤكدين (${confirmed.length}):*`;
            for (const g of confirmed.slice(0, 20)) {
                msg += `\n• ${g.name}`;
            }
            if (confirmed.length > 20) msg += `\n... و${confirmed.length - 20} آخرين`;
        }

        // List declined — WITH phone numbers for replacement
        if (declined.length > 0) {
            msg += `\n\n━━━━━━━━━━━━━━━━━━━`;
            msg += `\n❌ *المعتذرين (${declined.length}):*`;
            for (const g of declined.slice(0, 20)) {
                msg += `\n• ${g.name}${g.phone ? ' — ' + g.phone : ''}`;
            }
            if (declined.length > 20) msg += `\n... و${declined.length - 20} آخرين`;
            msg += `\n\n🔄 عندك *${declined.length}* أماكن متاحة للاستبدال`;
            msg += `\nممكن تستبدل المعتذرين ببدلاء من صفحة المتابعة 👇`;
        }

        // List no-reply
        if (noReply.length > 0) {
            msg += `\n\n━━━━━━━━━━━━━━━━━━━`;
            msg += `\n⏳ *ما ردوا (${noReply.length}):*`;
            for (const g of noReply.slice(0, 15)) {
                msg += `\n• ${g.name}${g.phone ? ' — ' + g.phone : ''}`;
            }
            if (noReply.length > 15) msg += `\n... و${noReply.length - 15} آخرين`;
        }

        // Dashboard link
        if (dashboardLink) {
            msg += `\n\n━━━━━━━━━━━━━━━━━━━`;
            msg += `\n👁️ *تابع وأدِر مناسبتك من هنا:*`;
            msg += `\n${dashboardLink}`;
            if (declined.length > 0) {
                msg += `\n\n🔄 من الرابط تقدر تستبدل المعتذرين ببدلاء`;
            }
        }

        msg += `\n\n━━━━━━━━━━━━━━━━━━━`;
        msg += `\nنظام لوني — إدارة الدعوات الذكية 🌹`;

        const clientPhone = normalizePhone(event.client_phone);

        // Find a working instance
        let instanceName = accountIdHint;
        const discovered = await discoverActiveInstance();
        if (discovered) instanceName = discovered;

        if (instanceName) {
            await callEvolution(`/message/sendText/${instanceName}`, 'POST', {
                number: clientPhone,
                text: msg
            });

            // Mark summary as sent
            await supabase.from('events').update({
                rsvp_cycle_status: 'summary_sent',
                summary_sent_at: new Date().toISOString(),
                max_replacements: declined.length
            }).eq('id', event.id);

            console.log(`[Summary] ✅ Full report sent to client: ${clientPhone} for "${event.name}"`);
        }
    } catch (e) {
        console.error('[Summary] ❌ Error sending summary:', e.message);
    }
}

async function recordDeclineSilently(eventId) {
    try {
        const { data: event } = await supabase
            .from('events')
            .select('rsvp_cycle_status, invitations_sent_at')
            .eq('id', eventId)
            .single();
        // Just log it
        console.log(`[RecordDecline] Event ${eventId}, cycle: ${event?.rsvp_cycle_status}`);
    } catch (e) { }
}

// 48-hour Smart Summary Scheduler
async function checkAndSendSmartSummaries() {
    try {
        const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const { data: events } = await supabase
            .from('events')
            .select('id, name, client_phone, magic_link_token, rsvp_cycle_status, invitations_sent_at, summary_sent_at, settings')
            .in('rsvp_cycle_status', ['collecting', 'idle', 'sending'])
            .lt('invitations_sent_at', cutoffTime)
            .is('summary_sent_at', null);

        if (!events || events.length === 0) return;

        for (const event of events) {
            if (!event.client_phone) continue;
            // Check feature toggle
            if (event.settings?.whatsapp_settings?.enable_48h_report === false) {
                continue;
            }
            console.log(`[Scheduler] ⏰ 48h passed for "${event.name}". Sending summary...`);
            await sendSmartSummaryForEvent(event.id, null);
        }
    } catch (e) {
        console.error('[Scheduler] ❌ Error:', e.message);
    }
}

// G3: 24-hour Auto-Reminder
async function processAutoReminders() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: guests, error } = await supabase
            .from('guests')
            .select(`
                id, event_id, name, phone, rsvp_status, reminder_sent,
                events (id, name, features, settings)
            `)
            .eq('rsvp_status', 'pending')
            .eq('reminder_sent', false)
            .neq('status', 'pending');

        if (error || !guests || guests.length === 0) return;

        let instanceName = null;

        for (const guest of guests) {
            if (guest.events?.features?.auto_reminder_enabled === false) continue;
            // Check new feature toggle
            if (guest.events?.settings?.whatsapp_settings?.enable_no_reply_reminder === false) continue;

            const { data: msgs } = await supabase
                .from('whatsapp_messages')
                .select('sent_at, delivery_status')
                .eq('guest_id', guest.id)
                .in('delivery_status', ['sent', 'delivered', 'read'])
                .order('sent_at', { ascending: false })
                .limit(1);

            if (!msgs || msgs.length === 0) continue;

            const latestMsg = msgs[0];
            if (!latestMsg.sent_at || new Date(latestMsg.sent_at) > new Date(twentyFourHoursAgo)) {
                continue;
            }

            if (!instanceName) instanceName = await discoverActiveInstance() || 'lony';

            const number = normalizePhone(guest.phone);
            console.log(`[Scheduler] ⏰ Sending 24h reminder to ${guest.name} (${number})`);

            const text = `السلام عليكم ${guest.name} 🌹\n\nمجرد تذكير بدعوتك لـ *${guest.events?.name || 'المناسبة'}*\n\nبكرماً نتمنى تأكيد حضورك أو الاعتذار ليتسنى لنا تنظيم المقاعد:\n\n1️⃣ لتأكيد الحضور\n2️⃣ للاعتذار\n\nشكراً لك 🙏`;

            try {
                await callEvolutionWithInstance('/message/sendText', instanceName, 'POST', {
                    number: number,
                    text: text
                });

                await supabase.from('guests').update({
                    reminder_sent: true,
                    reminder_sent_at: new Date().toISOString()
                }).eq('id', guest.id);

                await delay(2000); // Avoid rate limits
            } catch (err) {
                console.error(`[Scheduler] ❌ Failed to send reminder to ${number}:`, err.message);
            }
        }
    } catch (e) {
        console.error('[Scheduler] ❌ Auto-Reminder error:', e.message);
    }
}

async function checkIfClientReplacementReply(phone, messageText) {
    try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');

        // Find events in active replacement cycle where this phone is the client
        const { data: events } = await supabase
            .from('events')
            .select('id, name, client_phone, rsvp_cycle_status, max_replacements, used_replacements')
            .in('rsvp_cycle_status', ['follow_up_sent', 'summary_sent', 'replacements_pending']);

        if (!events || events.length === 0) return null;

        for (const event of events) {
            if (!event.client_phone) continue;
            const eventClientClean = event.client_phone.replace(/[^0-9]/g, '');

            // Match by last 9 digits
            if (cleanPhone.endsWith(eventClientClean.slice(-9)) || eventClientClean.endsWith(cleanPhone.slice(-9))) {
                return {
                    eventId: event.id,
                    eventName: event.name,
                    clientPhone: event.client_phone,
                    remainingSlots: (event.max_replacements || 0) - (event.used_replacements || 0),
                    cycleStatus: event.rsvp_cycle_status
                };
            }
        }
        return null;
    } catch (e) {
        console.error('[ClientReply] ❌ Error:', e.message);
        return null;
    }
}

async function processClientReplacementReply(match, messageText, accountId) {
    try {
        const clientPhone = normalizePhone(match.clientPhone);

        // Check if client says "no" / "skip"
        const skipWords = ['لا', 'no', 'ما ابي', 'مايحتاج', 'خلاص', 'تمام', 'كل شي تمام', '4'];
        const cleanMsg = messageText.trim().toLowerCase();
        if (skipWords.some(w => cleanMsg.includes(w)) || cleanMsg === '4') {
            await supabase.from('events').update({ rsvp_cycle_status: 'replacements_done' }).eq('id', match.eventId);
            await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
                number: clientPhone,
                text: '✅ تمام، ما راح نضيف بدلاء. نتمنى لك مناسبة سعيدة! 🌹'
            });
            return;
        }

        // Client wants to send reminder (option 1)
        if (cleanMsg === '1' || cleanMsg.includes('تذكير') || cleanMsg === '١') {
            await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
                number: clientPhone,
                text: '⏳ جاري إرسال تذكير للي ما ردوا... سيتم إبلاغك بالنتيجة.'
            });
            // TODO: Trigger reminder sending for non-respondents
            console.log(`[ClientReply] 📲 Client requested reminder for event ${match.eventId}`);
            return;
        }

        // Client wants to add replacements (option 2 or sends names directly)
        if (match.remainingSlots <= 0) {
            await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
                number: clientPhone,
                text: `⚠️ تم استخدام كل البدلاء المتاحة. تواصل مع فريق لوني للإضافات.`
            });
            return;
        }

        // Try to extract names/phones from message
        const lines = messageText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        const extracted = [];
        for (const line of lines) {
            const phoneMatch = line.match(/(?:05|5|966|9665)\d{8}/);
            let phone = phoneMatch ? phoneMatch[0] : null;
            let name = line;
            if (phone) name = name.replace(phone, '');
            name = name.replace(/[0-9+\-()]/g, '').trim();
            if (name.length >= 2) extracted.push({ name, phone });
        }

        if (extracted.length === 0) {
            // Single line attempt
            const phoneMatch = messageText.match(/(?:05|5|966|9665)\d{8}/);
            let phone = phoneMatch ? phoneMatch[0] : null;
            let name = messageText.replace(phone || '', '').replace(/[0-9+\-()]/g, '').trim();
            if (name.length >= 2) extracted.push({ name, phone });
        }

        if (extracted.length === 0) {
            await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
                number: clientPhone,
                text: `⚠️ ما قدرت أفهم الأسماء.\n\nأرسلهم بالشكل:\nمحمد العلي 0551234567\nأحمد السعيد 0559876543\n\n(كل بديل في سطر)`
            });
            return;
        }

        if (extracted.length > match.remainingSlots) {
            await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
                number: clientPhone,
                text: `⚠️ أرسلت *${extracted.length}* بديل، لكن المتاح *${match.remainingSlots}* فقط.\n\nأرسل ${match.remainingSlots} بدلاء بس.`
            });
            return;
        }

        await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
            number: clientPhone,
            text: `⏳ جاري إضافة *${extracted.length}* بديل...\nيرجى الانتظار`
        });

        // Create replacement guests
        let successCount = 0;
        const results = [];
        for (const { name, phone: rawPhone } of extracted) {
            let guestPhone = (rawPhone || '').replace(/[^0-9]/g, '');
            if (guestPhone.startsWith('05')) guestPhone = '966' + guestPhone.substring(1);
            else if (guestPhone.startsWith('5') && guestPhone.length === 9) guestPhone = '966' + guestPhone;

            const { data: newGuest, error } = await supabase.from('guests').insert({
                event_id: match.eventId,
                name: name,
                phone: guestPhone || null,
                qr_payload: `replacement-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                status: 'pending',
                rsvp_status: 'confirmed',
                category: 'replacement'
            }).select().single();

            if (error) {
                results.push(`❌ ${name}: فشل`);
                continue;
            }

            // Record replacement
            await supabase.from('guest_replacements').insert({
                event_id: match.eventId,
                replacement_guest_name: name,
                replacement_phone: guestPhone,
                replacement_guest_id: newGuest?.id
            }).catch(() => { });

            successCount++;
            results.push(`✅ ${name}`);
        }

        // Update counters
        await supabase.from('events').update({
            used_replacements: (match.used_replacements || 0) + successCount,
            rsvp_cycle_status: 'replacements_done'
        }).eq('id', match.eventId);

        // Confirm to client
        let msg = `✅ *تم إضافة ${successCount} بديل!*\n━━━━━━━━━━━━━━━━━━━`;
        for (const r of results) msg += `\n${r}`;
        const remaining = match.remainingSlots - successCount;
        if (remaining > 0) msg += `\n\n📊 متبقي: ${remaining} بديل متاح`;

        await callEvolutionWithInstance('/message/sendText', accountId, 'POST', {
            number: clientPhone,
            text: msg
        });

        console.log(`[ClientReply] ✅ Added ${successCount} replacements for event ${match.eventId}`);
    } catch (e) {
        console.error('[ClientReply] ❌ Error:', e.message);
    }
}

// Webhook handling from Evolution API
app.post('/webhook', async (req, res) => {
    // IMMEDIATELY respond to Evolution API to prevent timeout/retry
    res.sendStatus(200);

    const data = req.body;
    const eventName = (data.event || '').toLowerCase().replace(/_/g, '.');
    const accountId = data.instance;

    // ========================================
    // F2: DELIVERY TRACKING (messages.update)
    // ========================================
    if (eventName === 'messages.update') {
        try {
            const updates = Array.isArray(data.data) ? data.data : [data.data];
            for (const update of updates) {
                const messageId = update.key?.id;
                const status = update.update?.status;
                if (!messageId || !status) continue;

                // Map Evolution status numbers to our status names
                // 2 = sent, 3 = delivered, 4 = read
                let deliveryStatus = null;
                let updateFields = {};

                if (status === 3 || status === 'DELIVERY_ACK') {
                    deliveryStatus = 'delivered';
                    updateFields = { delivery_status: 'delivered', delivered_at: new Date().toISOString() };
                } else if (status === 4 || status === 'READ') {
                    deliveryStatus = 'read';
                    updateFields = { delivery_status: 'read', read_at: new Date().toISOString() };
                } else if (status === 5 || status === 'PLAYED') {
                    deliveryStatus = 'read';
                    updateFields = { delivery_status: 'read', read_at: new Date().toISOString() };
                }

                if (deliveryStatus && Object.keys(updateFields).length > 0) {
                    const { data: updated, error } = await supabase
                        .from('whatsapp_messages')
                        .update(updateFields)
                        .eq('evolution_message_id', messageId)
                        .select('id, phone');

                    if (updated && updated.length > 0) {
                        console.log(`[Delivery] 📬 Message ${messageId} → ${deliveryStatus} (${updated[0].phone})`);
                    }
                }
            }
        } catch (e) {
            console.error('[Delivery] ❌ Error:', e.message);
        }
        return;
    }

    // ========================================
    // RSVP HANDLING (messages.upsert)
    // ========================================
    if (eventName !== 'messages.upsert') {
        console.log(`[Webhook] ℹ️ Ignoring event: "${data.event}"`);
        return;
    }

    const msg = data.data;

    console.log(`[Webhook] 🔔 RECEIVED EVENT from ${accountId}`);

    // Ignore messages sent by us
    if (msg.key?.fromMe) {
        console.log('[Webhook] ⏭️ Ignoring message sent by us');
        return;
    }

    // Phone normalization: Evolution API provides remoteJid as 966501234567@s.whatsapp.net
    const rawPhone = msg.key?.remoteJid?.split('@')[0] || '';
    const phone = normalizePhone(rawPhone);

    const messageText = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.buttonsResponseMessage?.selectedDisplayText ||
        msg.message?.templateButtonReplyMessage?.selectedDisplayText ||
        msg.message?.listResponseMessage?.title || '';

    let actualButtonId = msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.templateButtonReplyMessage?.selectedId || '';

    // Handle Evolution V2 interactive response (NativeFlow buttons)
    const interactiveResponseMessage = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (interactiveResponseMessage) {
        try {
            const params = JSON.parse(interactiveResponseMessage);
            actualButtonId = params.id || actualButtonId;
        } catch (e) { }
    }

    if (!messageText && !actualButtonId) return;

    console.log(`[Webhook] 📨 From ${phone}: "${messageText}" (Button: ${actualButtonId})`);

    try {
        // === GUEST LOOKUP FIRST (Priority #1) ===
        // Try multiple phone formats for robust matching
        const phoneVariants = [phone];
        if (phone.startsWith('966')) {
            phoneVariants.push('0' + phone.substring(3)); // 966501234567 -> 0501234567
            phoneVariants.push('+' + phone);              // 966501234567 -> +966501234567
            phoneVariants.push(phone.substring(3));       // 966501234567 -> 501234567
        }

        const { data: potentialGuests } = await supabase
            .from('guests')
            .select('id, name, event_id, rsvp_status, card_image_url, qr_payload')
            .in('phone', phoneVariants);

        let guest = null;

        if (potentialGuests && potentialGuests.length > 0) {
            if (potentialGuests.length === 1) {
                guest = potentialGuests[0];
            } else {
                persistLog(`[Webhook] ⚠️ Ambiguous: Found ${potentialGuests.length} guests with phone ${phone}. Trying to disambiguate...`);
                // Priority 1: Pick the one we last messaged (Invite Context)
                const { data: lastMsg } = await supabase
                    .from('whatsapp_messages')
                    .select('event_id, guest_id')
                    .in('phone', phoneVariants)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastMsg) {
                    guest = potentialGuests.find(g => g.id === lastMsg.guest_id && g.event_id === lastMsg.event_id);
                    if (guest) persistLog(`   -> Resolved to guest ${guest.name} via message context.`);
                }
                
                // Priority 2: Pick one that is 'pending' or 'confirmed' instead of 'declined'
                if (!guest) {
                    guest = potentialGuests.find(g => g.rsvp_status === 'pending') || 
                            potentialGuests.find(g => g.rsvp_status === 'confirmed') || 
                            potentialGuests[0];
                    persistLog(`   -> Resolved to guest ${guest?.name} via RSVP status priority.`);
                }
            }
        }

        // === RSVP FLOW (if guest found) ===
        if (guest) {
            console.log(`[Webhook] 👤 Guest identified: ${guest.name} (Event: ${guest.event_id})`);

            let rsvpStatus = null;
            let confidence = 0;

            // A. Check for Button Response
            if (actualButtonId) {
                if (actualButtonId.includes('accept') || actualButtonId.includes('confirm')) {
                    rsvpStatus = 'confirmed';
                    confidence = 1.0;
                } else if (actualButtonId.includes('decline') || actualButtonId.includes('cancel')) {
                    rsvpStatus = 'declined';
                    confidence = 1.0;
                }
            }

            // B. Fast Path for Numbers (1 = confirm, 2 = decline)
            if (!rsvpStatus && messageText) {
                const cleanMsg = messageText.trim();
                if (cleanMsg === '1' || cleanMsg === '١') {
                    rsvpStatus = 'confirmed';
                    confidence = 1.0;
                } else if (cleanMsg === '2' || cleanMsg === '٢') {
                    rsvpStatus = 'declined';
                    confidence = 1.0;
                }
            }

            // C. AI Analysis (for dialect understanding)
            if (!rsvpStatus && messageText) {
                persistLog(`[Webhook] 🧠 Analyzing reply from ${guest.name}: "${messageText}"`);
                
                const { data: lastSent } = await supabase
                    .from('whatsapp_messages')
                    .select('message_text')
                    .eq('guest_id', guest.id)
                    .eq('status', 'sent')
                    .order('sent_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const contextText = lastSent?.message_text || '';
                const analysis = await rsvpAI.analyzeReply(messageText, guest.name, contextText);
                
                if (analysis.is_rsvp && analysis.status) {
                    rsvpStatus = analysis.status;
                    confidence = analysis.confidence;
                    persistLog(`   -> AI Result: ${rsvpStatus} (Conf: ${confidence})`);
                }
            }

            // D. Safety Fallback (Keywords) - only if AI didn't decide
            if (!rsvpStatus && messageText) {
                const cleanMsg = messageText.trim().toLowerCase();
                const confirmKeywords = ['ابشر', 'أبشر', 'تم', 'يشرفنا', 'حاضر', 'قدام', 'من عيوني', 'جاي', 'بإذن الله', 'ان شاء الله', 'نكون هناك', 'اكيد', 'موجود'];
                const declineKeywords = ['اعتذر', 'ما اقدر', 'للاسف', 'ما نقدر', 'مانقدر', 'معتذر', 'مرتبط'];

                if (confirmKeywords.some(k => cleanMsg.includes(k))) {
                    rsvpStatus = 'confirmed';
                    confidence = 0.8;
                    persistLog(`[Webhook] ⚠️ Keyword match CONFIRMED: "${cleanMsg}"`);
                } else if (declineKeywords.some(k => cleanMsg.includes(k))) {
                    rsvpStatus = 'declined';
                    confidence = 0.8;
                    persistLog(`[Webhook] ⚠️ Keyword match DECLINED: "${cleanMsg}"`);
                }
            }

            // === HANDLE RSVP RESULT ===
            if (rsvpStatus === 'confirmed' || rsvpStatus === 'declined') {
                // Save reply to DB
                try {
                    await supabase.from('whatsapp_replies').insert({
                        guest_id: guest.id,
                        event_id: guest.event_id,
                        phone: phone,
                        reply_text: messageText || `Button: ${actualButtonId}`,
                        is_rsvp: true,
                        rsvp_response: rsvpStatus,
                        ai_confidence: confidence || 0
                    }).then(({ error }) => {
                        if (error) {
                            return supabase.from('whatsapp_rsvp').insert({
                                guest_id: guest.id, event_id: guest.event_id,
                                response: rsvpStatus, response_message: messageText
                            });
                        }
                    });
                } catch (e) { console.error('[Webhook] ❌ RSVP save error:', e.message); }

                // Update guest status in DB
                await supabase.from('guests').update({
                    rsvp_status: rsvpStatus,
                    rsvp_at: new Date().toISOString()
                }).eq('id', guest.id);
                console.log(`[Webhook] ✅ Guest ${guest.name} → ${rsvpStatus}`);

                // === CONFIRMED: Send personal card ===
                if (rsvpStatus === 'confirmed') {
                    // Refresh guest data for latest card_image_url
                    const { data: freshGuest } = await supabase
                        .from('guests')
                        .select('id, name, event_id, card_image_url, phone')
                        .eq('id', guest.id)
                        .single();
                    if (freshGuest) guest = freshGuest;

                    // Always send the card (even if sent before)
                    if (guest.card_image_url) {
                        console.log(`[RSVP] 📬 Queueing priority card for ${guest.name}...`);
                        const reply = `تم تأكيد حضورك يا ${guest.name} ✅\n\nهذا كرت الدخول الخاص بك. يرجى إبرازه عند الوصول 🌹`;
                        
                        globalQueue.push({
                            type: 'webhook_card',
                            priority: 'high',
                            execute: async () => {
                                const sendRes = await callEvolutionWithInstance(`/message/sendMedia`, accountId, 'POST', {
                                    number: phone,
                                    options: { delay: 3000, presence: "composing" },
                                    mediatype: "image",
                                    caption: reply,
                                    media: guest.card_image_url,
                                    fileName: 'invitation_card.png'
                                });

                                if (sendRes && sendRes.key) {
                                    await supabase.from('whatsapp_messages').insert({
                                        event_id: guest.event_id,
                                        guest_id: guest.id,
                                        phone: phone,
                                        message_text: reply,
                                        image_url: guest.card_image_url,
                                        message_phase: 'qr_code',
                                        status: 'sent',
                                        sent_at: new Date().toISOString(),
                                        evolution_message_id: sendRes.key.id
                                    });
                                }
                            }
                        });
                    } else {
                        persistLog(`[RSVP] ⚠️ ${guest.name} confirmed but card_image_url is NULL`);
                        globalQueue.push({
                            type: 'webhook_text',
                            priority: 'high',
                            execute: async () => {
                                await callEvolutionWithInstance(`/message/sendText`, accountId, 'POST', {
                                    number: phone,
                                    options: { delay: 3000, presence: "composing" },
                                    text: `تم تأكيد حضورك يا ${guest.name} ✅ سيصلك كرت الدخول قريباً 🌹`
                                });
                            }
                        });
                    }
                }

                // === DECLINED: Short apology ===
                if (rsvpStatus === 'declined') {
                    globalQueue.push({
                        type: 'webhook_text',
                        priority: 'high',
                        execute: async () => {
                            await callEvolutionWithInstance(`/message/sendText`, accountId, 'POST', {
                                number: phone,
                                options: { delay: 2000, presence: "composing" },
                                text: `تم قبول اعتذارك يا ${guest.name} 😔 نتمنى نشوفك في مناسبة قادمة 🌹`
                            });
                            await recordDeclineSilently(guest.event_id);
                        }
                    });
                }

                // Notify event owner
                await notifyEventOwner(guest.event_id, guest.name, rsvpStatus, accountId);
            }
            // If not understood as confirm/decline → just ignore silently (no chatting)
            if (!rsvpStatus) {
                console.log(`[Webhook] ℹ️ Message from ${guest.name} not understood as RSVP. Ignoring silently.`);
            }
            return; // Done — don't fall through to replacement check
        }

        // === REPLACEMENT CHECK (Only if NOT a guest) ===
        const replacementMatch = await checkIfClientReplacementReply(phone, messageText);
        if (replacementMatch) {
            console.log(`[Webhook] 👤 Message from CLIENT (event owner) for event: ${replacementMatch.eventName}`);
            await processClientReplacementReply(replacementMatch, messageText, accountId);
            return;
        }

        // Unknown number — ignore silently
        console.log(`[Webhook] ℹ️ Message from ${phone} — no matching guest or client. Ignoring.`);
    } catch (error) {
        console.error('[Webhook] ❌ Error processing message:', error);
    }
});



// AI Message Generation
app.post('/api/whatsapp/generate-message', async (req, res) => {
    try {
        const { eventId, context, tone, imageUrl } = req.body;

        let eventDetails = '';
        if (eventId) {
            const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
            if (event) {
                eventDetails = `
Event Details:
- Name: ${event.name}
- Date: ${new Date(event.event_date).toLocaleDateString('ar-SA')}
- Location: ${event.location || 'TBD'}
`;
            }
        }

        const prompt = `
أنت مساعد ذكي متخصص في صياغة دعوات المناسبات الرسمية والخاصة بأسلوب راقي وجذاب باللهجة السعودية الأصيلة والمصطلحات الترحيبية الراقية.
الرجاء صياغة رسالة دعوة واتساب بناءً على التفاصيل التالية:
${eventDetails}

المتغيرات التي يجب أن تبقيها كما هي بالضبط ليتم استبدالها لاحقاً برمجياً (لا تقم بتغييرها أبداً):
{{name}} = اسم الضيف
{{location}} = الموقع
{{qr_link}} = رابط الباركود

السياق الإضافي أو التعديلات المطلوبة من المستخدم:
"${context || 'صغ رسالة دعوة ترحيبية راقية.'}"

${imageUrl ? 'مهم جداً: لقد أرفقت لك صورة الدعوة. يرجى النظر إليها وصياغة نص يتماشى مع تصميمها وفخامتها والمعلومات المكتوبة فيها (مثل اسم الداعي أو نوع المناسبة).' : ''}

قم بكتابة نص الدعوة فقط بدون أي مقدمات أو شروحات. تأكد من استخدام المتغيرات المذكورة. استخدم الإيموجي بشكل مناسب وراقٍ.
`;

        const messages = [
            {
                role: "user",
                content: imageUrl
                    ? [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: imageUrl } }
                    ]
                    : prompt
            }
        ];

        const completion = await openai.chat.completions.create({
            model: imageUrl ? "gpt-4o" : "gpt-4o-mini", // Use gpt-4o for better vision if image exists
            messages: messages,
            temperature: 0.7,
        });

        const generatedMessage = completion.choices[0].message.content.trim();
        res.json({ success: true, message: generatedMessage });
    } catch (error) {
        console.error('AI Generation Error:', error);
        res.status(500).json({ success: false, error: 'فشل في توليد الرسالة من الذكاء الاصطناعي' });
    }
});

// Sending
app.post('/api/whatsapp/send', async (req, res) => {
    const { accountId, phone, message, imageUrl } = req.body;

    try {
        const number = normalizePhone(phone);
        const jid = number; // Evolution V2 prefers plain numbers

        let result;
        if (imageUrl) {
            console.log(`[Send] Sending Media to ${number} via Proxy...`);
            result = await callEvolutionWithInstance(`/message/sendMedia`, accountId, 'POST', {
                number: jid,
                options: { delay: 1200, presence: "composing" },
                mediatype: "image",
                caption: message,
                media: imageUrl,
                fileName: 'image.png'
            });
        } else {
            console.log(`[Send] Sending Text to ${number} via Proxy...`);
            result = await callEvolutionWithInstance(`/message/sendText`, accountId, 'POST', {
                number: jid,
                options: { delay: 1200, presence: "composing" },
                text: message
            });
        }

        if (result?.key?.id) {
            console.log(`[${accountId}] Sent to ${number}`);
            res.json({ success: true, message: 'Sent' });
        } else {
            throw new Error(JSON.stringify(result));
        }

    } catch (error) {
        console.error('Send Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Demo Sending (With Buttons + Image Support)
app.post('/api/whatsapp/send-demo', async (req, res) => {
    const { accountId, phone, message, imageUrl } = req.body;

    try {
        const number = normalizePhone(phone);
        const jid = number;

        const finalMessage = `${message}\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار`;

        let result;
        if (imageUrl) {
            // Send image with caption (text + buttons)
            console.log(`[Demo] 📷 Sending Image+Text to ${number}...`);
            result = await callEvolutionWithInstance(`/message/sendMedia`, accountId, 'POST', {
                number: jid,
                options: { delay: 1200, presence: "composing" },
                mediatype: "image",
                caption: finalMessage,
                media: imageUrl,
                fileName: 'invitation.png'
            });
        } else {
            console.log(`[Demo] 📝 Sending Text to ${number}...`);
            result = await callEvolutionWithInstance(`/message/sendText`, accountId, 'POST', {
                number: jid,
                text: finalMessage,
                linkPreview: false
            });
        }

        if (result?.key?.id || result?.key) {
            console.log(`✅ [Success] Demo sent to ${number}. ID: ${result.key?.id || result.key}`);
            res.json({ success: true, message: 'Demo Sent', result });
        } else {
            console.error('❌ [Failure] Evolution Proxy Error:', result);
            res.status(500).json({ success: false, error: 'Evolution Error: Instance potentially disconnected or name mismatch', debug: result });
        }

    } catch (error) {
        console.error('Demo Send Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Individual Sending (Direct Send from Dashboard)
app.post('/api/whatsapp/send-individual', async (req, res) => {
    const { accountId, guestId, template, imageUrl } = req.body;

    try {
        // 1. Fetch Guest
        const { data: guest, error: guestError } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();

        if (guestError || !guest) throw new Error('Guest not found');

        // 2. Discover active instance (using accountId as hint)
        const instanceName = await discoverActiveInstance() || accountId;

        // 3. Process Template
        let finalMessage = template.replace(/{name}/g, guest.name || 'الضيف الكريم');
        
        // Add buttons instruction if not present
        if (!finalMessage.includes('1') && !finalMessage.includes('تأكيد')) {
            finalMessage += '\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار';
        }

        const jid = normalizePhone(guest.phone);

        console.log(`[Direct] 📤 Sending to ${guest.name} (${jid})...`);

        let result;
        if (imageUrl) {
            result = await callEvolutionWithInstance(`/message/sendMedia`, instanceName, 'POST', {
                number: jid,
                mediatype: "image",
                caption: finalMessage,
                media: imageUrl,
                fileName: 'invitation.png'
            });
        } else {
            result = await callEvolutionWithInstance(`/message/sendText`, instanceName, 'POST', {
                number: jid,
                text: finalMessage
            });
        }

        if (result?.key?.id || result?.key) {
            const evoMsgId = result.key?.id || (typeof result.key === 'string' ? result.key : null);
            
            // Log in whatsapp_messages
            await supabase.from('whatsapp_messages').insert({
                event_id: guest.event_id,
                guest_id: guest.id,
                phone: guest.phone,
                message_text: finalMessage,
                image_url: imageUrl,
                message_phase: 'invite',
                status: 'sent',
                delivery_status: 'sent',
                sent_at: new Date().toISOString(),
                evolution_message_id: evoMsgId
            });

            res.json({ success: true, message: 'Sent successfully' });
        } else {
            const errorReason = result?.response?.error?.[0] || result?.message || result?.error || 'Evolution Error';
            throw new Error(`Evolution API Error: ${errorReason}`);
        }

    } catch (error) {
        console.error('Direct Send Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// G4: Pre-Event Reminder for Confirmed Guests
async function processPreEventReminders() {
    try {
        const { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, name, date, settings');

        if (eventError || !events || events.length === 0) return;

        let instanceName = null;
        const now = new Date();

        for (const event of events) {
            const wsSettings = event.settings?.whatsapp_settings;
            if (!wsSettings || wsSettings.enable_pre_event_reminder !== true) continue;
            
            if (!event.date) continue;
            
            const eventDate = new Date(event.date);
            const daysDiff = (eventDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            const reminderDaysTarget = wsSettings.pre_event_reminder_days || 2;
            
            // If the event is exactly between reminderDaysTarget and reminderDaysTarget - 0.5 (12 hours) away
            // This ensures we only send the reminder once per event when it enters this window.
            if (daysDiff <= reminderDaysTarget && daysDiff > (reminderDaysTarget - 0.5)) {
                
                // Fetch confirmed guests
                const { data: guests, error: guestError } = await supabase
                    .from('guests')
                    .select('id, name, phone, pre_event_reminder_sent, card_image_url')
                    .eq('event_id', event.id)
                    .eq('rsvp_status', 'confirmed')
                    .eq('pre_event_reminder_sent', false)
                    .neq('status', 'pending');

                if (guestError || !guests || guests.length === 0) continue;

                if (!instanceName) instanceName = await discoverActiveInstance() || 'lony';

                for (const guest of guests) {
                    const number = normalizePhone(guest.phone);
                    console.log(`[Scheduler] 🗓️ Sending Pre-Event reminder to ${guest.name} (${number}) for event ${event.name}`);

                    const text = `السلام عليكم ${guest.name} 🌹\n\nتذكير بموعدنا القريب لـ *${event.name}* بعد ${reminderDaysTarget} أيام بإذن الله ✨\n\nبانتظارك، ولا تنسى كرت الدخول الخاص بك (الباركود) الذي أرسلناه لك سابقاً.\n\nنتشرف بحضورك 🙏`;

                    try {
                        let result;
                        if (guest.card_image_url) {
                            // Re-send barcode just in case
                            result = await callEvolutionWithInstance('/message/sendMedia', instanceName, 'POST', {
                                number: number,
                                mediatype: 'image',
                                caption: text,
                                media: guest.card_image_url,
                                fileName: 'invitation_card.png'
                            });
                        } else {
                            result = await callEvolutionWithInstance('/message/sendText', instanceName, 'POST', {
                                number: number,
                                text: text
                            });
                        }
                        
                        if (result && !result.error) {
                            await supabase.from('guests').update({
                                pre_event_reminder_sent: true
                            }).eq('id', guest.id);
                        }

                        await delay(2000); // Avoid rate limits
                    } catch (err) {
                        console.error(`[Scheduler] ❌ Failed to send pre-event reminder to ${number}:`, err.message);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[Scheduler] ❌ Pre-Event Reminder error:', e.message);
    }
}

// Bulk Sending Logic
app.post('/api/whatsapp/send-batch', async (req, res) => {
    try {
        const { eventId, mode = 'balanced', useButtons = true, accountId = null, autoFollowup = true, target = 'pending', limit = 0, chunkSize = 20, restDelayMinutes = 5 } = req.body;

        if (jobState.isRunning) return res.status(400).json({ success: false, error: 'Job already running' });

        // 1. Get connected account + discover real Evolution instance name
        let account = null;
        if (accountId) {
            const { data: accounts } = await supabase.from('whatsapp_accounts').select('id, phone').eq('id', accountId);
            account = accounts?.[0];
        } else {
            const { data: accounts } = await supabase.from('whatsapp_accounts').select('id, phone').eq('status', 'connected');
            account = accounts?.[0];
        }

        if (!account) {
            console.log('⚠️ No active/connected account found in DB. Falling back to Auto-Discovery...');
            account = { id: accountId || 'default', phone: 'Unknown' };
        }

        const discoveredInstance = await discoverActiveInstance();
        if (discoveredInstance) {
            console.log(`✨ Using discovered Evolution instance: "${discoveredInstance}" (DB account: ${account.id})`);
            account.evolutionInstanceName = discoveredInstance;
        } else {
            account.evolutionInstanceName = account.id; // fallback to UUID
            console.log(`⚠️ Could not discover instance. Using DB ID: ${account.id}`);
        }

        console.log(`🚀 Starting Batch. Instance: ${account.evolutionInstanceName} | Target: ${target} | Limit: ${limit}`);

        // 2. Get target messages (Delta Sending & Chunking)
        let query = supabase.from('whatsapp_messages')
            .select('id, guest_id, phone, message_text, image_url, guests (name)')
            .eq('event_id', eventId);
        
        if (target === 'failed') {
            query = query.eq('status', 'failed');
        } else if (target === 'pending') {
            query = query.eq('status', 'pending');
        } else if (target === 'specific' && req.body.guestIds) {
            query = query.in('guest_id', req.body.guestIds);
        }

        if (limit > 0) {
            query = query.limit(limit);
        }

        const { data: messages } = await query;

        if (!messages?.length) return res.status(400).json({ error: 'No messages found for this target. Prepare them first.' });

        // 3. Start Job State
        jobState = {
            isRunning: true,
            isPaused: false,
            eventId,
            accountId,
            autoFollowup,
            stats: {
                pending: messages.length,
                sent: 0,
                failed: 0,
                queued: messages.length
            },
            lastLog: `Queued ${messages.length} messages (${mode} mode) ...`,
            shouldStop: false
        };

        const waitTime = getSpeedDelay(mode);

        // 4. Enqueue all fetched messages into Global Queue
        for (const msg of messages) {
            globalQueue.push({
                type: 'batch',
                priority: 'normal',
                messageId: msg.id,
                execute: async () => {
                    if (jobState.shouldStop) {
                        jobState.isRunning = false;
                        return;
                    }
                    while (jobState.isPaused) await delay(1000);

                    try {
                        const number = normalizePhone(msg.phone);
                        const jid = number;
                        const guestName = msg.guests?.name || 'Guest';

                        // [G2: Number Validation]
                        let isNumberValid = true;
                        try {
                            console.log(`[Batch] 🔍 Verifying number ${jid}...`);
                            const checkRes = await callEvolutionWithInstance('/chat/whatsappNumbers', account.evolutionInstanceName, 'POST', { numbers: [jid] });
                            const resData = Array.isArray(checkRes) ? checkRes[0] : checkRes;
                            if (resData && resData.exists === false) {
                                isNumberValid = false;
                            }
                        } catch (checkErr) {
                            console.log(`[Batch] ⚠️ Verification check failed, will try to send anyway...`);
                        }

                        if (!isNumberValid) {
                            console.log(`[Batch] ❌ Invalid WhatsApp Number: ${number}. Skipping.`);
                            jobState.stats.failed++;
                            jobState.stats.pending--;
                            jobState.lastLog = `Invalid Number: ${guestName}`;
                            await supabase.from('whatsapp_messages').update({
                                status: 'failed', delivery_status: 'invalid_number', error_log: 'Number not registered', sent_at: new Date().toISOString()
                            }).eq('id', msg.id);
                            return; // Process next in queue
                        }

                        // [🚨 ANTI-BAN: BATCH REST LOGIC]
                        const safeChunkSize = parseInt(chunkSize, 10) || 20;
                        if (jobState.stats.sent > 0 && jobState.stats.sent % safeChunkSize === 0) {
                            const restTime = parseInt(restDelayMinutes, 10) * 60 * 1000 || 300000;
                            console.log(`[Campaign] ☕ استراحة المحاكاة الزمنية لمدة ${Math.round(restTime/1000)} ثانية...`);
                            jobState.lastLog = `Taking human rest for ${Math.round(restTime/60000)}m...`;
                            jobState.isResting = true;
                            await delay(restTime);
                            jobState.isResting = false;
                        }

                        // Build & Spintax text
                        let finalText = msg.message_text || '';
                        if (useButtons && !finalText.includes('1') && !finalText.includes('تأكيد')) {
                            finalText += '\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار';
                        }
                        finalText = applySpintax(finalText); // Apply invisibility/variance matrix

                        let res;
                        const typingDelay = Math.floor(Math.random() * 3000) + (mode === 'fast' ? 1000 : 2500); 
                        
                        if (msg.image_url) {
                            console.log(`[Batch] 📷 Sending Media to ${number} (${guestName})...`);
                            res = await callEvolutionWithInstance(`/message/sendMedia`, account.evolutionInstanceName, 'POST', {
                                number: jid, options: { delay: typingDelay, presence: "composing" }, mediatype: "image", caption: finalText, media: msg.image_url, fileName: 'invitation.png'
                            });
                        } else {
                            console.log(`[Batch] 📝 Sending Text to ${number} (${guestName})...`);
                            res = await callEvolutionWithInstance(`/message/sendText`, account.evolutionInstanceName, 'POST', {
                                number: jid, options: { delay: typingDelay, presence: "composing" }, text: finalText
                            });
                        }

                        if (res?.key?.id || res?.key) {
                            const evoMsgId = res.key?.id || (typeof res.key === 'string' ? res.key : null);
                            console.log(`✅ [Batch] Sent to ${number}. ID: ${evoMsgId}`);
                            jobState.stats.sent++;
                            jobState.stats.pending--;
                            jobState.lastLog = `Sent: ${guestName}`;
                            await supabase.from('whatsapp_messages').update({
                                status: 'sent', delivery_status: 'sent', sent_at: new Date().toISOString(), sender_account: account.phone, evolution_message_id: evoMsgId
                            }).eq('id', msg.id);
                        } else {
                            // [DISCONNECTION PROTECTION]
                            console.error('Batch Item Error:', res);
                            jobState.isPaused = true; // Auto-pause the entire campaign!
                            jobState.lastLog = `Disconnected! Queue Paused. Error: ${res?.error || 'Unknown'}`;
                            throw new Error('Connection Drop: ' + (res?.error || 'Instance disconnected'));
                        }

                        // Dynamic Delay between normal sends
                        const extraDelay = Math.floor(Math.random() * 5000); 
                        await delay(waitTime + extraDelay);

                        // If queue is empty, job is done
                        if (jobState.stats.pending <= 0) {
                            jobState.isRunning = false;
                            jobState.lastLog = 'Done.';
                        }

                    } catch (e) {
                        console.error(`Failed Queue Item:`, e.message);
                        if (jobState.isPaused) {
                            console.log(`[Batch] ⏸️ Paused to save ${guestName} from falling into failed status.`);
                        } else {
                            jobState.stats.failed++;
                            jobState.stats.pending--;
                            jobState.lastLog = `Error: ${e.message}`;
                            await supabase.from('whatsapp_messages').update({ status: 'failed', error_message: e.message }).eq('id', msg.id);
                        }
                    }
                }
            });
        }

        res.json({ success: true, message: `Queued ${messages.length} messages` });
    } catch (error) {
        console.error('Batch Sending Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Control routes
app.post('/api/whatsapp/stop', (req, res) => { jobState.shouldStop = true; res.json({ success: true }); });
app.post('/api/whatsapp/pause', (req, res) => { jobState.isPaused = true; res.json({ success: true }); });
app.post('/api/whatsapp/resume', (req, res) => { jobState.isPaused = false; res.json({ success: true }); });

// G1: Retry failed messages
app.post('/api/whatsapp/retry-failed', async (req, res) => {
    try {
        const { eventId } = req.body;
        if (!eventId) return res.status(400).json({ error: 'eventId required' });

        // Reset failed messages to pending
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .update({ status: 'pending', delivery_status: null, error_message: null })
            .eq('event_id', eventId)
            .eq('status', 'failed')
            .select();

        if (error) throw error;

        const count = data?.length || 0;
        console.log(`[Retry] 🔄 Reset ${count} failed messages to pending for event ${eventId}`);

        res.json({ success: true, count, message: `${count} رسالة جاهزة لإعادة الإرسال. اضغط "إرسال" مرة ثانية.` });
    } catch (error) {
        console.error('Retry Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// F3: Delivery stats per event
app.get('/api/whatsapp/delivery-stats/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;

        const { data: messages, error } = await supabase
            .from('whatsapp_messages')
            .select('id, phone, status, delivery_status, sent_at, delivered_at, read_at, guest_id, guests(name)')
            .eq('event_id', eventId)
            .in('status', ['sent', 'failed'])
            .order('sent_at', { ascending: false });

        if (error) throw error;

        const stats = {
            total: messages?.length || 0,
            sent: messages?.filter(m => m.delivery_status === 'sent').length || 0,
            delivered: messages?.filter(m => m.delivery_status === 'delivered').length || 0,
            read: messages?.filter(m => m.delivery_status === 'read').length || 0,
            failed: messages?.filter(m => m.status === 'failed').length || 0,
        };

        res.json({
            success: true,
            stats,
            messages: messages?.map(m => ({
                id: m.id,
                phone: m.phone,
                guestName: m.guests?.name || 'Unknown',
                status: m.status,
                deliveryStatus: m.delivery_status,
                sentAt: m.sent_at,
                deliveredAt: m.delivered_at,
                readAt: m.read_at
            }))
        });
    } catch (error) {
        console.error('Delivery Stats Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get(['/api/whatsapp/status', '/api/whatsapp/status/:eventId'], (req, res) => {
    const { eventId } = req.params;
    res.json({
        success: true,
        status: {
            isRunning: !!jobState.isRunning,
            isPaused: !!jobState.isPaused,
            lastLog: jobState.lastLog || '',
            stats: {
                sent: jobState.stats.sent || 0,
                failed: jobState.stats.failed || 0,
                pending: jobState.stats.pending || 0,
                total: (jobState.stats.sent || 0) + (jobState.stats.failed || 0) + (jobState.stats.pending || 0),
                processed: (jobState.stats.sent || 0) + (jobState.stats.failed || 0)
            }
        }
    });
});
// Prepare messages stub
app.post('/api/whatsapp/prepare-messages', async (req, res) => {
    try {
        const { eventId, template, customMessage, messagePhase = 'invite', globalImageUrl = null, filters } = req.body;
        
        if (preparingLocks.has(eventId)) {
            return res.status(400).json({ success: false, error: 'رجاء الانتظار، جاري تحضير الرسائل لنفس المناسبة...' });
        }
        preparingLocks.add(eventId);

        // Support both direct targetAudience param and nested filters object from frontend
        let targetAudience = req.body.targetAudience || 'all';
        if (filters?.rsvp_status && filters.rsvp_status !== 'all') {
            targetAudience = filters.rsvp_status;
        }

        // 1. Get event details
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (eventError) {
            preparingLocks.delete(eventId);
            throw eventError;
        }

        const ws = event.settings?.whatsapp_settings || {};
        const isDirectSend = ws.enable_direct_send === true;

        // 2. Build guest query
        let query = supabase
            .from('guests')
            .select('id, name, phone, card_image_url, custom_data, rsvp_status, category, whatsapp_messages(id)')
            .eq('event_id', eventId);

        // Filters
        if (targetAudience === 'confirmed') {
            query = query.or('rsvp_status.eq.attending,rsvp_status.eq.confirmed');
        } else if (targetAudience === 'pending') {
            query = query.is('rsvp_status', null);
        } else if (targetAudience === 'declined') {
            query = query.eq('rsvp_status', 'declined');
        } else if (targetAudience === 'replacements') {
            query = query.eq('category', 'replacement');
        } else if (targetAudience === 'specific' && req.body.guestIds) {
            query = query.in('id', req.body.guestIds);
        }
        if (messagePhase === 'qr_code') {
            query = query.eq('rsvp_status', 'confirmed');
        }

        const { data: guests, error: guestsError } = await query;
        if (guestsError) {
            preparingLocks.delete(eventId);
            throw guestsError;
        }

        // 3. Clear existing pending for this event/phase to avoid duplicates
        await supabase
            .from('whatsapp_messages')
            .delete()
            .eq('event_id', eventId)
            .eq('message_phase', messagePhase)
            .eq('status', 'pending');

        // 4. Insert new messages
        const messages = guests
            .filter(g => {
                const name = (g.name || '').toLowerCase();
                const phone = (g.phone || '');
                const isSample = name.includes('عينة') || name.includes('sample') || phone.includes('000000');
                if (!g.phone || isSample) return false;
                
                // For 'unsent', skip if they already have whatsapp_messages
                if (targetAudience === 'unsent' && g.whatsapp_messages && g.whatsapp_messages.length > 0) return false;
                
                return true;
            })
            .map(guest => {
                const variables = getTemplateVariables(guest, event);
                let messageText = customMessage
                    ? fillTemplate(customMessage, variables)
                    : fillTemplate(template, variables);

                // Auto-append 1/2 instructions for 'invite' phase ONLY if NOT in direct send mode
                if (!isDirectSend && messagePhase === 'invite' && !messageText.includes('1') && !messageText.includes('تأكيد')) {
                    messageText += "\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار";
                }
                
                // If direct send is enabled, we allow using the guest's personalized card even in invite phase
                const finalImageUrl = (isDirectSend && messagePhase === 'invite' && guest.card_image_url) 
                    ? guest.card_image_url 
                    : (messagePhase === 'invite' ? (globalImageUrl || null) : guest.card_image_url);

                return {
                    event_id: eventId,
                    guest_id: guest.id,
                    phone: guest.phone,
                    message_text: messageText,
                    image_url: finalImageUrl,
                    message_phase: messagePhase,
                    status: 'pending'
                };
            });

        if (messages.length > 0) {
            const { data, error } = await supabase.from('whatsapp_messages').insert(messages).select();
            if (error) throw error;
            res.json({ success: true, count: messages.length, messages: data });
        } else {
            res.json({ success: true, count: 0, messages: [], message: 'No eligible guests found' });
        }

    } catch (error) {
        console.error('Prepare Error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        preparingLocks.delete(req.body.eventId);
    }
});

// B2: Add Replacement Endpoint
app.post('/api/whatsapp/add-replacement', async (req, res) => {
    try {
        const { event_id, name, phone, companions_count } = req.body;

        const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', event_id).single();
        if (eventError || !event) throw new Error("Event not found");

        if (event.date) {
            const eventDate = new Date(event.date);
            const diffHours = (new Date().getTime() - eventDate.getTime()) / (1000 * 60 * 60);
            if (diffHours > 48) throw new Error("لا يمكن إضافة بدلاء بعد انتهاء الحدث بـ 48 ساعة");
        }

        const { data: guests, error: guestsError } = await supabase.from('guests').select('id, rsvp_status, override_status, name').eq('event_id', event_id);
        if (guestsError) throw guestsError;

        const declinedGuests = guests.filter(g => g.rsvp_status === 'declined' || g.override_status === 'declined');
        if (declinedGuests.length === 0) throw new Error("لا يوجد معتذرين لاستبدالهم");

        const { data: reps, error: repsError } = await supabase.from('guest_replacements').select('original_guest_id').eq('event_id', event_id);
        if (repsError) throw repsError;

        if (reps.length >= declinedGuests.length) {
            throw new Error("لقد استنفذت عدد البدلاء المتاح لك (" + declinedGuests.length + ")");
        }

        const replacedIds = reps.map(r => r.original_guest_id);
        const availableDeclined = declinedGuests.find(g => !replacedIds.includes(g.id));

        if (!availableDeclined) throw new Error("حدث خطأ في العثور على معتذر صالح للاستبدال");

        const qr_token = Math.random().toString(36).substring(2, 10).toUpperCase();

        const { data: newGuest, error: newGuestError } = await supabase.from('guests').insert([{
            event_id,
            name,
            phone,
            category: 'replacement',
            companions_count_invited: companions_count,
            companions_count_actual: 0,
            rsvp_status: 'pending',
            qr_token,
            status: 'pending'
        }]).select().single();

        if (newGuestError) throw newGuestError;

        const { data: newRep, error: newRepError } = await supabase.from('guest_replacements').insert([{
            event_id,
            original_guest_id: availableDeclined.id,
            original_guest_name: availableDeclined.name,
            replacement_guest_id: newGuest.id,
            replacement_guest_name: newGuest.name,
            replacement_phone: newGuest.phone,
            card_generated: false,
            card_sent: false
        }]).select().single();

        if (newRepError) throw newRepError;

        res.json({ success: true, new_guest: newGuest, replacement: newRep });

    } catch (e) {
        console.error('Add Replacement Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// B4: Send Replacement Card Endpoint
app.post('/api/whatsapp/send-replacement', async (req, res) => {
    try {
        const { event_id, guest_id, image_url } = req.body;

        const { data: guest } = await supabase.from('guests').select('*').eq('id', guest_id).single();
        const { data: event } = await supabase.from('events').select('name').eq('id', event_id).single();

        if (!guest) throw new Error("Guest not found");

        let instanceName = await discoverActiveInstance() || 'lony';
        const number = normalizePhone(guest.phone);
        const text = `دعوة خاصة 🌟\n\nالسلام عليكم ${guest.name} 🌹\nبكل الحب والتقدير نتشرف\nبدعوتكم لـ ${event?.name || 'المناسبة'}\n\nنأمل تأكيد حضوركم عبر الأزرار أدناه ليتم اعتماد مقاعدكم:\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار`;

        let result;
        if (image_url) {
            result = await callEvolutionWithInstance(`/message/sendMedia`, instanceName, 'POST', {
                number: number,
                options: { delay: 1200, presence: "composing" },
                mediatype: "image",
                caption: text,
                media: image_url,
                fileName: 'invitation.png'
            });
        } else {
            result = await callEvolutionWithInstance(`/message/sendText`, instanceName, 'POST', {
                number: number,
                text: text
            });
        }

        if (result?.key?.id || result?.key) {
            await supabase.from('guest_replacements').update({ card_sent: true }).eq('replacement_guest_id', guest.id);
            res.json({ success: true, message: 'Replacement sent' });
        } else {
            throw new Error(result?.error || 'Failed to send message via Evolution');
        }

    } catch (e) {
        console.error('Send Replacement Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 Adapter Server running on port ${PORT}`);
    console.log(`🔗 Connected to Evolution API at ${EVOLUTION_URL}`);
    console.log(`🛡️  Evolution API Key: ...${EVOLUTION_API_KEY.slice(-4)}`);

    // === AUTO-REGISTER WEBHOOK WITH ALL EVOLUTION INSTANCES ===
    const PUBLIC_URL = process.env.PUBLIC_URL;
    if (PUBLIC_URL) {
        console.log(`🔗 PUBLIC_URL detected: ${PUBLIC_URL}. Attempting webhook registration...`);
        try {
            // Wait a bit for Evolution API to be fully ready
            await delay(3000);

            const instancesResp = await callEvolution('/instance/fetchInstances');
            const instancesList = instancesResp.data || (Array.isArray(instancesResp) ? instancesResp : []);

            if (instancesList.length === 0) {
                console.log('⚠️ No instances found in Evolution API. Webhook will be registered when an instance is created.');
            }

            const targetInstanceName = process.env.EVOLUTION_INSTANCE_NAME || 'lony';

            for (const inst of instancesList) {
                const instName = inst.instanceName || inst.name || inst.id || inst.instanceId;
                if (!instName) continue;

                // CRITICAL: Protect other instances! Only register webhook for our target instance.
                if (instName.toLowerCase() !== targetInstanceName.toLowerCase()) {
                    console.log(`🛡️ Skipping webhook registration for foreign instance: "${instName}"`);
                    continue; // Skip the other agent's instance
                }

                try {
                    const webhookUrl = `${PUBLIC_URL}/webhook`;

                    // Try multiple formats (different Evolution API versions)
                    // Format 1: Nested webhook object with enabled:true (Evolution API v2.3.7)
                    let setResult = await callEvolution(`/webhook/set/${instName}`, 'POST', {
                        webhook: {
                            enabled: true,
                            url: webhookUrl,
                            webhook_by_events: false,
                            webhook_base64: false,
                            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
                        }
                    });

                    // If first format failed, try alternative format
                    if (setResult.status === 400 || setResult.error) {
                        console.log(`   ⚠️ Format 1 failed, trying alternative webhook format...`);
                        setResult = await callEvolution(`/webhook/set/${instName}`, 'POST', {
                            webhook: webhookUrl,
                            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
                        });
                    }

                    // If still failed, try instance update approach
                    if (setResult.status === 400 || setResult.error) {
                        console.log(`   ⚠️ Format 2 failed, trying instance update...`);
                        setResult = await callEvolution(`/instance/update/${instName}`, 'PUT', {
                            webhook: webhookUrl,
                            webhook_by_events: false,
                            webhook_base64: false,
                            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
                        });
                    }

                    if (!setResult.error && setResult.status !== 400) {
                        console.log(`✅ Webhook registered for target instance "${instName}" -> ${webhookUrl}`);
                    } else {
                        console.warn(`⚠️ Webhook registration for "${instName}":`, JSON.stringify(setResult).substring(0, 200));
                    }
                } catch (e) {
                    console.error(`❌ Failed to register webhook for "${instName}":`, e.message);
                }
            }
        } catch (error) {
            console.error('❌ Webhook auto-registration failed:', error.message);
        }
    } else {
        console.warn('⚠️ PUBLIC_URL not set in .env! Webhook registration skipped.');
        console.warn('   Set PUBLIC_URL=http://host.docker.internal:3001 (Docker) or use ngrok for external access.');
    }

    // Heartbeat to keep process alive and confirm health
    setInterval(() => {
        const memory = Math.round(process.memoryUsage().rss / 1024 / 1024);
        console.log(`[HEARTBEAT] ❤️ Server is active. Memory: ${memory}MB | Time: ${new Date().toLocaleTimeString()}`);
    }, 60000); // Every minute

    // Smart Summary Scheduler — checks every hour for events needing 48h summary
    setInterval(() => {
        checkAndSendSmartSummaries().catch(e => console.error('[Scheduler] Error:', e.message));
    }, 60 * 60 * 1000); // Every hour
    console.log('📊 Smart Summary Scheduler active (checks every hour for 48h summaries)');

    // Auto-Reminder Scheduler — checks every hour for guests needing 24h reminders
    setInterval(() => {
        processAutoReminders().catch(e => console.error('[Scheduler] Error:', e.message));
    }, 60 * 60 * 1000); // Every hour
    console.log('⏰ Auto-Reminder Scheduler active (checks every hour for 24h reminders)');

    // Pre-Event Reminder Scheduler — checks every hour
    setInterval(() => {
        processPreEventReminders().catch(e => console.error('[Scheduler] Error:', e.message));
    }, 60 * 60 * 1000); // Every hour
    console.log('🗓️  Pre-Event Reminder Scheduler active');
});
