#!/bin/bash
# Lony Invitations - VPS Auto-Recovery Script
echo "🚀 Starting Lony Auto-Recovery..."

# 1. Install PM2 if missing
if ! command -v pm2 &> /dev/null
then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# 2. Kill existing processes on port 3001
echo "🧹 Cleaning up port 3001..."
fuser -k 3001/tcp 2>/dev/null

# 3. Start the adapter with PM2
echo "⚙️ Starting Adapter..."
pm2 stop lony-adapter 2>/dev/null
pm2 delete lony-adapter 2>/dev/null
pm2 start api/whatsapp-server-simple.js --name "lony-adapter" --watch

# 4. Save PM2 list & setup startup
pm2 save
pm2 startup

echo "✅ DONE! Your server is now running on port 3001 and will auto-restart if it crashes."
echo "Check logs with: pm2 logs lony-adapter"
