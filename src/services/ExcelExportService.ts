
/**
 * Lony Invitations - Excel/CSV Export Service
 * Precision utility to export guest data for event owners.
 */

export const exportGuestListToCSV = (guests: any[], eventName: string) => {
    if (!guests || guests.length === 0) return;

    // 1. Define CSV headers (Arabic for local use)
    const headers = [
        'اسم الضيف',
        'رقم الجوال',
        'عدد المرافقين',
        'كود الدخول',
        'حالة الـ RSVP',
        'حالة الحضور',
        'حالة الواتساب'
    ];

    // 2. Map guest data to CSV rows
    const rows = guests.map(guest => [
        `"${guest.name || ''}"`,
        `"${guest.phone || ''}"`,
        guest.companions || 0,
        `"${guest.entry_code || ''}"`,
        guest.rsvp_status === 'confirmed' ? 'مؤكد ✅' : guest.rsvp_status === 'declined' ? 'معتذر ❌' : 'لا يوجد رد',
        guest.has_entered ? 'تم الدخول ✅' : 'لم يحضر',
        `"${guest.status || 'معلق'}"`
    ]);

    // 3. Assemble CSV content
    const csvContent = [
        '\uFEFF' + headers.join(','), // Add BOM for Excel Arabic support
        ...rows.map(r => r.join(','))
    ].join('\n');

    // 4. Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `تقرير_ضيوف_${eventName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
