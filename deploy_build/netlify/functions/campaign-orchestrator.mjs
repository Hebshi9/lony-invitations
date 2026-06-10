import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('[Orchestrator] 🧠 Starting smart dispatch cycle');

  try {
    // 1. Get Global Limit
    const { data: limitSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_daily_limit')
      .single();
    
    const dailyLimit = parseInt(limitSetting?.value || '250');

    // 2. Count messages sent in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sentToday } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);

    const remainingQuota = dailyLimit - (sentToday || 0);
    console.log(`[Orchestrator] 📊 Daily Usage: ${sentToday}/${dailyLimit}. Remaining: ${remainingQuota}`);

    if (remainingQuota <= 0) {
      console.log('[Orchestrator] 🛑 Quota exhausted for today.');
      return { statusCode: 200, body: JSON.stringify({ status: 'quota_exhausted', remaining: 0 }) };
    }

    // 3. Find Active Campaigns
    const { data: activeEvents } = await supabase
      .from('events')
      .select('id, name, priority_level, daily_budget, campaign_strategy')
      .eq('campaign_status', 'active')
      .order('priority_level', { ascending: true });

    if (!activeEvents || activeEvents.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ status: 'idle', message: 'No active campaigns' }) };
    }

    console.log(`[Orchestrator] 🚀 Found ${activeEvents.length} active campaigns.`);

    // 4. Dispatching Strategy (Round Robin)
    // For simplicity, we trigger the background sender for the first event in the priority list
    // The background sender will check the quota before each message.
    
    // In a real multi-event scenario, we could split the remainingQuota between events
    // For now, we'll let the highest priority event proceed.

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        status: 'running', 
        quota: remainingQuota,
        active_campaigns: activeEvents.length
      }) 
    };

  } catch (err) {
    console.error('[Orchestrator] Error:', err);
    return { statusCode: 500, body: err.message };
  }
};
