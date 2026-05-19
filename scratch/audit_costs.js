const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditCosts() {
  console.log('--- LONY FINANCIAL AUDIT (COSTS) ---');
  
  const { data: entries, error } = await supabase
    .from('business_ledger')
    .select('*');

  if (error) {
    console.error('Error fetching ledger:', error);
    return;
  }

  // April 2026 filter
  const aprilEntries = entries.filter(e => {
    const d = e.order_date ? new Date(e.order_date) : new Date(e.created_at);
    return d.getMonth() === 3 && d.getFullYear() === 2026;
  });

  let totalDispatch = 0;
  let totalSupervisor = 0;
  let totalDesigner = 0;

  console.log(`Analyzing ${aprilEntries.length} entries for April...`);
  
  aprilEntries.forEach(e => {
    totalDispatch += Number(e.dispatch_cost) || 0;
    totalSupervisor += Number(e.supervisor_cost) || 0;
    totalDesigner += Number(e.designer_fee) || 0;
  });

  const { data: config } = await supabase
    .from('business_config')
    .select('*')
    .eq('key', 'monthly_marketing_budget')
    .maybeSingle();

  const marketingBudget = Number(config?.value?.amount) || 0;
  const total = totalDispatch + totalSupervisor + totalDesigner + marketingBudget;

  console.log(`1. Dispatch Costs (واتساب): ${totalDispatch} SAR`);
  console.log(`2. Supervisor Costs (مشرفين): ${totalSupervisor} SAR`);
  console.log(`3. Designer Fees (مصممات): ${totalDesigner} SAR`);
  console.log(`4. Marketing Budget (تسويق): ${marketingBudget} SAR`);
  console.log('------------------------------------');
  console.log(`TOTAL CALCULATED: ${total} SAR`);
  
  if (total === 4245) {
    console.log('✅ MATCH CONFIRMED: الحساب دقيق 100%');
  } else {
    console.log(`❌ MISMATCH: هناك فرق ${Math.abs(total - 4245)} ريال`);
  }
}

auditCosts();
