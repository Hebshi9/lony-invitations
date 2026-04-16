import 'dotenv/config';

async function testMeta() {
  const META_PHONE = process.env.META_PHONE_NUMBER_ID;
  const META_TOKEN = process.env.META_ACCESS_TOKEN;
  
  if (!META_PHONE || !META_TOKEN) {
      console.log('Missing env variables');
      return;
  }

  const phone = '966503678789'; // Ahmed's phone from previous logs
  
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: 'lony',
      language: { code: 'ar' },
      components: [
        {
          type: 'header',
          parameters: [{
            type: 'image',
            image: { 
                link: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png'
            }
          }]
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'guest_name', text: 'أحمد الحبشي' },
            { type: 'text', parameter_name: 'groom_name', text: 'أحمد' },
            { type: 'text', parameter_name: 'bride_name', text: 'سارة' },
            { type: 'text', parameter_name: 'event_date', text: '2026-04-20' },
            { type: 'text', parameter_name: 'event_location', text: 'قاعة الاحتفالات' }
          ]
        }
      ]
    }
  };

  try {
      console.log('Sending to Meta API...');
      const res = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${META_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log('Status:', res.status);
      console.log('Response:', JSON.stringify(data, null, 2));
  } catch(e) {
      console.error(e);
  }
}
testMeta();
