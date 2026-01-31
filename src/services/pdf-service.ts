import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export interface AttendanceReportData {
    eventName: string;
    eventDate: string;
    venue: string;
    totalGuests: number;
    attendedCount: number;
    remainingCount: number;
    guests: any[];
}

export const pdfService = {
    async generateAttendanceReport(data: AttendanceReportData) {
        // @ts-ignore - jspdf-autotable extends jsPDF
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            putOnlyUsedFonts: true
        });

        // Add Arabic Font support if available, or use standard
        // Note: jsPDF has limited Arabic support without custom fonts.
        // For now, we'll use a standard layout and suggest custom fonts for full RTL support.

        doc.setFontSize(22);
        doc.text('Lony Invitations - Attendance Report', 105, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.text(`Event: ${data.eventName}`, 20, 40);
        doc.text(`Date: ${data.eventDate}`, 20, 50);
        doc.text(`Venue: ${data.venue}`, 20, 60);

        doc.setDrawColor(212, 175, 55); // Lony Gold
        doc.line(20, 65, 190, 65);

        doc.setFontSize(12);
        doc.text(`Total Guests: ${data.totalGuests}`, 20, 75);
        doc.text(`Attended: ${data.attendedCount}`, 80, 75);
        doc.text(`Remaining: ${data.remainingCount}`, 140, 75);

        // Table
        const tableData = data.guests.map(g => [
            g.name,
            g.phone || '-',
            g.status === 'attended' ? 'Yes' : 'No',
            g.table_no || '-'
        ]);

        // @ts-ignore
        doc.autoTable({
            startY: 85,
            head: [['Name', 'Phone', 'Attended', 'Table']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [26, 43, 86] }, // Lony Navy
        });

        const fileName = `attendance_${data.eventName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    }
};
