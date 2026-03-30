import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const ssh = new NodeSSH();

// Config
const SSH_HOST = '62.171.172.76';
const SSH_USER = 'root';
const SSH_PASS = 'AHMEDhebshi12';
const REMOTE_DIR = '/www/wwwroot/lony-sendingwa';
const ZIP_FILE = 'lony-sendingwa.zip';
const PM2_NAME = 'lony-sender';

async function deploy() {
    console.log('🚀 بدء عملية الرفع الآمنة لسيرفر لوني...');
    
    // 1. ضغط الملفات باستخدام مكتبة archiver
    console.log('📦 جاري ضغط الملفات...');
    try {
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(ZIP_FILE);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);

            // إضافة المجلدات والملفات المطلوبة
            if (fs.existsSync('api')) archive.directory('api/', 'api');
            if (fs.existsSync('src')) archive.directory('src/', 'src');
            if (fs.existsSync('package.json')) archive.file('package.json', { name: 'package.json' });
            if (fs.existsSync('.env')) archive.file('.env', { name: '.env' });

            archive.finalize();
        });
        console.log('✅ تم تجهيز ملف ZIP بنجاح.');
    } catch (e) {
        console.error('❌ خطأ في ضغط الملفات:', e.message);
        process.exit(1);
    }

    try {
        // 2. الاتصال
        console.log(`🌐 جاري الاتصال بالسيرفر (${SSH_HOST})...`);
        await ssh.connect({
            host: SSH_HOST,
            username: SSH_USER,
            password: SSH_PASS
        });
        console.log('✅ تم الاتصال بالسيرفر بنجاح.');

        // 3. رفع الملف
        console.log(`⬆️ جاري رفع الملف إلى ${REMOTE_DIR}...`);
        await ssh.putFile(ZIP_FILE, `${REMOTE_DIR}/${ZIP_FILE}`);
        console.log('✅ تم رفع الملف للسيرفر.');

        // 4. استخراج الملفات هناك
        console.log('📂 جاري فك الضغط في السيرفر...');
        await ssh.execCommand(`cd ${REMOTE_DIR} && unzip -o ${ZIP_FILE}`);
        console.log('✅ تم تحديث الملفات.');

        // 5. إعادة التشغيل باستخادم PM2 (عملية مستقلة)
        console.log(`🔄 تحديث عملية PM2 باسم [${PM2_NAME}]...`);
        const pm2Cmd = await ssh.execCommand(`cd ${REMOTE_DIR} && (pm2 restart ${PM2_NAME} || pm2 start api/whatsapp-server-simple.js --name ${PM2_NAME})`);
        console.log('PM2 Status:', pm2Cmd.stdout ? 'Success' : 'Check Logs');
        
        console.log('\n🎉 تم التحديث بنجاح! السيرفر يعمل الآن بآخر نسخة دون المساس بـ lony-bot.');

    } catch (error) {
        console.error('❌ حدث خطأ أثناء الاتصال أو الرفع:', error.message);
    } finally {
        ssh.dispose();
        if (fs.existsSync(ZIP_FILE)) {
            fs.unlinkSync(ZIP_FILE);
        }
        process.exit(0);
    }
}

deploy();
