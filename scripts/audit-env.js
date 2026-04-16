import 'dotenv/config';

console.log('--- Environmental Audit ---');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('EVOLUTION_URL:', process.env.EVOLUTION_URL ? '✅ Loaded' : '❌ Missing');
console.log('EVOLUTION_API_KEY:', process.env.EVOLUTION_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('ADMIN_PHONE:', process.env.ADMIN_PHONE ? '✅ Loaded' : '❌ Missing');

if (process.env.EVOLUTION_API_KEY === '429683C4C977415CAAFCCE10F7D57E11' && process.env.OPENAI_API_KEY) {
    console.log('\n✨ Audit Result: Environment is ready for V2 transition.');
} else {
    console.log('\n⚠️ Audit Result: Some configurations are missing or incorrect.');
}
