import 'dotenv/config';

async function testHello() {
  const META_PHONE = process.env.META_PHONE_NUMBER_ID;
  const META_TOKEN = process.env.META_ACCESS_TOKEN;

  const phone = '966503678789'; // Ahmed
  
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' }
    }
  };

  try {
      console.log('Sending hello_world to Meta API...');
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
testHello();
