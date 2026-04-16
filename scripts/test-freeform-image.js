import 'dotenv/config';

async function testFreeformImage() {
  const META_PHONE = process.env.META_PHONE_NUMBER_ID;
  const META_TOKEN = process.env.META_ACCESS_TOKEN;

  const phone = '966503678789'; // Ahmed
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'image',
    image: {
      link: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/17490649-b5cb-462b-9f09-6e0a252d4676/global_invite_1772288277251.png',
      caption: 'تفضّل، بطاقة الدخول الخاصة بك. نتمنى لك وقتاً ممتعاً! ✨'
    }
  };

  try {
      console.log('Sending pure image (Free-Form) to Meta API...');
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
testFreeformImage();
