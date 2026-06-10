import express from 'express';
import { handler } from '../netlify/functions/meta-webhook.mjs';

const app = express();
const PORT = 3011;

// Middleware to capture raw body for webhook verification if needed
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

app.all('/api/meta-webhook', async (req, res) => {
  // Convert Express request to Netlify Event format
  const event = {
    httpMethod: req.method,
    queryStringParameters: req.query,
    body: req.rawBody || JSON.stringify(req.body),
    isBase64Encoded: false,
  };

  try {
    const response = await handler(event);
    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Error handling webhook locally:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 الخادم المحلي يعمل على المنفذ ${PORT}`);
  console.log(`\nلربط هذا الخادم مع Meta (واتساب)، يرجى تشغيل الأمر التالي في نافذة جديدة:`);
  console.log(`npx localtunnel --port ${PORT}`);
  console.log(`\nثم قم بنسخ الرابط الناتج (ينتهي بـ .loca.lt) وإضافته في إعدادات Meta Webhook بالشكل التالي:`);
  console.log(`https://<YOUR-LOCALTUNNEL-URL>/api/meta-webhook`);
  console.log(`(رمز التحقق: lony_invite_v1_secure)\n`);
});
