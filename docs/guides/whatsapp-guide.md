# WhatsApp Integration Setup Guide

## 📋 Prerequisites

Before running the WhatsApp integration, you need to:

1. ✅ Apply the database schema
2. ✅ Install dependencies
3. ✅ Start the API server
4. ✅ Start the frontend

---

## Step 1: Apply Database Schema

Run this SQL in your Supabase SQL Editor:

```bash
# Open Supabase dashboard
# Go to SQL Editor
# Copy and paste the contents of: supabase/whatsapp-schema.sql
# Click "Run"
```

Or use the Supabase CLI:

```bash
supabase db push
```

---

## Step 2: Install Dependencies

```bash
npm install whatsapp-web.js qrcode-terminal bull express cors
```

---

## Step 3: Start the API Server

The WhatsApp API server needs to run separately from the frontend:

```bash
# In a new terminal window
node api/whatsapp-server.js
```

The server will start on `http://localhost:3001`

---

## Step 4: Start the Frontend

```bash
# In your main terminal
npm run dev
```

---

## 🚀 Usage

### 1. Add WhatsApp Accounts

1. Navigate to `/whatsapp-sender`
2. Enter phone number (e.g., `+966501234567`)
3. Enter account name (optional)
4. Click "إضافة حساب"

### 2. Connect Accounts

1. Click "اتصال" button for each account
2. **Important**: Check the terminal where `whatsapp-server.js` is running
3. Scan the QR code with your WhatsApp mobile app
4. Wait for "WhatsApp client ready" message

### 3. Prepare Messages

1. Select an event
2. Choose a message template
3. Customize the message if needed
4. Click "تجهيز الرسائل"

### 4. Start Sending

1. Click "بدء الإرسال"
2. Monitor progress in real-time
3. Use pause/resume/stop controls as needed

---

## ⚙️ Configuration

### Adjust Sending Parameters

Edit `src/services/queue-manager.js`:

```javascript
this.messagesPerBatch = 20; // Messages per batch
this.delayBetweenBatches = 10 * 60 * 1000; // 10 minutes
this.delayBetweenMessages = 3000; // 3 seconds
```

### Adjust Daily Limits

When adding an account, set custom daily limit:

```javascript
{
    phone: "+966...",
    name: "Account 1",
    daily_limit: 170  // Adjust this
}
```

---

## 🔧 Troubleshooting

### QR Code Not Showing

- Check that `whatsapp-server.js` is running
- Look at the terminal output for QR code
- Make sure port 3001 is not blocked

### Account Not Connecting

- Clear WhatsApp Web sessions on your phone
- Delete and re-add the account
- Restart the API server

### Messages Not Sending

- Verify accounts are connected (green wifi icon)
- Check that guests have phone numbers
- Look at API server logs for errors

### Account Banned

- Reduce `messagesPerBatch` to 15
- Increase `delayBetweenBatches` to 15 minutes
- Use a different phone number

---

## 📊 Monitoring

### Check Queue Status

The UI shows real-time statistics:
- **قيد الانتظار**: Pending messages
- **في القائمة**: Queued for sending
- **تم الإرسال**: Successfully sent
- **فشل**: Failed messages

### Check Account Stats

Each account card shows:
- Connection status
- Messages sent today
- Daily limit remaining

---

## 🛡️ Safety Tips

1. **Use Secondary Numbers**: Never use your personal WhatsApp number
2. **Start Small**: Test with 10-20 messages first
3. **Monitor Closely**: Watch for any warnings from WhatsApp
4. **Respect Limits**: Don't exceed 170 messages/day per account
5. **Space Out Sending**: Use the default delays or increase them

---

## 🔄 Upgrading to WhatsApp Business API

If you want to scale up safely:

1. Apply for WhatsApp Business API through:
   - [Twilio](https://www.twilio.com/whatsapp)
   - [360dialog](https://www.360dialog.com)
   - [MessageBird](https://www.messagebird.com)

2. Update `whatsapp-service.js` to use the official API instead of `whatsapp-web.js`

3. Benefits:
   - No risk of bans
   - Unlimited sending
   - Official support
   - Delivery reports

---

## 📝 Next Steps

- [ ] Test with a small batch (10 messages)
- [ ] Monitor for 24 hours
- [ ] Scale up gradually
- [ ] Consider Business API for production use
