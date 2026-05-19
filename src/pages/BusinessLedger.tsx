import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Plus, Filter, Download, MoreVertical, 
    Trash2, Edit, User, Phone, Calendar, Clock, 
    CheckCircle, XCircle, AlertTriangle, ExternalLink,
    Briefcase, Activity, Wallet, MessageCircle, Send, Loader2, Layers, Users, Settings, Copy, Palette
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

const BusinessLedger: React.FC = () => {
    const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('الكل');
    const [filterSource, setFilterSource] = useState('الكل');
    const [filterService, setFilterService] = useState('الكل');
    const [filterPeriod, setFilterPeriod] = useState('الكل');
    const [filterAssignee, setFilterAssignee] = useState('الكل');
    const [isSendingReminder, setIsSendingReminder] = useState<string | null>(null);

    // Form state for Modal
    const [showModal, setShowModal] = useState(false);
    const [showInspection, setShowInspection] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    const [editMode, setEditMode] = useState(false);
    const [currentEditId, setCurrentEditId] = useState<string | null>(null);
    const [manualEntry, setManualEntry] = useState({
        order_date: new Date().toISOString().split('T')[0],
        client_name: '',
        client_phone: '',
        service_type: 'تصميم دعوة',
        total_amount: '',
        paid_amount: '',
        bank_account: 'الراجحي',
        order_status: 'قيد استلام الطلب',
        lead_source: 'مباشر',
        event_date: '',
        start_sending_date: '',
        target_delivery_date: '',
        has_design: false,
        has_whatsapp: false,
        has_supervision: false,
        barcode_type: 'none', // none, numbered, named
        notes: '',
        priority: 'عادية',
        assignee: '',
        guest_count: '',
        designer_fee: '',
        dispatch_cost: '',
        supervisor_cost: '',
        supervisor_count: '',
        marketing_cost: '',
        supervisor_lead_name: '',
        supervisor_lead_phone: '',
        supervisor_status: 'pending' // pending, confirmed
    });

    // Auto-calculate SLA based on service & barcode type
    useEffect(() => {
        if (!manualEntry.has_design && !manualEntry.has_whatsapp && !manualEntry.has_supervision) return;
        
        let daysToAdd = 1; // Default 24h
        if (manualEntry.has_design) {
            if (manualEntry.barcode_type === 'numbered') daysToAdd = 2;
            else if (manualEntry.barcode_type === 'named') daysToAdd = 3;
        }

        const date = new Date();
        date.setDate(date.getDate() + daysToAdd);
        const dateStr = date.toISOString().split('T')[0];
        
        setManualEntry(prev => ({ ...prev, target_delivery_date: dateStr }));
    }, [manualEntry.has_design, manualEntry.barcode_type]);

    const [sortBy, setSortBy] = useState('الأحدث');

    useEffect(() => {
        fetchLedger();
    }, []);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('business_ledger')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLedgerEntries(data || []);
        } catch (error: any) {
            console.error('Error fetching ledger:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = async () => {
        if (!manualEntry.client_name || !manualEntry.total_amount) {
            alert('يرجى إدخال اسم العميل والمبلغ الإجمالي');
            return;
        }

        try {
            const total = parseFloat(manualEntry.total_amount);
            const paid = parseFloat(manualEntry.paid_amount || '0');
            
            // Construct dynamic service type string
            const services = [];
            if (manualEntry.has_design) services.push('تصميم' + (manualEntry.barcode_type !== 'none' ? ` (${manualEntry.barcode_type === 'numbered' ? 'مرقم' : 'أسامي'})` : ''));
            if (manualEntry.has_whatsapp) services.push('إرسال واتساب');
            if (manualEntry.has_supervision) services.push('إشراف ميداني');
            
            const dbPayload = {
                client_name: manualEntry.client_name,
                client_phone: manualEntry.client_phone,
                service_type: services.join(' + ') || 'أخرى',
                total_price: total,
                deposit_amount: paid,
                remaining_balance: total - paid,
                bank_account: manualEntry.bank_account,
                order_status: manualEntry.order_status,
                lead_source: manualEntry.lead_source,
                event_date: manualEntry.event_date || null,
                expected_delivery_date: manualEntry.target_delivery_date || manualEntry.start_sending_date || null,
                notes: manualEntry.notes,
                priority: manualEntry.priority || 'عادية',
                assignee: manualEntry.assignee || '',
                guest_count: manualEntry.guest_count ? parseInt(manualEntry.guest_count) : null,
                designer_fee: manualEntry.designer_fee ? parseFloat(manualEntry.designer_fee) : 0,
                dispatch_cost: manualEntry.dispatch_cost ? parseFloat(manualEntry.dispatch_cost) : 0,
                supervisor_cost: manualEntry.supervisor_cost ? parseFloat(manualEntry.supervisor_cost) : 0,
                supervisor_count: manualEntry.supervisor_count ? parseInt(manualEntry.supervisor_count) : 0,
                marketing_cost: manualEntry.marketing_cost ? parseFloat(manualEntry.marketing_cost) : 0,
                supervisor_lead_name: manualEntry.supervisor_lead_name,
                supervisor_lead_phone: manualEntry.supervisor_lead_phone,
                supervisor_status: manualEntry.supervisor_status
            };

            if (editMode && currentEditId) {
                const { error } = await supabase
                    .from('business_ledger')
                    .update({
                        ...dbPayload,
                        order_date: manualEntry.order_date // Use manual date
                    })
                    .eq('id', currentEditId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('business_ledger')
                    .insert([{
                        ...dbPayload,
                        order_date: manualEntry.order_date || new Date().toISOString()
                    }]);

                if (error) throw error;
            }
            
            closeModal();
            fetchLedger();
        } catch (error: any) {
            alert('فشل حفظ القيد: ' + error.message);
        }
    };

    const openEditModal = (entry: any) => {
        setManualEntry({
            client_name: entry.client_name || '',
            client_phone: entry.client_phone || '',
            service_type: entry.service_type || 'تصميم دعوة',
            total_amount: entry.total_price?.toString() || '',
            paid_amount: entry.deposit_amount?.toString() || '',
            bank_account: entry.bank_account || 'الراجحي',
            order_status: entry.order_status || 'قيد المعالجة',
            lead_source: entry.lead_source || 'مباشر',
            event_date: entry.event_date || '',
            start_sending_date: entry.expected_delivery_date || '',
            notes: entry.notes || '',
            priority: entry.priority || 'عادية',
            assignee: entry.assignee || '',
            guest_count: entry.guest_count?.toString() || '',
            designer_fee: entry.designer_fee?.toString() || '',
            dispatch_cost: entry.dispatch_cost?.toString() || '',
            supervisor_cost: entry.supervisor_cost?.toString() || '',
            supervisor_count: entry.supervisor_count?.toString() || '',
            marketing_cost: entry.marketing_cost?.toString() || '',
            has_design: entry.service_type?.includes('تصميم') || false,
            has_whatsapp: entry.service_type?.includes('إرسال') || false,
            has_supervision: entry.service_type?.includes('إشراف') || false,
            barcode_type: entry.service_type?.includes('مرقم') ? 'numbered' : (entry.service_type?.includes('أسامي') ? 'named' : 'none'),
            target_delivery_date: entry.expected_delivery_date || '',
            supervisor_lead_name: entry.supervisor_lead_name || '',
            supervisor_lead_phone: entry.supervisor_lead_phone || '',
            supervisor_status: entry.supervisor_status || 'pending',
            order_date: entry.order_date ? new Date(entry.order_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setEditMode(true);
        setCurrentEditId(entry.id);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditMode(false);
        setCurrentEditId(null);
        setManualEntry({
            client_name: '', client_phone: '', service_type: 'تصميم دعوة',
            total_amount: '', paid_amount: '', bank_account: 'الراجحي',
            order_status: 'قيد استلام الطلب', lead_source: 'مباشر',
            event_date: '', start_sending_date: '', target_delivery_date: '',
            has_design: false, has_whatsapp: false, has_supervision: false, barcode_type: 'none',
            notes: '',
            priority: 'عادية', assignee: '', guest_count: '',
            designer_fee: '', dispatch_cost: '', supervisor_cost: '', supervisor_count: '', marketing_cost: '',
            supervisor_lead_name: '', supervisor_lead_phone: '', supervisor_status: 'pending',
            order_date: new Date().toISOString().split('T')[0]
        });
    };

    const openInspection = (entry: any) => {
        setSelectedEntry(entry);
        setShowInspection(true);
    };

    const handleNoteUpdate = async (id: string, currentNotes: string) => {
        const timestamp = new Date().toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' });
        const newUpdate = prompt('أضف تحديثاً جديداً للطلب:', '');
        
        if (!newUpdate) return;
        
        const updatedNotes = currentNotes 
            ? `${currentNotes}\n[${timestamp}] ${newUpdate}`
            : `[${timestamp}] ${newUpdate}`;

        try {
            const { error } = await supabase
                .from('business_ledger')
                .update({ notes: updatedNotes })
                .eq('id', id);

            if (error) throw error;
            fetchLedger();
        } catch (e: any) {
            alert('فشل تحديث الملاحظة: ' + e.message);
        }
    };

    const handleCopyLink = (entry: any) => {
        const url = `${window.location.origin}/client-dashboard/${entry.id}`;
        navigator.clipboard.writeText(url);
        alert(`✅ تم نسخ الرابط بنجاح!\nالعميلة: ${entry.client_name}`);
    };

    const handleDeleteEntry = async (id: string, name: string) => {
        if (!window.confirm(`هل أنت متأكد من حذف قيد العميل: "${name}"؟`)) return;
        try {
            const { error } = await supabase.from('business_ledger').delete().eq('id', id);
            if (error) throw error;
            fetchLedger();
        } catch (error: any) {
            alert('فشل الحذف: ' + error.message);
        }
    };

    const filteredLedger = useMemo(() => {
        let result = ledgerEntries.filter(entry => {
            const matchesSearch = 
                entry.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.client_phone?.includes(searchTerm) ||
                entry.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.order_number?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = filterStatus === 'الكل' || entry.order_status === filterStatus;
            const matchesSource = filterSource === 'الكل' || entry.lead_source === filterSource;
            const matchesService = filterService === 'الكل' || entry.service_type?.includes(filterService);
            const matchesAssignee = filterAssignee === 'الكل' || entry.assignee === filterAssignee;

            // Period Filtering
            let matchesPeriod = true;
            if (filterPeriod !== 'الكل') {
                const dateRaw = entry.order_date || entry.created_at;
                if (!dateRaw) {
                    matchesPeriod = false;
                } else {
                    let entryDate;
                    if (entry.order_date && entry.order_date.includes('-')) {
                        const [y, m, d] = entry.order_date.split('-').map(Number);
                        entryDate = new Date(y, m - 1, d);
                    } else {
                        entryDate = new Date(dateRaw);
                    }
                    const now = new Date();
                
                if (filterPeriod === 'اليوم') {
                    matchesPeriod = entryDate.toDateString() === now.toDateString();
                } else if (filterPeriod === 'هذا الشهر') {
                    matchesPeriod = entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
                } else if (filterPeriod === 'مايو 2026') {
                    matchesPeriod = entryDate.getMonth() === 4 && entryDate.getFullYear() === 2026;
                } else if (filterPeriod === 'أبريل 2026') {
                    matchesPeriod = entryDate.getMonth() === 3 && entryDate.getFullYear() === 2026;
                } else if (filterPeriod === 'مارس 2026') {
                    matchesPeriod = entryDate.getMonth() === 2 && entryDate.getFullYear() === 2026;
                } else if (filterPeriod === 'الشهر الماضي') {
                    const lastMonth = new Date();
                    lastMonth.setMonth(now.getMonth() - 1);
                    matchesPeriod = entryDate.getMonth() === lastMonth.getMonth() && entryDate.getFullYear() === lastMonth.getFullYear();
                } else if (filterPeriod.startsWith('month-')) {
                    const [_, year, month] = filterPeriod.split('-');
                    matchesPeriod = entryDate.getMonth() === parseInt(month) && entryDate.getFullYear() === parseInt(year);
                }
            }
        }

            return matchesSearch && matchesStatus && matchesSource && matchesService && matchesAssignee && matchesPeriod;
        });

        // Sorting Logic
        return result.sort((a, b) => {
            if (sortBy === 'الأحدث') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortBy === 'الأقدم') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortBy === 'الأقرب مناسبة') {
                if (!a.event_date) return 1;
                if (!b.event_date) return -1;
                return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
            }
            if (sortBy === 'الأعلى مديونية') return (b.remaining_balance || 0) - (a.remaining_balance || 0);
            return 0;
        });
    }, [ledgerEntries, searchTerm, filterStatus, filterSource, filterService, filterAssignee, filterPeriod, sortBy]);

    const stats = useMemo(() => {
        const total = filteredLedger.reduce((sum, e) => sum + (Number(e.total_price) || 0), 0);
        const collected = filteredLedger.reduce((sum, e) => sum + (Number(e.deposit_amount) || 0), 0);
        return { total, collected, pending: total - collected };
    }, [filteredLedger]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'تم التسليم النهائي':
            case 'مكتمل': 
                return 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
            case 'قيد التصميم': 
                return 'bg-indigo-100 text-indigo-800 border-indigo-200 font-bold';
            case 'جاري التنفيذ/الإرسال':
            case 'مكتمل جزئياً': 
                return 'bg-blue-100 text-blue-800 border-blue-200 font-bold';
            case 'ملغي': 
                return 'bg-red-100 text-red-800 border-red-200 font-bold';
            case 'بانتظار الاعتماد':
                return 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
            case 'قيد استلام الطلب':
            case 'قيد المعالجة':
                return 'bg-orange-100 text-orange-800 border-orange-200 font-bold';
            default: 
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getRelativeDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'اليوم 🔥';
        if (diffDays === 1) return 'غداً';
        if (diffDays === 2) return 'بعد غد';
        if (diffDays < 0) return `منذ ${Math.abs(diffDays)} يوم`;
        return `بعد ${diffDays} يوم`;
    };

    const isUrgentDebt = (entry: any) => {
        if (!entry.remaining_balance || entry.remaining_balance <= 0) return false;
        if (!entry.event_date) return false;
        const date = new Date(entry.event_date);
        const today = new Date();
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-lony-navy font-amiri tracking-tight">السجل المالي والتشغيلي</h2>
                    <p className="text-[10px] text-gray-500 font-bold">إدارة التدفقات ومتابعة الطلبات</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => { closeModal(); setShowModal(true); }} className="bg-lony-navy text-lony-gold hover:bg-lony-navy/90 h-10 px-6 rounded-xl shadow-md transition-all active:scale-95 text-xs">
                        <Plus className="ml-1 w-4 h-4" /> إضافة قيد يدوي
                    </Button>
                </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatSimple title="إجمالي المبيعات" value={stats.total} icon={<Briefcase />} color="text-lony-navy" />
                <StatSimple title="المبالغ المحصلة" value={stats.collected} icon={<Wallet />} color="text-emerald-600" />
                <StatSimple title="الديون المعلقة" value={stats.pending} icon={<AlertTriangle />} color="text-red-600" />
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="md:col-span-2 lg:col-span-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="بحث..." 
                            className="w-full pr-10 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-xs font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                        <select 
                            className="w-full pr-8 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-[10px] font-bold appearance-none"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="الكل">الحالة</option>
                            <option value="قيد استلام الطلب">قيد الاستلام</option>
                            <option value="قيد المعالجة">قيد المعالجة</option>
                            <option value="قيد التصميم">قيد التصميم</option>
                            <option value="جاري التنفيذ/الإرسال">جاري التنفيذ</option>
                            <option value="تم التسليم النهائي">تم التسليم</option>
                            <option value="مكتمل جزئياً">مكتمل جزئياً</option>
                            <option value="مكتمل">مكتمل</option>
                            <option value="ملغي">ملغي</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                        <select 
                            className="w-full pr-8 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-[10px] font-bold appearance-none"
                            value={filterService}
                            onChange={(e) => setFilterService(e.target.value)}
                        >
                            <option value="الكل">الخدمة</option>
                            <option value="تصميم">تصميم</option>
                            <option value="إرسال">إرسال</option>
                            <option value="بكج">بكجات</option>
                        </select>
                    </div>
                    <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                        <select 
                            className="w-full pr-8 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-[10px] font-bold appearance-none"
                            value={filterAssignee}
                            onChange={(e) => setFilterAssignee(e.target.value)}
                        >
                            <option value="الكل">المسؤول</option>
                            <option value="لوني">لوني</option>
                            <option value="سارة">سارة</option>
                            <option value="نورة">نورة</option>
                            <option value="أحمد">أحمد</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                        <select 
                            className="w-full pr-8 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-[10px] font-bold appearance-none"
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                        >
                            <option value="الكل">الفترة</option>
                            <option value="اليوم">اليوم</option>
                            <option value="هذا الشهر">هذا الشهر</option>
                            <option value="مايو 2026">مايو 2026</option>
                            <option value="أبريل 2026">أبريل 2026</option>
                            <option value="مارس 2026">مارس 2026</option>
                            <option value="الشهر الماضي">الشهر الماضي</option>
                            <option value="month-2026-4">مايو 2026</option>
                            <option value="month-2026-3">أبريل 2026</option>
                            <option value="month-2026-2">مارس 2026</option>
                        </select>
                    </div>
                    <div className="relative">
                        <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                        <select 
                            className="w-full pr-8 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-[10px] font-bold appearance-none"
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value)}
                        >
                            <option value="الكل">المصدر</option>
                            <option value="مباشر">مباشر</option>
                            <option value="انستقرام">انستقرام</option>
                            <option value="تيك توك">تيك توك</option>
                            <option value="توصية">توصية</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                        <select 
                            className="w-full pr-8 pl-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold outline-none text-[10px] font-bold appearance-none"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="الأحدث">الأحدث أولاً</option>
                            <option value="الأقدم">الأقدم أولاً</option>
                            <option value="الأقرب مناسبة">الأقرب مناسبة</option>
                            <option value="الأعلى مديونية">الأعلى مديونية</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-lony-navy text-lony-gold border-b border-lony-gold/10">
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">العميل (اسمه ورقمه)</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">الخدمات</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">المبالغ (SAR)</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">التواريخ</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">الملاحظات والتحديثات</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLedger.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center text-gray-400 italic">
                                        لا توجد بيانات تطابق بحثك...
                                    </td>
                                </tr>
                            ) : (
                                filteredLedger.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-lony-gold/[0.02] transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-lony-gold/10 flex items-center justify-center text-lony-gold">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 cursor-pointer group/name" onClick={() => openInspection(entry)}>
                                                        <span className="text-[10px] bg-lony-navy text-white px-2 py-0.5 rounded font-mono font-bold">{entry.order_number || 'INV-NEW'}</span>
                                                        <div className="font-bold text-lony-navy group-hover/name:text-lony-gold transition-colors">{entry.client_name}</div>
                                                        {entry.priority === 'عالية جداً' && <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">🔥 VIP</span>}
                                                        {entry.priority === 'متوسطة' && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">⚡</span>}
                                                        {(Number(entry.deposit_amount || 0) + Number(entry.remaining_balance || 0)) !== Number(entry.total_price || 0) && (
                                                            <span className="text-[8px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full border border-rose-200 font-bold" title="خطأ في الحسابات: المجموع لا يساوي الإجمالي">⚠️ خلل حسابي</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                        <span className="flex items-center gap-1" dir="ltr">
                                                            <Phone size={10} className="text-gray-400" />
                                                            {entry.client_phone || 'غير مسجل'}
                                                        </span>
                                                        {entry.client_phone && (
                                                            <a 
                                                                href={`https://wa.me/${entry.client_phone.replace(/\D/g, '')}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="p-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                                                                title="تواصل واتساب"
                                                            >
                                                                <MessageCircle size={10} />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1.5 mt-2">
                                                        {entry.service_type?.includes('تصميم') && <span title="تصميم" className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold flex items-center gap-1 border border-blue-100"><Edit size={8} /> تصميم</span>}
                                                        {entry.service_type?.includes('إرسال') && <span title="إرسال" className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold flex items-center gap-1 border border-green-100"><Send size={8} /> إرسال</span>}
                                                        {entry.service_type?.includes('إشراف') && <span title="إشراف" className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-bold flex items-center gap-1 border border-purple-100"><Users size={8} /> إشراف {entry.supervisor_status === 'confirmed' && '✅'}</span>}
                                                        {entry.assignee && (
                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold border border-gray-200">👤 {entry.assignee}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-[10px] font-bold text-gray-500 max-w-[120px] truncate">{entry.service_type}</td>
                                        <td className="p-4">
                                            <div className="space-y-1">
                                                <div className={`text-xs font-black ${isUrgentDebt(entry) ? 'text-white bg-red-600 px-2 py-0.5 rounded-lg animate-bounce inline-block' : 'text-lony-navy'}`}>{entry.total_price} SAR</div>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-gray-400">الربح:</span>
                                                    <span className="font-bold text-emerald-600">
                                                        {((entry.total_price || 0) - 
                                                         ((entry.designer_fee || 0) + 
                                                          (entry.supervisor_cost || 0) + 
                                                          (entry.dispatch_cost || 0) + 
                                                          (entry.marketing_cost || 0))).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-gray-400">المتبقي:</span>
                                                    <span className={`font-bold ${isUrgentDebt(entry) ? 'text-red-700 underline' : 'text-red-400'}`}>{entry.remaining_balance}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-2 text-center">
                                                <div className={`px-3 py-1 text-[10px] font-bold rounded-lg border shadow-sm ${getStatusStyle(entry.order_status)}`}>
                                                    {entry.order_status}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-xs text-gray-500 font-bold">
                                                        {entry.event_date || 'غير محدد'}
                                                    </div>
                                                    {entry.event_date && (
                                                        <div className="text-[9px] font-black text-indigo-500 bg-indigo-50 rounded-full py-0.5 px-2 inline-block">
                                                            {getRelativeDate(entry.event_date)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div 
                                                onClick={() => handleNoteUpdate(entry.id, entry.notes)}
                                                className="max-w-[150px] bg-yellow-50/50 border border-yellow-100 p-2 rounded-xl text-[10px] text-gray-600 italic leading-relaxed cursor-pointer hover:bg-yellow-100/50"
                                            >
                                                {entry.notes || 'أضف ملاحظة...'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => openEditModal(entry)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg" title="تعديل"><Edit size={16} /></button>
                                                <button onClick={() => handleCopyLink(entry)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="نسخ الرابط"><ExternalLink size={16} /></button>
                                                <button onClick={() => handleDeleteEntry(entry.id, entry.client_name)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="حذف"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4">
                {filteredLedger.map((entry) => (
                    <div key={entry.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-lony-gold/10 flex items-center justify-center text-lony-gold">
                                    <User size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-lony-navy text-white px-2 py-0.5 rounded font-mono font-bold">{entry.order_number || 'INV-TEMP'}</span>
                                        <h3 className="font-bold text-lony-navy">{entry.client_name}</h3>
                                    </div>
                                    <p className="text-xs text-gray-500" dir="ltr">{entry.client_phone}</p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 text-[10px] font-bold rounded-full border ${getStatusStyle(entry.order_status)}`}>
                                {entry.order_status}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-gray-50 p-3 rounded-2xl">
                                <p className="text-[10px] text-gray-400 mb-1">الإجمالي</p>
                                <p className="font-black text-emerald-600">{entry.total_price} SAR</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-2xl">
                                <p className="text-[10px] text-gray-400 mb-1">المتبقي</p>
                                <p className="font-black text-red-500">{entry.remaining_balance} SAR</p>
                            </div>
                        </div>

                        <div className="bg-yellow-50/50 border border-yellow-100 p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-yellow-700">الملاحظات</span>
                                <button onClick={() => handleNoteUpdate(entry.id, entry.notes)} className="text-[10px] bg-white px-2 py-1 rounded-lg shadow-sm border border-yellow-200">تحديث</button>
                            </div>
                            <p className="text-xs text-gray-600 italic whitespace-pre-line leading-relaxed">
                                {entry.notes || 'لا توجد ملاحظات...'}
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex gap-2">
                                {entry.service_type?.includes('تصميم') && <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Edit size={14} /></span>}
                                {entry.service_type?.includes('إرسال') && <span className="p-2 bg-green-50 text-green-600 rounded-xl"><Send size={14} /></span>}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => openEditModal(entry)} className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-2xl border border-indigo-100" title="تعديل"><Edit size={18} /></button>
                                <button onClick={() => handleCopyLink(entry)} className="p-3 text-blue-500 hover:bg-blue-50 rounded-2xl border border-blue-100" title="نسخ الرابط"><ExternalLink size={18} /></button>
                                <button onClick={() => handleDeleteEntry(entry.id, entry.client_name)} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl border border-red-100" title="حذف"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <Card className="w-full max-w-3xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <CardHeader className="bg-lony-navy p-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-black text-lony-gold font-amiri">
                                {editMode ? 'تعديل قيد مالي وتشغيلي' : 'إضافة قيد مالي وتشغيلي جديد'}
                            </CardTitle>
                            <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </CardHeader>
                        <CardContent className="p-0 flex flex-col h-[85vh]">
                            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                                {/* Section 1: Basic Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-lony-navy border-b border-gray-100 pb-2">
                                        <User size={16} className="text-lony-gold" />
                                        <h3 className="font-bold text-sm">البيانات الأساسية</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">اسم العميل</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" placeholder="أدخل اسم العميل" value={manualEntry.client_name} onChange={e => setManualEntry({...manualEntry, client_name: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">رقم الجوال</label>
                                            <input type="text" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" placeholder="966..." value={manualEntry.client_phone} onChange={e => setManualEntry({...manualEntry, client_phone: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">مصدر العميل</label>
                                            <select className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold appearance-none" value={manualEntry.lead_source} onChange={e => setManualEntry({...manualEntry, lead_source: e.target.value})}>
                                                <option value="مباشر">مباشر</option>
                                                <option value="انستقرام">انستقرام</option>
                                                <option value="تيك توك">تيك توك</option>
                                                <option value="توصية">توصية</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">المسؤول عن الطلب</label>
                                            <select className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold appearance-none" value={manualEntry.assignee} onChange={e => setManualEntry({...manualEntry, assignee: e.target.value})}>
                                                <option value="">غير محدد</option>
                                                <option value="لوني">لوني</option>
                                                <option value="سارة">سارة</option>
                                                <option value="نورة">نورة</option>
                                                <option value="أحمد">أحمد</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">تاريخ استلام الطلب</label>
                                            <input type="date" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.order_date} onChange={e => setManualEntry({...manualEntry, order_date: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">أهمية الطلب</label>
                                            <select className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold appearance-none" value={manualEntry.priority} onChange={e => setManualEntry({...manualEntry, priority: e.target.value})}>
                                                <option value="عادية">عادية 🟢</option>
                                                <option value="متوسطة">متوسطة ⚡</option>
                                                <option value="عالية جداً">عالية جداً 🔥</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>


                                {/* Section 2: Modular Services Selection */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-lony-navy border-b border-gray-100 pb-2">
                                        <Layers size={16} className="text-lony-gold" />
                                        <h3 className="font-bold text-sm">اختيار الخدمات (SLA)</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button 
                                            onClick={() => setManualEntry({...manualEntry, has_design: !manualEntry.has_design})}
                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${manualEntry.has_design ? 'border-lony-gold bg-lony-gold/5 text-lony-navy' : 'border-gray-100 bg-white text-gray-400'}`}
                                        >
                                            <Edit size={18} />
                                            <span className="font-bold text-[10px]">تصميم</span>
                                        </button>
                                        <button 
                                            onClick={() => setManualEntry({...manualEntry, has_whatsapp: !manualEntry.has_whatsapp})}
                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${manualEntry.has_whatsapp ? 'border-lony-gold bg-lony-gold/5 text-lony-navy' : 'border-gray-100 bg-white text-gray-400'}`}
                                        >
                                            <Send size={18} />
                                            <span className="font-bold text-[10px]">إرسال</span>
                                        </button>
                                        <button 
                                            onClick={() => setManualEntry({...manualEntry, has_supervision: !manualEntry.has_supervision})}
                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${manualEntry.has_supervision ? 'border-lony-gold bg-lony-gold/5 text-lony-navy' : 'border-gray-100 bg-white text-gray-400'}`}
                                        >
                                            <Users size={18} />
                                            <span className="font-bold text-[10px]">إشراف</span>
                                        </button>
                                    </div>

                                    {/* Barcode Type for Design */}
                                    {manualEntry.has_design && (
                                        <div className="p-3 bg-slate-50 rounded-xl space-y-2 animate-in slide-in-from-top-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">نوع الباركود (SLA)</label>
                                            <div className="flex gap-2">
                                                {['none', 'numbered', 'named'].map(type => (
                                                    <button 
                                                        key={type}
                                                        onClick={() => setManualEntry({...manualEntry, barcode_type: type})}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${manualEntry.barcode_type === type ? 'bg-lony-navy text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
                                                    >
                                                        {type === 'none' ? 'بدون باركود' : type === 'numbered' ? 'مرقم' : 'بالأسماء'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section 3: Dynamic Details & Costs */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-lony-navy border-b border-gray-100 pb-2">
                                        <Briefcase size={16} className="text-lony-gold" />
                                        <h3 className="font-bold text-sm">بيانات التشغيل والتكاليف</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {manualEntry.has_design && (
                                            <div className="space-y-1 animate-in zoom-in-95">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase">تكلفة المصمم</label>
                                                <input type="number" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.designer_fee} onChange={e => setManualEntry({...manualEntry, designer_fee: e.target.value})} />
                                            </div>
                                        )}

                                        {manualEntry.has_whatsapp && (
                                            <>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">تكلفة الإرسال</label>
                                                    <input type="number" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.dispatch_cost} onChange={e => setManualEntry({...manualEntry, dispatch_cost: e.target.value})} />
                                                </div>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">بدء الإرسال 📅</label>
                                                    <input type="date" className="w-full p-3 bg-blue-50/30 border border-blue-100 rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.start_sending_date} onChange={e => setManualEntry({...manualEntry, start_sending_date: e.target.value})} />
                                                </div>
                                            </>
                                        )}

                                        {manualEntry.has_supervision && (
                                            <>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">عدد المشرفين</label>
                                                    <input type="number" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.supervisor_count} onChange={e => setManualEntry({...manualEntry, supervisor_count: e.target.value})} />
                                                </div>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">تكلفة المشرفين</label>
                                                    <input type="number" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.supervisor_cost} onChange={e => setManualEntry({...manualEntry, supervisor_cost: e.target.value})} />
                                                </div>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">حالة التأكيد</label>
                                                    <button 
                                                        onClick={() => setManualEntry({...manualEntry, supervisor_status: manualEntry.supervisor_status === 'confirmed' ? 'pending' : 'confirmed'})}
                                                        className={`w-full p-2.5 rounded-xl font-bold text-[10px] transition-all flex items-center justify-center gap-1.5 ${manualEntry.supervisor_status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                                                    >
                                                        {manualEntry.supervisor_status === 'confirmed' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                                        {manualEntry.supervisor_status === 'confirmed' ? 'تم التأكيد ✅' : 'بانتظار التأكيد'}
                                                    </button>
                                                </div>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">مسؤول المشرفين</label>
                                                    <input type="text" className="w-full p-3 bg-blue-50/30 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" placeholder="الاسم" value={manualEntry.supervisor_lead_name} onChange={e => setManualEntry({...manualEntry, supervisor_lead_name: e.target.value})} />
                                                </div>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">جوال المسؤول</label>
                                                    <input type="text" className="w-full p-3 bg-blue-50/30 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" placeholder="966..." value={manualEntry.supervisor_lead_phone} onChange={e => setManualEntry({...manualEntry, supervisor_lead_phone: e.target.value})} />
                                                </div>
                                                <div className="space-y-1 animate-in zoom-in-95">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">تاريخ المناسبة 📅</label>
                                                    <input type="date" className="w-full p-3 bg-purple-50/30 border border-purple-100 rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.event_date} onChange={e => setManualEntry({...manualEntry, event_date: e.target.value})} />
                                                </div>
                                            </>
                                        )}

                                        {(manualEntry.has_design || manualEntry.has_whatsapp) && (
                                            <div className="space-y-1 animate-in zoom-in-95">
                                                <label className="text-[10px] font-bold text-blue-600 uppercase">عدد البطاقات/الضيوف</label>
                                                <input type="number" className="w-full p-3 bg-blue-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold text-blue-900" placeholder="مثال: 200" value={manualEntry.guest_count} onChange={e => setManualEntry({...manualEntry, guest_count: e.target.value})} />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">تكلفة التسويق</label>
                                            <input type="number" className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-lony-gold outline-none text-xs font-bold" value={manualEntry.marketing_cost} onChange={e => setManualEntry({...manualEntry, marketing_cost: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Financials */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-lony-navy border-b border-gray-100 pb-3">
                                        <Wallet size={18} className="text-lony-gold" />
                                        <h3 className="font-bold text-base">التفاصيل المالية</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500">المبلغ الإجمالي</label>
                                            <input type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold" value={manualEntry.total_amount} onChange={e => setManualEntry({...manualEntry, total_amount: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500">المبلغ المدفوع</label>
                                            <input type="number" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold" value={manualEntry.paid_amount} onChange={e => setManualEntry({...manualEntry, paid_amount: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500">الحساب البنكي</label>
                                            <select className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold appearance-none" value={manualEntry.bank_account} onChange={e => setManualEntry({...manualEntry, bank_account: e.target.value})}>
                                                <optgroup label="البنوك السعودية">
                                                    <option value="الراجحي">الراجحي</option>
                                                    <option value="الأهلي (SNB)">الأهلي (SNB)</option>
                                                    <option value="الإنماء">الإنماء</option>
                                                    <option value="الرياض">الرياض</option>
                                                    <option value="ساب (SAB)">ساب (SAB)</option>
                                                    <option value="الجزيرة">الجزيرة</option>
                                                    <option value="البلاد">البلاد</option>
                                                    <option value="الاستثمار">الاستثمار</option>
                                                    <option value="العربي">العربي</option>
                                                    <option value="الفرنسي">الفرنسي</option>
                                                    <option value="ميم (GIB)">ميم (Meem)</option>
                                                </optgroup>
                                                <optgroup label="الدفع الرقمي والآجل">
                                                    <option value="STC Pay">STC Pay</option>
                                                    <option value="Apple Pay">Apple Pay</option>
                                                    <option value="Urpay">Urpay</option>
                                                    <option value="مدى (Mada)">مدى (Mada)</option>
                                                    <option value="تابي (Tabby)">تابي (Tabby)</option>
                                                    <option value="تمارا (Tamara)">تمارا (Tamara)</option>
                                                    <option value="كاش">كاش</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 5: Dates & Status */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-lony-navy border-b border-gray-100 pb-3">
                                        <Calendar size={18} className="text-lony-gold" />
                                        <h3 className="font-bold text-base">المواعيد والـ SLA</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500">تاريخ التسليم الموعود (SLA التلقائي)</label>
                                            <input type="date" className="w-full p-4 bg-amber-50 border border-amber-100 rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold text-amber-900" value={manualEntry.target_delivery_date} onChange={e => setManualEntry({...manualEntry, target_delivery_date: e.target.value})} />
                                            <p className="text-[10px] text-amber-600 mt-1">تم حسابه بناءً على نوع الباركود والخدمة.</p>
                                        </div>
                                        {manualEntry.has_supervision && (
                                            <div className="space-y-1 animate-in zoom-in-95 hidden">
                                                <label className="text-xs font-bold text-gray-500">تاريخ المناسبة</label>
                                                <input type="date" className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold" value={manualEntry.event_date} onChange={e => setManualEntry({...manualEntry, event_date: e.target.value})} />
                                            </div>
                                        )}
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-xs font-bold text-gray-500">الحالة الحالية</label>
                                            <select className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold" value={manualEntry.order_status} onChange={e => setManualEntry({...manualEntry, order_status: e.target.value})}>
                                                <option value="قيد استلام الطلب">قيد استلام الطلب</option>
                                                <option value="قيد المعالجة">قيد المعالجة</option>
                                                <option value="قيد التصميم">قيد التصميم</option>
                                                <option value="بانتظار الاعتماد">بانتظار الاعتماد</option>
                                                <option value="جاري التنفيذ/الإرسال">جاري التنفيذ/الإرسال</option>
                                                <option value="تم التسليم النهائي">تم التسليم النهائي</option>
                                                <option value="ملغي">ملغي</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-xs font-bold text-gray-500">ملاحظات إضافية</label>
                                            <textarea className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-lony-gold outline-none text-sm font-bold min-h-[100px]" placeholder="أي تفاصيل أخرى..." value={manualEntry.notes} onChange={e => setManualEntry({...manualEntry, notes: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                {/* Profit Summary Preview */}
                                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center justify-between mt-4">
                                    <div>
                                        <h4 className="text-emerald-800 font-bold text-sm">صافي الربح المتوقع للطلب</h4>
                                        <p className="text-[10px] text-emerald-600">السعر - (المصمم + المشرفين + الإرسال + التسويق)</p>
                                    </div>
                                    <div className="text-2xl font-black text-emerald-700">
                                        {(parseFloat(manualEntry.total_amount || '0') - 
                                         (parseFloat(manualEntry.designer_fee || '0') + 
                                          parseFloat(manualEntry.supervisor_cost || '0') + 
                                          parseFloat(manualEntry.dispatch_cost || '0') + 
                                          parseFloat(manualEntry.marketing_cost || '0'))).toLocaleString()} SAR
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                                <Button onClick={closeModal} variant="outline" className="h-10 px-6 rounded-xl border-gray-200 text-xs">إلغاء</Button>
                                <Button onClick={handleManualSubmit} className="bg-lony-navy text-lony-gold h-10 px-8 rounded-xl font-bold shadow-md text-xs">
                                    {editMode ? 'حفظ التعديلات' : 'حفظ القيد والتشغيل'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* Order Inspection Sheet (Review Mode) */}
            {showInspection && selectedEntry && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-8 duration-500">
                        {/* Header */}
                        <div className="bg-lony-navy p-6 text-white relative">
                            <div className="absolute top-6 left-6 flex gap-2">
                                <button onClick={() => { setShowInspection(false); openEditModal(selectedEntry); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Edit size={18} className="text-lony-gold" /></button>
                                <button onClick={() => setShowInspection(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><XCircle size={18} /></button>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-lony-gold/20 rounded-2xl flex items-center justify-center">
                                    <User size={32} className="text-lony-gold" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-black">{selectedEntry.client_name}</h2>
                                        <span className="px-3 py-0.5 bg-lony-gold text-lony-navy rounded-full text-[10px] font-bold">{selectedEntry.order_number || 'INV-TEMP'}</span>
                                    </div>
                                    <p className="text-white/60 text-sm font-mono mt-1" dir="ltr">{selectedEntry.client_phone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar" dir="rtl">
                            {/* Workflow Timeline */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">مسار العمل (Workflow)</h3>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusStyle(selectedEntry.order_status)}`}>{selectedEntry.order_status}</span>
                                </div>
                                <div className="flex justify-between relative py-4">
                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
                                    <WorkflowStep label="استلام" active={true} done={true} />
                                    <WorkflowStep label="تصميم" active={selectedEntry.order_status !== 'قيد استلام الطلب' && selectedEntry.order_status !== 'قيد المعالجة'} done={['جاري التنفيذ/الإرسال', 'تم التسليم النهائي', 'مكتمل'].includes(selectedEntry.order_status)} />
                                    <WorkflowStep label="تنفيذ" active={['جاري التنفيذ/الإرسال', 'تم التسليم النهائي', 'مكتمل'].includes(selectedEntry.order_status)} done={['تم التسليم النهائي', 'مكتمل'].includes(selectedEntry.order_status)} />
                                    <WorkflowStep label="تسليم" active={selectedEntry.order_status === 'تم التسليم النهائي' || selectedEntry.order_status === 'مكتمل'} done={selectedEntry.order_status === 'تم التسليم النهائي' || selectedEntry.order_status === 'مكتمل'} />
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">تاريخ الاستلام</label>
                                    <div className="p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 flex items-center gap-2">
                                        <Calendar size={14} className="text-lony-navy" /> {selectedEntry.order_date || selectedEntry.created_at?.split('T')[0]}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">تاريخ المناسبة</label>
                                    <div className="p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 flex items-center gap-2">
                                        <Clock size={14} className="text-lony-navy" /> {selectedEntry.event_date || 'غير محدد'}
                                    </div>
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white grid grid-cols-3 gap-4 shadow-xl">
                                <div>
                                    <p className="text-[9px] text-white/40 font-bold uppercase mb-1">إجمالي العقد</p>
                                    <p className="text-xl font-black">{selectedEntry.total_price?.toLocaleString()} <span className="text-xs opacity-40">SAR</span></p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-white/40 font-bold uppercase mb-1">المحـصل</p>
                                    <p className="text-xl font-black text-emerald-400">{selectedEntry.deposit_amount?.toLocaleString()} <span className="text-xs opacity-40 text-white">SAR</span></p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-white/40 font-bold uppercase mb-1">المتبقي</p>
                                    <p className={`text-xl font-black ${selectedEntry.remaining_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{selectedEntry.remaining_balance?.toLocaleString()} <span className="text-xs opacity-40 text-white">SAR</span></p>
                                </div>
                            </div>

                            {/* Services & Notes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase">الخدمات المشتركة</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedEntry.service_type?.split(' + ').map((s: string, i: number) => (
                                            <span key={i} className="px-3 py-1.5 bg-lony-gold/10 text-lony-navy border border-lony-gold/20 rounded-xl text-xs font-bold">{s}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase">سجل الملاحظات</h4>
                                    <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs text-slate-600 italic whitespace-pre-line leading-relaxed">
                                        {selectedEntry.notes || 'لا توجد ملاحظات مسجلة...'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 bg-slate-50 flex justify-between items-center" dir="rtl">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400">المسؤول:</span>
                                <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600">{selectedEntry.assignee || 'غير محدد'}</span>
                            </div>
                            <Button 
                                onClick={() => handleCopyLink(selectedEntry)}
                                className="bg-lony-navy text-lony-gold rounded-xl px-6 font-bold text-xs"
                            >
                                <ExternalLink size={14} className="ml-2" /> مشاركة الرابط
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const WorkflowStep = ({ label, active, done }: { label: string, active: boolean, done: boolean }) => (
    <div className="flex flex-col items-center gap-2 z-10">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-lony-navy text-lony-gold ring-4 ring-lony-gold/20' : 'bg-slate-100 text-slate-400'}`}>
            {done ? <CheckCircle size={16} /> : active ? <Activity size={16} /> : <Clock size={16} />}
        </div>
        <span className={`text-[10px] font-bold ${active || done ? 'text-lony-navy' : 'text-slate-300'}`}>{label}</span>
    </div>
);

const StatSimple = ({ title, value, icon, color }: any) => (
    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-50 flex items-center justify-between">
        <div>
            <div className="text-[10px] text-gray-400 mb-0.5">{title}</div>
            <div className={`text-lg font-black font-mono ${color}`}>{value.toLocaleString()} <span className="text-[9px]">SAR</span></div>
        </div>
        <div className={`w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center ${color} opacity-80`}>
            {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
    </div>
);

export default BusinessLedger;
