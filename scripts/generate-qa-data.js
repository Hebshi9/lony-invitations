const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const guests = [
    { 'الاسم': 'أحمد بن فهد (تجربة)', 'الجوال': '966569667344', 'رقم الطاولة': 'T-01', 'عدد المرافقين': 2, 'الفئة': 'VIP' },
    { 'الاسم': 'سارة محمد (تجربة)', 'الجوال': '966507240097', 'رقم الطاولة': 'T-02', 'عدد المرافقين': 1, 'الفئة': 'VIP' },
    { 'الاسم': 'ضيف مجهول الهوية', 'الجوال': '966503578789', 'رقم الطاولة': 'T-03', 'عدد المرافقين': 0, 'الفئة': 'عادي' },
    { 'الاسم': 'اختبار ثغرة <script>', 'الجوال': '966500000000', 'رقم الطاولة': 'XSS', 'عدد المرافقين': 5, 'الفئة': 'EMERGENCY' }
];

const dataPath = path.join(__dirname, '../tests/test_data');
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

const ws = XLSX.utils.json_to_sheet(guests);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'الضيوف');

XLSX.writeFile(wb, path.join(dataPath, 'qa_guests.xlsx'));
console.log('✅ Created qa_guests.xlsx for Master Auditor.');
