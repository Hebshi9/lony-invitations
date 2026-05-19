import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
    Wallet, TrendingUp, History, Receipt, ArrowUpRight, 
    ArrowDownRight, Landmark, Calendar, Search, Pencil, Check, X,
    Loader2, Filter, Target, PieChart, Activity, AlertTriangle, Briefcase,
    TrendingDown, BarChart3, Layers, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, BarChart, Bar, Legend, Cell,
    PieChart as RePieChart, Pie
} from 'recharts';

const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const FinancialHub: React.FC = () => {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'roi' | 'performance'>('overview');
    const [targets, setTargets] = useState({ monthly: 10000, yearly: 120000 });
    const [stats, setStats] = useState({
        totalRevenue: 0,
        cashCollected: 0,
        pendingDebts: 0,
        totalCosts: 0,
        totalProfit: 0,
        netMargin: 0,
        prevMonthGrowth: 0
    });
    const [serviceROI, setServiceROI] = useState<any[]>([]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settings, setSettings] = useState({
        monthly_target: 10000,
        monthly_marketing_budget: 2000
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [sourceROI, setSourceROI] = useState<any[]>([]);
    const [debtWatchlist, setDebtWatchlist] = useState<any[]>([]);
    const [cpaStats, setCpaStats] = useState({ socialOrderCount: 0, costPerAcquisition: 0 });
    const [viewDate, setViewDate] = useState(new Date());
    const [opsStats, setOpsStats] = useState({
        totalOrders: 0,
        completedOrders: 0,
        completionRate: 0,
        serviceDistribution: [] as any[],
        assigneeDistribution: [] as any[]
    });

    const now = new Date();
    const isPastMonth = viewDate.getFullYear() < now.getFullYear() || (viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() < now.getMonth());

    useEffect(() => {
        fetchExecutiveData();
    }, [viewDate]);

    const fetchExecutiveData = async () => {
        setLoading(true);
        try {
            // 0. Define current period variables early to avoid ReferenceErrors
            const currentMonth = viewDate.getMonth();
            const currentYear = viewDate.getFullYear();
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            // 1. Fetch Ledger Data
            const { data: ledgerData, error } = await supabase
                .from('business_ledger')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (error) throw error;
            setEntries(ledgerData || []);

            // 2. Fetch Financial Settings
            const targetKey = `monthly_target_${currentYear}_${currentMonth}`;
            const budgetKey = `monthly_budget_${currentYear}_${currentMonth}`;
            
            const { data: configData } = await supabase
                .from('business_config')
                .select('*')
                .in('key', [targetKey, budgetKey, 'monthly_target', 'monthly_marketing_budget']);
            
            let monthlyTarget = 10000;
            let monthlyMarketingBudget = 2000;

            if (configData && configData.length > 0) {
                const specificTarget = configData.find(c => c.key === targetKey);
                const globalTarget = configData.find(c => c.key === 'monthly_target');
                const specificBudget = configData.find(c => c.key === budgetKey);
                const globalBudget = configData.find(c => c.key === 'monthly_marketing_budget');

                monthlyTarget = Number(specificTarget?.value?.amount) || Number(globalTarget?.value?.amount) || 10000;
                monthlyMarketingBudget = Number(specificBudget?.value?.amount) || Number(globalBudget?.value?.amount) || 2000;
            }

            setSettings({ monthly_target: monthlyTarget, monthly_marketing_budget: monthlyMarketingBudget });
            setTargets({ monthly: monthlyTarget, yearly: monthlyTarget * 12 });

            // 3. Strategic Calculations
            let curRevenue = 0, curCash = 0, curCosts = 0, curDebts = 0;
            let lastRevenue = 0;
            let completedCount = 0;
            let totalInMonth = 0;

            const roiMap: Record<string, { revenue: number, costs: number }> = {};
            const serviceDistMap: Record<string, number> = {};
            const assigneeDistMap: Record<string, number> = {};

            const targetMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            const targetLastMonthStr = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}`;

            ledgerData?.forEach(e => {
                const dateRaw = e.order_date || e.created_at;
                if (!dateRaw) return;
                
                const entryMonthStr = dateRaw.substring(0, 7); // e.g., "2026-05"

                const price = Number(e.total_price) || 0;
                const deposit = Number(e.deposit_amount) || 0;
                const balance = Number(e.remaining_balance) || 0;
                const refund = Number(e.refund_amount) || 0;
                const costs = (Number(e.dispatch_cost) || 0) + (Number(e.supervisor_cost) || 0) + (Number(e.designer_fee) || 0);

                // Current Month Stats (String comparison is 100% safe)
                if (entryMonthStr === targetMonthStr) {
                    totalInMonth++;
                    if (e.order_status === 'تم التسليم النهائي' || e.order_status === 'مكتمل') completedCount++;

                    if (e.order_status === 'ملغي') {
                        curRevenue += Math.max(deposit - refund, 0);
                        curCash += Math.max(deposit - refund, 0);
                    } else {
                        curRevenue += price;
                        curCash += deposit;
                        curDebts += (balance > 0 ? balance : 0);
                    }
                    curCosts += costs;

                    // Ops Distribution
                    const sType = e.service_type || 'أخرى';
                    serviceDistMap[sType] = (serviceDistMap[sType] || 0) + 1;
                    const assign = e.assignee || 'غير محدد';
                    assigneeDistMap[assign] = (assigneeDistMap[assign] || 0) + 1;
                }

                // Last Month Stats
                if (entryMonthStr === targetLastMonthStr) {
                    lastRevenue += (e.order_status === 'ملغي' ? Math.max(deposit - refund, 0) : price);
                }

                // ROI grouping
                const service = e.service_type || 'أخرى';
                if (!roiMap[service]) roiMap[service] = { revenue: 0, costs: 0 };
                roiMap[service].revenue += (e.order_status === 'ملغي' ? Math.max(deposit - refund, 0) : price);
                roiMap[service].costs += costs;

                // Lead Source grouping and Debt Watchlist collection
                const oDate = e.order_date ? new Date(e.order_date) : (e.created_at ? new Date(e.created_at) : null);
                if (oDate && oDate.getMonth() === currentMonth && oDate.getFullYear() === currentYear) {
                    if (Number(e.remaining_balance) > 0 && e.order_status !== 'ملغي' && e.order_status !== 'تم التسليم النهائي') {
                        // Note: setDebtWatchlist is also called after the loop with a filtered list, 
                        // so this might be redundant but fixing the crash regardless.
                    }
                }
            });

            // Clear and rebuild debt watchlist to avoid duplicates
            const currentDebtors = ledgerData?.filter(e => {
                const orderDate = e.order_date ? new Date(e.order_date) : (e.created_at ? new Date(e.created_at) : null);
                if (!orderDate) return false;
                return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear && 
                       Number(e.remaining_balance) > 0 && e.order_status !== 'ملغي' && e.order_status !== 'تم التسليم النهائي';
            }).sort((a, b) => {
                const dateA = a.expected_delivery_date ? new Date(a.expected_delivery_date).getTime() : 0;
                const dateB = b.expected_delivery_date ? new Date(b.expected_delivery_date).getTime() : 0;
                return dateA - dateB;
            });
            setDebtWatchlist(currentDebtors || []);

            // --- Advanced CPA & Marketing Distribution Logic ---
            const socialSources = ['انستقرام', 'تيك توك', 'سناب شات', 'سناب', 'Instagram', 'TikTok', 'Snapchat', 'X', 'تويتر'];
            const activeSocialOrders = ledgerData?.filter(e => 
                socialSources.includes(e.lead_source) && 
                e.order_status !== 'ملغي' &&
                (e.order_date ? new Date(e.order_date).getMonth() === currentMonth : (e.created_at ? new Date(e.created_at).getMonth() === currentMonth : false))
            ) || [];

            const socialCount = activeSocialOrders.length;
            const marketingPerOrder = socialCount > 0 ? monthlyMarketingBudget / socialCount : 0;
            setCpaStats({ socialOrderCount: socialCount, costPerAcquisition: marketingPerOrder });

            // Lead Source Analytics with CPA Integration
            const sourceMap: Record<string, { revenue: number, profit: number }> = {};
            ledgerData?.forEach(e => {
                const orderDate = e.order_date ? new Date(e.order_date) : (e.created_at ? new Date(e.created_at) : null);
                if (!orderDate || orderDate.getMonth() !== currentMonth || orderDate.getFullYear() !== currentYear) return;
                
                const source = e.lead_source || 'غير محدد';
                const rev = e.order_status === 'ملغي' ? Math.max(Number(e.deposit_amount) - Number(e.refund_amount), 0) : Number(e.total_price);
                const costs = (Number(e.dispatch_cost) || 0) + (Number(e.supervisor_cost) || 0) + (Number(e.designer_fee) || 0);
                
                // If it's a social source, add the distributed marketing cost
                const distributedMarketing = socialSources.includes(source) && e.order_status !== 'ملغي' ? marketingPerOrder : 0;
                
                if (!sourceMap[source]) sourceMap[source] = { revenue: 0, profit: 0 };
                sourceMap[source].revenue += rev;
                sourceMap[source].profit += (rev - costs - distributedMarketing);
            });

            setSourceROI(Object.entries(sourceMap).map(([name, data]) => ({
                name,
                value: data.profit,
                revenue: data.revenue
            })));

            const totalProfit = curRevenue - curCosts - monthlyMarketingBudget;
            const growth = lastRevenue > 0 ? ((curRevenue - lastRevenue) / lastRevenue) * 100 : 0;

            setTargets({ monthly: monthlyTarget, yearly: monthlyTarget * 12 });
            
            setStats(prev => ({
                ...prev,
                totalRevenue: curRevenue,
                cashCollected: curCash,
                pendingDebts: curDebts,
                totalCosts: curCosts + monthlyMarketingBudget,
                totalProfit: totalProfit,
                netMargin: curRevenue > 0 ? (totalProfit / curRevenue) * 100 : 0,
                prevMonthGrowth: growth
            }));

            // Format ROI Data
            const roiData = Object.entries(roiMap).map(([name, data]) => ({
                name,
                revenue: data.revenue,
                costs: data.costs,
                profit: data.revenue - data.costs,
                margin: data.revenue > 0 ? ((data.revenue - data.costs) / data.revenue) * 100 : 0
            })).sort((a, b) => b.profit - a.profit);

            setServiceROI(roiData);

            setOpsStats({
                totalOrders: totalInMonth,
                completedOrders: completedCount,
                completionRate: totalInMonth > 0 ? (completedCount / totalInMonth) * 100 : 0,
                serviceDistribution: Object.entries(serviceDistMap).map(([name, value]) => ({ name, value })),
                assigneeDistribution: Object.entries(assigneeDistMap).map(([name, value]) => ({ name, value }))
            });

            console.log('--- Financial Intelligence Report ---');
            console.log('Selected Period:', currentYear, currentMonth + 1);
            console.log('Total Ledger Entries:', ledgerData?.length);
            console.log('Matched Entries for Period:', totalInMonth);
            console.log('Revenue:', curRevenue, 'Cash:', curCash);
            console.log('Target:', monthlyTarget);

            // @ts-ignore
            window.LONY_DEBUG = {
                ledgerData,
                totalInMonth,
                curRevenue,
                currentMonth,
                currentYear,
                sampleDate: ledgerData?.[0]?.order_date || ledgerData?.[0]?.created_at
            };

        } catch (error) {
            console.error('Executive Hub Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const monthlyProgress = (stats.totalRevenue / targets.monthly) * 100;
    
    // Daily Pace Logic
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const dailyTarget = targets.monthly / daysInMonth;
    const isCurrentMonth = viewDate.getMonth() === new Date().getMonth() && viewDate.getFullYear() === new Date().getFullYear();
    const currentDay = isCurrentMonth ? new Date().getDate() : daysInMonth;
    const expectedRevenueByNow = dailyTarget * currentDay;
    const paceStatus = stats.totalRevenue >= expectedRevenueByNow ? 'ahead' : 'behind';

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 font-kufi">
            <Loader2 className="w-12 h-12 text-lony-gold animate-spin" />
            <p className="text-lony-navy font-bold animate-pulse text-lg">جاري استخراج الرؤى الاستراتيجية...</p>
        </div>
    );

    return (
        <div className="space-y-6 font-kufi pb-20" dir="rtl">
            {/* Elite Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-lony-navy font-amiri">الذكاء المالي (Financial Intelligence)</h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isCurrentMonth ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> مباشر الآن
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold flex items-center gap-1">
                                <History size={10} /> مراجعة تاريخية
                            </span>
                        )}
                        <p className="text-slate-400 text-xs">تحليل فوري للأداء الاستراتيجي ونسب النمو</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <select 
                            className="bg-transparent border-none text-[10px] font-black outline-none cursor-pointer p-1"
                            value={viewDate.getMonth()}
                            onChange={(e) => {
                                const m = parseInt(e.target.value);
                                const newDate = new Date(viewDate.getFullYear(), m, 1);
                                console.log('Month Changed to:', m, newDate);
                                setViewDate(newDate);
                            }}
                        >
                            {MONTH_NAMES.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select 
                            className="bg-transparent border-none text-[10px] font-black outline-none cursor-pointer p-1"
                            value={viewDate.getFullYear()}
                            onChange={(e) => {
                                const y = parseInt(e.target.value);
                                const newDate = new Date(y, viewDate.getMonth(), 1);
                                setViewDate(newDate);
                            }}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <Button 
                        onClick={() => setShowSettingsModal(true)}
                        variant="outline"
                        className="flex-1 md:flex-none border-slate-200 text-slate-600 rounded-xl px-4 py-2 hover:bg-slate-50 transition-all text-xs"
                    >
                        <Pencil className="w-4 h-4 ml-2" /> الإعدادات المالية
                    </Button>
                </div>
            </div>

            {/* Strategy Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl w-fit overflow-x-auto no-scrollbar">
                <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Layers size={16}/>} label="نظرة عامة" />
                <TabButton active={activeTab === 'cashflow'} onClick={() => setActiveTab('cashflow')} icon={<Wallet size={16}/>} label="التدفق النقدي" />
                <TabButton active={activeTab === 'roi'} onClick={() => setActiveTab('roi')} icon={<PieChart size={16}/>} label="ربحية الخدمات والمصادر" />
                <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} icon={<Activity size={16}/>} label="قائمة الديون والنمو" />
                <TabButton active={activeTab === 'operational' as any} onClick={() => setActiveTab('operational' as any)} icon={<Activity size={16}/>} label="الأداء التشغيلي" />
            </div>

            {/* Content Rendering */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Primary Target Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 bg-gradient-to-br from-lony-navy to-slate-900 text-white rounded-[2rem] overflow-hidden relative shadow-xl border-none">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-lony-gold/10 rounded-full blur-3xl"></div>
                            <CardContent className="p-8 relative z-10">
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    <div className="flex-grow space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-lony-gold/20 rounded-lg"><Target className="w-4 h-4 text-lony-gold"/></div>
                                            <span className="text-lony-gold font-bold text-xs uppercase tracking-widest">المستهدف الشهري الحالي</span>
                                        </div>
                                        <h2 className="text-5xl font-black">{stats.totalRevenue.toLocaleString()} <span className="text-xl font-bold opacity-30">/ {targets.monthly.toLocaleString()} SAR</span></h2>
                                        <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden mt-4">
                                            <div 
                                                className="h-full bg-gradient-to-l from-lony-gold to-yellow-500 transition-all duration-1000"
                                                style={{ width: `${Math.min(monthlyProgress, 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="flex items-center gap-1.5 font-bold text-white/60">
                                                {stats.prevMonthGrowth >= 0 ? <ArrowUpRight className="text-emerald-400 w-4 h-4"/> : <TrendingDown className="text-rose-400 w-4 h-4"/>}
                                                نمو {Math.abs(stats.prevMonthGrowth).toFixed(1)}% عن الشهر الماضي
                                            </div>
                                            <span className="font-bold text-lony-gold">{Math.round(monthlyProgress)}% من الهدف</span>
                                        </div>
                                    </div>
                                    <div className="hidden md:block w-32 h-32 flex-shrink-0 relative">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="64" cy="64" r="58" className="stroke-white/5 fill-none" strokeWidth="8" />
                                            <circle 
                                                cx="64" cy="64" r="58" 
                                                className="stroke-lony-gold fill-none transition-all duration-1000" 
                                                strokeWidth="8" 
                                                strokeDasharray={`${(monthlyProgress / 100) * 364} 364`}
                                            />
                                        </svg>
                                        <span className="absolute inset-0 flex items-center justify-center text-xl font-black">{Math.round(monthlyProgress)}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-6">
                            <StatCard title="صافي الربح الفعلي" value={stats.totalProfit} suffix="SAR" icon={<Zap className="text-emerald-500"/>} bg="bg-emerald-50" color="text-emerald-700" />
                            <StatCard title="إجمالي التكاليف" value={stats.totalCosts} suffix="SAR" icon={<TrendingDown className="text-rose-500"/>} bg="bg-rose-50" color="text-rose-700" />
                        </div>
                    </div>

                    {/* Quick KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <KPIBox title="الكاش المستلم" value={stats.cashCollected} color="text-emerald-600" />
                        <KPIBox title="المبيعات المعلقة" value={stats.pendingDebts} color="text-amber-600" />
                        <KPIBox title="هامش الربح" value={stats.netMargin.toFixed(1)} suffix="%" color="text-lony-navy" />
                        <KPIBox title="أداء المستهدف" value={monthlyProgress.toFixed(1)} suffix="%" color="text-lony-gold" />
                        <KPIBox 
                            title="المعدل اليومي" 
                            value={dailyTarget.toFixed(0)} 
                            suffix=" SAR" 
                            color="text-slate-600" 
                            subText={`المسار: ${paceStatus === 'ahead' ? 'متفوق ✅' : 'متأخر ⚠️'}`}
                        />
                    </div>

                    {/* Chart Overview */}
                    <Card className="bg-white border-none rounded-[2rem] shadow-sm p-6">
                        <CardHeader className="flex flex-row items-center justify-between px-0 pt-0">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-lony-gold" /> نبض المبيعات (شهري)
                            </CardTitle>
                        </CardHeader>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={entries.reduce((acc: any[], curr) => {
                                    const month = new Date(curr.created_at).toLocaleString('ar-SA', { month: 'short' });
                                    const existing = acc.find(a => a.name === month);
                                    if (existing) existing.val += Number(curr.total_price) || 0;
                                    else acc.push({ name: month, val: Number(curr.total_price) || 0 });
                                    return acc;
                                }, [])}>
                                    <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" dataKey="val" name="المبيعات" stroke="#D4AF37" strokeWidth={3} fill="url(#colorVal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'cashflow' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <Card className="rounded-3xl p-6 bg-white border-none shadow-sm">
                        <CardHeader className="px-0 pt-0">
                            <CardTitle className="text-lg font-black flex items-center gap-2">
                                <Wallet className="text-emerald-500" /> تحليل التدفق النقدي (Cash Flow)
                            </CardTitle>
                            <p className="text-xs text-slate-400">مقارنة بين المبيعات الورقية والكاش المحصل فعلياً</p>
                        </CardHeader>
                        <div className="h-80 w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'المبيعات الكلية', val: stats.totalRevenue, fill: '#0A192F' },
                                    { name: 'الكاش المستلم', val: stats.cashCollected, fill: '#10b981' },
                                    { name: 'الديون المعلقة', val: stats.pendingDebts, fill: '#f59e0b' }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Bar dataKey="val" radius={[10, 10, 0, 0]} barSize={60}>
                                        { [0,1,2].map((entry, index) => <Cell key={index} fill={index === 0 ? '#0A192F' : index === 1 ? '#10b981' : '#f59e0b'} /> ) }
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <div className="space-y-6">
                        <Card className="rounded-3xl p-6 bg-amber-50 border-amber-100 border text-amber-900">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-200 rounded-2xl"><AlertTriangle size={24}/></div>
                                <div>
                                    <h4 className="font-black">فجوة التحصيل (Collection Gap)</h4>
                                    <p className="text-sm opacity-80">يوجد مبلغ {(stats.totalRevenue - stats.cashCollected).toLocaleString()} SAR مبيعات لم يتم استلام كاشها بعد.</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="rounded-3xl p-6 bg-white border-none shadow-sm">
                            <h4 className="font-bold mb-4">توصية استراتيجية</h4>
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                                    <p className="text-xs text-slate-600 leading-relaxed">نسبة التحصيل لديكِ هي {((stats.cashCollected / stats.totalRevenue) * 100).toFixed(1)}%. يفضل تكثيف المطالبة المالية للعقود المنتهية.</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5"></div>
                                    <p className="text-xs text-slate-600 leading-relaxed">صافي الربح المتوفر في "الخزنة" حالياً بعد خصم التكاليف هو {(stats.cashCollected - stats.totalCosts).toLocaleString()} SAR.</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'roi' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {serviceROI.map((roi, idx) => (
                            <Card key={idx} className="p-5 rounded-3xl bg-white border-none shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{roi.name}</div>
                                    <div className="text-lg font-black text-lony-navy">{roi.profit.toLocaleString()} <span className="text-xs">ربح صافي</span></div>
                                </div>
                                <div className="mt-4 flex items-center justify-between border-t pt-3 border-slate-50">
                                    <div className="text-[10px] font-bold text-emerald-600">هامش {roi.margin.toFixed(1)}%</div>
                                    <div className="text-[10px] font-bold text-slate-400">Revenue: {roi.revenue.toLocaleString()}</div>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <PieChart className="text-lony-gold" /> أرباح مصادر العملاء (ROI)
                                </CardTitle>
                            </CardHeader>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={sourceROI}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {sourceROI.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#0A192F', '#D4AF37', '#10b981', '#f59e0b', '#6366f1'][index % 5]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <BarChart3 className="text-lony-navy" /> ربحية أنواع الخدمات
                                </CardTitle>
                            </CardHeader>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={serviceROI} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f8fafc" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip />
                                        <Bar dataKey="profit" name="صافي الربح" fill="#D4AF37" radius={[0, 10, 10, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'performance' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <Card className="rounded-[2.5rem] bg-white border-none shadow-sm overflow-hidden">
                        <div className="bg-lony-navy p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <AlertTriangle className="text-lony-gold" /> قائمة مراقبة الديون (Debt Watchlist)
                                </h3>
                                <p className="text-xs text-white/50 mt-1">العملاء المتبقي عليهم مبالغ مالية لشهر {MONTH_NAMES[viewDate.getMonth()]}</p>
                            </div>
                            <div className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold">
                                إجمالي الديون: {stats.pendingDebts.toLocaleString()} SAR
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="p-4 text-xs font-black text-slate-400">العميلة</th>
                                        <th className="p-4 text-xs font-black text-slate-400">الخدمة</th>
                                        <th className="p-4 text-xs font-black text-slate-400">تاريخ المناسبة</th>
                                        <th className="p-4 text-xs font-black text-slate-400 text-left">المبلغ المتبقي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {debtWatchlist.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center text-slate-400 italic">لا توجد مديونيات حالية لهذا الشهر. كفو! 🎉</td>
                                        </tr>
                                    ) : debtWatchlist.map((debt, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-lony-navy">{debt.client_name}</div>
                                                <div className="text-[10px] text-slate-400" dir="ltr">{debt.client_phone}</div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600">{debt.service_type}</td>
                                            <td className="p-4 text-xs font-bold text-slate-600">
                                                {debt.expected_delivery_date || 'غير محدد'}
                                            </td>
                                            <td className="p-4 text-left font-black text-rose-600">
                                                {debt.remaining_balance.toLocaleString()} SAR
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6 rounded-3xl bg-emerald-50 border-emerald-100 border text-emerald-900">
                            <h4 className="font-black mb-2 flex items-center gap-2">
                                <TrendingUp size={18} /> مؤشر نمو الأرباح
                            </h4>
                            <p className="text-xs opacity-80 leading-relaxed mb-4">
                                بناءً على تحليل الشهور السابقة، نمو أرباحك الصافية يسير بمعدل استراتيجي ممتاز. كل ريال تصرفينه في التسويق يعود عليك بربح صافي قدره {((stats.totalProfit / (settings.monthly_marketing_budget || 1))).toFixed(2)} ريال.
                            </p>
                            <div className="text-3xl font-black">+{stats.prevMonthGrowth.toFixed(1)}% <span className="text-xs font-bold opacity-60 text-emerald-600">شهرياً</span></div>
                        </Card>
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm flex flex-col justify-center items-center text-center">
                            <Activity size={40} className="text-lony-gold mb-3" />
                            <h4 className="font-black">الكفاءة التشغيلية</h4>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                                تم استرداد {((stats.cashCollected / stats.totalRevenue) * 100).toFixed(0)}% من إجمالي المبيعات كاش فعلي.
                            </p>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'operational' as any && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">إجمالي الطلبات المستلمة</h4>
                                <div className="text-4xl font-black text-lony-navy">{opsStats.totalOrders} <span className="text-sm font-bold opacity-30">طلب</span></div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-slate-500">
                                <History size={14} /> تم تسجيلها في {viewDate.toLocaleString('ar-SA', { month: 'long' })}
                            </div>
                        </Card>
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">نسبة الإنجاز الفعلي</h4>
                                <div className="text-4xl font-black text-emerald-600">{opsStats.completionRate.toFixed(0)}%</div>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${opsStats.completionRate}%` }}></div>
                            </div>
                        </Card>
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">متوسط حجم الطلب</h4>
                                <div className="text-4xl font-black text-indigo-600">
                                    {(opsStats.totalOrders > 0 ? stats.totalRevenue / opsStats.totalOrders : 0).toFixed(0)} <span className="text-sm font-bold opacity-30">SAR</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 text-center">
                                قيمة المبيعات مقسومة على عدد الطلبات
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-sm font-black flex items-center gap-2">
                                    <PieChart size={16} className="text-lony-gold" /> توزيع الخدمات حسب الحجم
                                </CardTitle>
                            </CardHeader>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={opsStats.serviceDistribution} layout="vertical" margin={{ left: 40 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                        <Tooltip />
                                        <Bar dataKey="value" name="عدد الطلبات" fill="#0A192F" radius={[0, 10, 10, 0]} barSize={15} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                        <Card className="p-6 rounded-3xl bg-white border-none shadow-sm">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-sm font-black flex items-center gap-2">
                                    <Users size={16} className="text-lony-navy" /> إنتاجية فريق العمل
                                </CardTitle>
                            </CardHeader>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={opsStats.assigneeDistribution} layout="vertical" margin={{ left: 40 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                        <Tooltip />
                                        <Bar dataKey="value" name="عدد الطلبات" fill="#D4AF37" radius={[0, 10, 10, 0]} barSize={15} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
            {showSettingsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-lony-navy">الإعدادات المالية</h3>
                            <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    المستهدف الشهري (SAR) {isPastMonth && <AlertTriangle size={12} className="text-amber-500" />}
                                </label>
                                <input 
                                    type="number" 
                                    className={`w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-lg ${isPastMonth ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                    value={settings.monthly_target} 
                                    onChange={(e) => setSettings({...settings, monthly_target: Number(e.target.value)})} 
                                    disabled={isPastMonth}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    ميزانية التسويق (SAR) {isPastMonth && <AlertTriangle size={12} className="text-amber-500" />}
                                </label>
                                <input 
                                    type="number" 
                                    className={`w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-lg ${isPastMonth ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                    value={settings.monthly_marketing_budget} 
                                    onChange={(e) => setSettings({...settings, monthly_marketing_budget: Number(e.target.value)})} 
                                    disabled={isPastMonth}
                                />
                            </div>
                            {isPastMonth ? (
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0" />
                                    <p className="text-[10px] text-amber-800 leading-relaxed font-bold">
                                        لا يمكن تعديل مستهدفات الشهور الماضية لضمان دقة التقارير التاريخية. إذا كنت بحاجة لتعديلها يرجى التواصل مع الدعم الفني.
                                    </p>
                                </div>
                            ) : (
                                <Button 
                                    onClick={async () => {
                                        setIsSavingSettings(true);
                                        try {
                                            const currentMonth = viewDate.getMonth();
                                            const currentYear = viewDate.getFullYear();
                                            const targetKey = `monthly_target_${currentYear}_${currentMonth}`;
                                            const budgetKey = `monthly_budget_${currentYear}_${currentMonth}`;

                                            await supabase.from('business_config').upsert({ key: targetKey, value: { amount: settings.monthly_target, currency: 'SAR' }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                                            await supabase.from('business_config').upsert({ key: budgetKey, value: { amount: settings.monthly_marketing_budget, currency: 'SAR' }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                                            
                                            // Also update globals for new months
                                            await supabase.from('business_config').upsert({ key: 'monthly_target', value: { amount: settings.monthly_target, currency: 'SAR' }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                                            
                                            await fetchExecutiveData();
                                            setShowSettingsModal(false);
                                            alert('✅ تم حفظ الإعدادات بنجاح!');
                                        } catch (e) { 
                                            console.error(e);
                                            alert('❌ خطأ في الحفظ'); 
                                        } finally { setIsSavingSettings(false); }
                                    }}
                                    disabled={isSavingSettings}
                                    className="w-full bg-lony-navy text-white py-4 rounded-2xl font-black"
                                >
                                    {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'حفظ الإعدادات'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Data Tracer (Emergency Debug) */}
            <div className="mt-10 p-6 bg-slate-900 rounded-[2rem] text-white overflow-hidden shadow-2xl border border-white/10 animate-pulse">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/60">Data Tracer (Raw DB View)</h4>
                </div>
                <div className="space-y-3">
                    {entries.length === 0 ? (
                        <p className="text-xs text-rose-400 font-bold">⚠️ لم يتم سحب أي بيانات من قاعدة البيانات إطلاقاً! (Check Supabase Connection)</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {entries.slice(0, 6).map((e, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                                    <div>
                                        <div className="text-[10px] font-bold text-white/40">{e.client_name}</div>
                                        <div className="text-xs font-black text-lony-gold">
                                            {(e.order_date || e.created_at)?.substring(0, 7)}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-white/30 font-mono">
                                        ID: {e.id?.slice(0, 5)}...
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="pt-4 border-t border-white/10 flex justify-between text-[10px] font-bold text-white/40">
                        <span>Total Records Fetched: {entries.length}</span>
                        <span>Current Filter: {currentYear}-{currentMonth + 1}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${active ? 'bg-white text-lony-navy shadow-sm scale-105' : 'text-slate-500 hover:text-slate-700'}`}
    >
        {icon} {label}
    </button>
);

const StatCard = ({ title, value, suffix, icon, bg, color }: any) => (
    <Card className={`${bg} border-none rounded-[1.5rem] p-5 shadow-sm`}>
        <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
            <div className="p-2 bg-white/50 rounded-xl">{icon}</div>
        </div>
        <div className={`mt-2 text-2xl font-black ${color}`}>{value.toLocaleString()} <span className="text-xs font-bold opacity-60">{suffix}</span></div>
    </Card>
);

const KPIBox = ({ title, value, suffix = '', color, subText }: any) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
        <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{title}</div>
            <div className={`text-lg font-black ${color}`}>{value.toLocaleString()}{suffix}</div>
        </div>
        {subText && <div className="text-[9px] text-slate-400 mt-1 font-bold">{subText}</div>}
    </div>
);

export default FinancialHub;
