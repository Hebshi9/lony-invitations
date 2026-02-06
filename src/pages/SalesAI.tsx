import React from 'react';
import SalesDashboard from '../components/SalesDashboard';

export default function SalesAI() {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                <h1 className="text-2xl font-black text-slate-800 mb-1 font-sans">نظام المبيعات الذكي (Sales AI)</h1>
                <p className="text-sm text-slate-500 font-medium font-sans">تتبع المحادثات الآلية مع العملاء والمهتمين بخدمات لوني</p>
            </div>

            <SalesDashboard />
        </div>
    );
}
