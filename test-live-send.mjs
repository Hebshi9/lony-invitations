import fetch from 'node-fetch';

const META_ACCESS_TOKEN = "EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG";
const META_PHONE_NUMBER_ID = "1031606736708015";

async function testSend() {
    console.log("🚀 جاري إرسال رسالة تجريبية إلى 0569667344...");
    const res = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: '966569667344',
            type: 'template',
            template: {
                name: 'lony', 
                language: { code: 'ar' },
                components: [
                    { type: 'header', parameters: [{ type: 'image', image: { link: 'https://lonyinvite.netlify.app/card-placeholder.png' } }] },
                    { type: 'body', parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: 'ضيفنا' }, 
                        { type: 'text', parameter_name: 'groom_name', text: 'العريس' },
                        { type: 'text', parameter_name: 'bride_name', text: 'العروس' },
                        { type: 'text', parameter_name: 'event_date', text: 'اليوم' },
                        { type: 'text', parameter_name: 'event_location', text: 'الرياض' }
                    ] }
                ]
            }
        })
    });
    
    const data = await res.json();
    console.log("رد سيرفرات Meta:", data);
}
testSend();
