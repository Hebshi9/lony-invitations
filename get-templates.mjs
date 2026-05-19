import fetch from 'node-fetch';

const META_ACCESS_TOKEN = "EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG";
const META_WABA_ID = "3277627339072448";

async function getTemplates() {
    console.log("Fetching templates...");
    const res = await fetch(`https://graph.facebook.com/v21.0/${META_WABA_ID}/message_templates`, {
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`
        }
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
getTemplates();
