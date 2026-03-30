import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function createBucket() {
    console.log('Checking existing buckets...');
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Existing buckets:', buckets?.map(b => b.name).join(', ') || 'none');

    const bucketName = 'global-invitations';
    if (buckets?.some(b => b.name === bucketName)) {
        console.log(`Bucket "${bucketName}" already exists!`);
        return;
    }

    const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    });

    if (error) {
        console.error('Error:', error.message);
        console.log('Please create it manually in Supabase Dashboard -> Storage -> New Bucket -> "global-invitations" (public)');
    } else {
        console.log(`Bucket "${bucketName}" created!`);
    }
}

createBucket().catch(console.error);
