/**
 * Quick script to add the missing DELETE endpoint to whatsapp-server.js
 * This adds DELETE /api/whatsapp/accounts/:accountId endpoint
 */

import fs from 'fs';

const serverPath = './api/whatsapp-server.js';
const content = fs.readFileSync(serverPath, 'utf8');

// Find the line after disconnect endpoint (after closing brace and before AI Generation comment)
const insertMarker = '});\n\n// ============= AI Generation =============';

const deleteEndpoint = `});\n\n/**\n * DELETE /api/whatsapp/accounts/:accountId\n * Delete an account (disconnect first, then remove from database)\n */\napp.delete('/api/whatsapp/accounts/:accountId', async (req, res) => {\n    try {\n        const { accountId } = req.params;\n        console.log(\`[Server] 🗑️ Deleting account: \${accountId}\`);\n        \n        // First disconnect if connected\n        try {\n            await whatsappService.disconnect(accountId);\n            console.log('[Server] Disconnected before delete');\n        } catch (e) {\n            console.log('[Server] Not connected or already disconnected');\n        }\n        \n        // Delete from database\n        const { error } = await supabase\n            .from('whatsapp_accounts')\n            .delete()\n            .eq('id', accountId);\n        \n        if (error) throw error;\n        \n        console.log(\`[Server] ✅ Account deleted successfully\`);\n        res.json({ success: true, message: 'Account deleted successfully' });\n    } catch (error) {\n        console.error('[Server] ❌ Delete error:', error);\n        res.status(500).json({ success: false, error: error.message });\n    }\n});\n\n// ============= AI Generation =============`;

if (content.includes('app.delete')) {
    console.log('✅ DELETE endpoint already exists!');
} else {
    const newContent = content.replace(insertMarker, deleteEndpoint);
    fs.writeFileSync(serverPath, newContent, 'utf8');
    console.log('✅ DELETE endpoint added successfully!');
}
