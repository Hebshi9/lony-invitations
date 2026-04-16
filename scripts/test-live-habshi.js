const guestIds = [
    'de726e31-8fc2-44e5-9952-3f0cd6c6bdc9', // Ahmed Al-Habshi
    'f2d58cf7-2e81-4e37-9407-5e9804d6d6f9'  // Sarah Al-Jifri
];
const eventId = '17490649-b5cb-462b-9f09-6e0a252d4676'; // Habshi Event

console.log('🚀 Triggering Live Cloud Engine for Ahmed and Sarah (Habshi Event)...');

fetch('https://lonyinvite.netlify.app/api/send-campaign-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        guestIds: guestIds,
        eventId: eventId,
        campaignType: 'qr_code'
    })
})
.then(res => {
    console.log('✅ Cloud Engine Response Status:', res.status);
    console.log('⏳ Cloud engine is now working in the background. Please check the database for updates!');
})
.catch(err => console.error('❌ Error triggering cloud engine:', err));
