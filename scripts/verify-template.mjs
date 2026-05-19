import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const WABA_ID = process.env.META_WABA_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;
const TEMPLATE_NAME = 'get_update';

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('   🔍 Meta Template Diagnostic Tool');
    console.log('═══════════════════════════════════════════\n');

    // 1. Fetch template from Meta
    console.log(`📡 Fetching template "${TEMPLATE_NAME}" from WABA ${WABA_ID}...\n`);
    
    const url = `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();

    if (data.error) {
        console.error('❌ Meta API Error:', data.error.message);
        return;
    }

    if (!data.data || data.data.length === 0) {
        console.error(`❌ Template "${TEMPLATE_NAME}" NOT FOUND in your WABA account!`);
        console.log('   Available templates:');
        const allUrl = `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?limit=50`;
        const allRes = await fetch(allUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const allData = await allRes.json();
        if (allData.data) {
            allData.data.forEach(t => console.log(`   - ${t.name} (${t.status}) [${t.category}]`));
        }
        return;
    }

    const template = data.data[0];
    console.log(`✅ Template Found!`);
    console.log(`   Name: ${template.name}`);
    console.log(`   Status: ${template.status}`);
    console.log(`   Category: ${template.category}`);
    console.log(`   Language: ${template.language}\n`);

    // 2. Analyze components
    console.log('📋 Template Components:');
    console.log('───────────────────────');
    
    let headerType = null;
    let bodyVarCount = 0;
    let buttonCount = 0;
    let buttonTypes = [];

    for (const comp of template.components) {
        console.log(`\n  [${comp.type.toUpperCase()}]`);
        
        if (comp.type === 'HEADER') {
            headerType = comp.format;
            console.log(`    Format: ${comp.format}`);
            if (comp.example?.header_handle) {
                console.log(`    Example: ${comp.example.header_handle[0]?.substring(0, 60)}...`);
            }
        }
        
        if (comp.type === 'BODY') {
            console.log(`    Text: ${comp.text}`);
            const vars = comp.text.match(/\{\{(\d+)\}\}/g) || [];
            bodyVarCount = vars.length;
            console.log(`    Variables: ${bodyVarCount} → ${vars.join(', ')}`);
            if (comp.example?.body_text) {
                console.log(`    Example values: ${JSON.stringify(comp.example.body_text[0])}`);
            }
        }
        
        if (comp.type === 'FOOTER') {
            console.log(`    Text: ${comp.text}`);
        }
        
        if (comp.type === 'BUTTONS') {
            for (const btn of comp.buttons) {
                buttonCount++;
                buttonTypes.push(btn.type);
                console.log(`    Button ${buttonCount}: [${btn.type}] "${btn.text}"`);
                if (btn.url) console.log(`      URL: ${btn.url}`);
                if (btn.type === 'URL' && btn.url?.includes('{{')) {
                    console.log(`      ⚠️  Dynamic URL - needs parameter!`);
                }
            }
        }
    }

    // 3. Compare with our payload
    console.log('\n\n═══════════════════════════════════════════');
    console.log('   📊 Compatibility Analysis');
    console.log('═══════════════════════════════════════════\n');

    // Our payload sends 5 body vars
    const ourBodyVars = 5;
    const ourHeaderType = 'IMAGE';
    const ourButtons = ['QUICK_REPLY', 'QUICK_REPLY', 'URL'];

    // Header check
    if (headerType === ourHeaderType) {
        console.log(`✅ Header: Match (${headerType})`);
    } else if (headerType === null) {
        console.log(`❌ Header: Template has NO header, but we send IMAGE!`);
        console.log(`   FIX: Remove header component from payload`);
    } else {
        console.log(`❌ Header: Mismatch! Template=${headerType}, We send=${ourHeaderType}`);
    }

    // Body vars check
    if (bodyVarCount === ourBodyVars) {
        console.log(`✅ Body Variables: Match (${bodyVarCount})`);
    } else {
        console.log(`❌ Body Variables: Mismatch! Template expects ${bodyVarCount}, we send ${ourBodyVars}`);
        console.log(`   FIX: Adjust parameters array to have exactly ${bodyVarCount} items`);
    }

    // Buttons check
    if (buttonCount === ourButtons.length) {
        console.log(`✅ Button Count: Match (${buttonCount})`);
    } else {
        console.log(`❌ Button Count: Mismatch! Template has ${buttonCount}, we send ${ourButtons.length}`);
    }

    for (let i = 0; i < Math.max(buttonCount, ourButtons.length); i++) {
        const tmplType = buttonTypes[i] || 'MISSING';
        const ourType = ourButtons[i] || 'MISSING';
        if (tmplType === ourType) {
            console.log(`   ✅ Button ${i}: Match (${tmplType})`);
        } else {
            console.log(`   ❌ Button ${i}: Template=${tmplType}, We send=${ourType}`);
        }
    }

    // 4. Print full raw JSON for reference
    console.log('\n\n═══════════════════════════════════════════');
    console.log('   📦 Raw Template JSON');
    console.log('═══════════════════════════════════════════\n');
    console.log(JSON.stringify(template, null, 2));
}

main().catch(e => console.error('Fatal:', e.message));
