import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Upload, AlertCircle, CheckCircle, FileArchive, Loader2 } from 'lucide-react';
import JSZip from 'jszip';

const ExternalCardsUpload: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [guests, setGuests] = useState<any[]>([]);
    const [zipFile, setZipFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [matches, setMatches] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Fetch Events
    useEffect(() => {
        const fetchEvents = async () => {
            const { data } = await supabase.from('events').select('id, name').order('created_at', { ascending: false });
            if (data) setEvents(data);
        };
        fetchEvents();
    }, []);

    // Fetch Guests when Event Selected
    useEffect(() => {
        if (!selectedEventId) return;
        const fetchGuests = async () => {
            // We need id, card_number, phone, name to match against filenames
            const { data } = await supabase.from('guests').select('id, name, phone, card_number').eq('event_id', selectedEventId);
            if (data) setGuests(data);
        };
        fetchGuests();
    }, [selectedEventId]);

    const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setZipFile(file);
        processZip(file);
    };

    const processZip = async (file: File) => {
        if (!guests.length) {
            alert('الرجاء اختيار حدث وله ضيوف أولاً');
            return;
        }

        setProcessing(true);
        try {
            const zip = await JSZip.loadAsync(file);
            const validFiles: { name: string, data: Blob, guestId: string }[] = [];

            // Iterate ZIP files
            const files = Object.keys(zip.files);

            for (const filename of files) {
                if (zip.files[filename].dir) continue;
                if (!filename.match(/\.(jpg|jpeg|png)$/i)) continue; // Only images

                // Try to match filename to guest
                // logic: filename might be "001.jpg" or "invite_123.jpg" or just "123.jpg"
                // strict match on card_number or simple number extraction

                const baseName = filename.split('/').pop()?.replace(/\.[^/.]+$/, "") || "";
                // Extract numbers from filename
                const numbers = baseName.match(/\d+/g);
                const extractedNumber = numbers ? numbers.join('') : null; // "invite_001" -> "001"

                let matchedGuest = null;

                if (extractedNumber) {
                    // Try to match with card_number (padded or unpadded)
                    matchedGuest = guests.find(g =>
                        g.card_number === extractedNumber ||
                        Number(g.card_number) === Number(extractedNumber)
                    );
                }

                if (matchedGuest) {
                    const blob = await zip.files[filename].async('blob');
                    validFiles.push({
                        name: filename,
                        data: blob,
                        guestId: matchedGuest.id
                    });
                }
            }

            setMatches(validFiles);
        } catch (error) {
            console.error(error);
            alert('خطأ في قراءة ملف ZIP');
        } finally {
            setProcessing(false);
        }
    };

    const handleUploadToSupabase = async () => {
        if (!matches.length) return;
        setUploading(true);
        setProgress(0);

        let successCount = 0;

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const fileName = `${selectedEventId}/${match.guestId}.jpg`;

            try {
                // Upload
                const { error: uploadError } = await supabase.storage
                    .from('invitation-cards')
                    .upload(fileName, match.data, { upsert: true, contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('invitation-cards')
                    .getPublicUrl(fileName);

                // Update DB
                await supabase.from('guests').update({
                    card_image_url: publicUrl,
                    card_generated_at: new Date().toISOString()
                }).eq('id', match.guestId);

                successCount++;
            } catch (err) {
                console.error(`Failed to upload ${match.name}`, err);
            }

            setProgress(Math.round(((i + 1) / matches.length) * 100));
        }

        setUploading(false);
        alert(`تم رفع ${successCount} كرت بنجاح!`);
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto font-kufi" dir="rtl">
            <h1 className="text-3xl font-bold text-lony-navy font-amiri">رفع الكروات الخارجية (External Cards)</h1>
            <p className="text-gray-600">ارفع ملف ZIP يحتوي على صور الكروت، وسيقوم النظام بربطها بالضيوف بناءً على الأرقام.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Select Event */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">1</span>
                            اختر الحدث
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <select
                            className="w-full p-2 border rounded"
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                        >
                            <option value="">-- اختر --</option>
                            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <div className="mt-2 text-sm text-gray-500">
                            {guests.length > 0 ? `تم العثور على ${guests.length} ضيف` : 'لا يوجد ضيوف'}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Upload ZIP */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">2</span>
                            رفع ملف ZIP
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept=".zip"
                                onChange={handleZipUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={!selectedEventId}
                            />
                            <FileArchive className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 font-medium">اضغط لرفع ملف ZIP</p>
                            <p className="text-xs text-gray-400 mt-1">يجب أن تكون أسماء الصور مطابقة لأرقام الكروت (مثال: 001.jpg)</p>
                        </div>
                        {zipFile && (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                                <CheckCircle className="w-4 h-4" />
                                {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(2)} MB)
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 3. Matching Results */}
            {processing && (
                <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                    <p>جاري تحليل الملفات ومطابقتها...</p>
                </div>
            )}

            {!processing && matches.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>نتيجة المطابقة</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1 bg-green-50 p-4 rounded text-center border border-green-100">
                                <div className="text-2xl font-bold text-green-600">{matches.length}</div>
                                <div className="text-sm text-green-800">صورة مطابقة ✅</div>
                            </div>
                            <div className="flex-1 bg-gray-50 p-4 rounded text-center border border-gray-100">
                                <div className="text-2xl font-bold text-gray-500">{guests.length}</div>
                                <div className="text-sm text-gray-600">إجمالي الضيوف</div>
                            </div>
                        </div>

                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${uploading ? progress : 0}%` }}
                            />
                        </div>

                        <Button
                            onClick={handleUploadToSupabase}
                            disabled={uploading}
                            className="w-full py-6 text-lg"
                        >
                            {uploading ? `جاري الرفع... ${progress}%` : 'تأكيد ورفع الكروت للسيرفر 🚀'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!processing && zipFile && matches.length === 0 && (
                <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-yellow-800 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    لم يتم العثور على أي مطابقة! تأكد أن أسماء الصور تحتوي على أرقام الكروت (Serial Number).
                </div>
            )}
        </div>
    );
};

export default ExternalCardsUpload;
