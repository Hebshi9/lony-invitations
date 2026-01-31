import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { Guest } from '../types';

export const downloadGuestsExcel = (guests: Guest[], eventName: string) => {
    const data = guests.map(g => ({
        'الاسم': g.name,
        'الجوال': g.phone || '',
        'عدد المرافقين': g.companions_count || 0,
        'رقم الطاولة': g.custom_fields?.table || g.table_no || '',
        'الفئة': g.category || '',
        'الحالة': g.status === 'attended' ? 'حضر' : g.status === 'confirmed' ? 'مؤكد' : 'مدعو',
        'رابط الدعوة': `${window.location.origin}/v/${g.id}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");
    XLSX.writeFile(workbook, `${eventName}_guests.xlsx`);
};

export const downloadLinksCsv = (guests: Guest[], eventName: string) => {
    const csvContent = "Name,Phone,Link\n" + guests.map(g =>
        `"${g.name}","${g.phone || ''}","${window.location.origin}/v/${g.id}"`
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `${eventName}_links.csv`);
};

/**
 * تصدير روابط الدعوات مع جميع التفاصيل
 * Export invitation links with all guest details for WhatsApp sending
 */
export const downloadInvitationLinks = (guests: Guest[], eventName: string) => {
    // إنشاء رؤوس الأعمدة بالعربية والإنجليزية
    const headers = [
        'الاسم',
        'الجوال',
        'الرابط الشخصي',
        'رابط الكرت',
        'حالة RSVP',
        'تاريخ الرد',
        'الحضور',
        'المرافقين',
        'الطاولة',
        'الفئة'
    ];

    // تحويل بيانات الضيوف إلى صفوف
    const rows = guests.map(guest => {
        const invitationLink = `${window.location.origin}/v/${guest.qr_token || guest.id}`;
        const cardUrl = guest.card_url || '';

        // ترجمة حالة RSVP
        let rsvpStatusAr = 'بانتظار';
        if ((guest as any).rsvp_status === 'confirmed') rsvpStatusAr = 'مؤكد';
        else if ((guest as any).rsvp_status === 'declined') rsvpStatusAr = 'اعتذر';

        // ترجمة حالة الحضور
        let attendanceStatusAr = 'لم يحضر';
        if (guest.status === 'attended') attendanceStatusAr = 'حضر';
        else if (guest.status === 'confirmed') attendanceStatusAr = 'مؤكد';

        // تنسيق تاريخ الرد
        const rsvpDate = (guest as any).rsvp_date
            ? new Date((guest as any).rsvp_date).toLocaleDateString('ar-SA')
            : '-';

        return [
            guest.name,
            guest.phone || '',
            invitationLink,
            cardUrl,
            rsvpStatusAr,
            rsvpDate,
            attendanceStatusAr,
            guest.companions_count || 0,
            guest.custom_fields?.table || guest.table_no || '-',
            guest.category || (guest as any).guest_category || 'عام'
        ];
    });

    // دمج الرؤوس والصفوف
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

    // إضافة BOM للدعم الكامل للعربية في Excel
    const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;'
    });

    saveAs(blob, `${eventName}_invitation_links.csv`);
};

export const downloadQrZip = async (guests: Guest[], eventName: string) => {
    const zip = new JSZip();
    const folder = zip.folder("qr_codes");

    if (!folder) return;

    // Generate QR for each guest
    const promises = guests.map(async (guest) => {
        try {
            const url = `${window.location.origin}/v/${guest.id}`;
            const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });

            // Remove data:image/png;base64, prefix
            const base64Data = qrDataUrl.split(',')[1];

            // Sanitize filename
            const filename = `${guest.name.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_')}_${guest.id.slice(0, 4)}.png`;
            folder.file(filename, base64Data, { base64: true });
        } catch (err) {
            console.error(`Error generating QR for ${guest.name}`, err);
        }
    });

    await Promise.all(promises);

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${eventName}_qr_codes.zip`);
};
