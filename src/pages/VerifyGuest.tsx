import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

const VerifyGuest: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [status, setStatus] = useState<'loading' | 'success' | 'already_checked_in' | 'error' | 'not_found'>('loading');
    const [guest, setGuest] = useState<any>(null);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            verifyGuest(id);
        }
    }, [id]);

    const verifyGuest = async (guestId: string) => {
        try {
            // 1. Fetch Guest
            const { data: guestData, error: fetchError } = await supabase
                .from('guests')
                .select('*, events(name)')
                .eq('id', guestId)
                .single();

            if (fetchError || !guestData) {
                setStatus('not_found');
                return;
            }

            setGuest(guestData);

            // 2. Check Status
            if (guestData.status === 'attended') {
                setStatus('already_checked_in');
                // Format existing check-in time if available, or just show "Previously"
                // Assuming we might have a 'updated_at' or specific 'check_in_time' column.
                // If not, we rely on updated_at.
                setCheckInTime(new Date(guestData.updated_at).toLocaleString('ar-SA'));
                return;
            }

            // 3. Update Status to Attended
            const { error: updateError } = await supabase
                .from('guests')
                .update({ status: 'attended', updated_at: new Date().toISOString() })
                .eq('id', guestId);

            if (updateError) throw updateError;

            setStatus('success');
            setCheckInTime(new Date().toLocaleString('ar-SA'));

        } catch (error) {
            console.error('Verification error:', error);
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-lony-sand flex items-center justify-center p-4 font-kufi" dir="rtl">
            <Card className="w-full max-w-md shadow-2xl border-none">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold text-lony-navy">
                        {guest?.events?.name || 'التحقق من الدعوة'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center text-center space-y-6 pt-6">

                    {status === 'loading' && (
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                            <div className="h-4 w-32 bg-gray-200 rounded"></div>
                        </div>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle className="w-12 h-12 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-green-700 mb-2">أهلاً بك!</h2>
                                <p className="text-gray-600 text-lg">تم تسجيل الدخول بنجاح</p>
                                <p className="text-sm text-gray-400 mt-2">{checkInTime}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl w-full">
                                <p className="text-sm text-gray-500 mb-1">الضيف</p>
                                <p className="text-xl font-bold text-lony-navy">{guest?.name}</p>
                                {guest?.table_no && (
                                    <p className="text-lony-gold font-medium mt-2">طاولة رقم: {guest.table_no}</p>
                                )}
                            </div>
                        </>
                    )}

                    {status === 'already_checked_in' && (
                        <>
                            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                <Clock className="w-12 h-12 text-orange-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-orange-700 mb-2">تم الدخول مسبقاً</h2>
                                <p className="text-gray-600">تم استخدام هذه الدعوة من قبل</p>
                                <p className="text-sm text-orange-600 font-bold mt-2">وقت الدخول: {checkInTime}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl w-full opacity-75">
                                <p className="text-sm text-gray-500 mb-1">الضيف</p>
                                <p className="text-xl font-bold text-lony-navy">{guest?.name}</p>
                            </div>
                        </>
                    )}

                    {status === 'not_found' && (
                        <>
                            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                <XCircle className="w-12 h-12 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-red-700 mb-2">دعوة غير صالحة</h2>
                                <p className="text-gray-600">لم يتم العثور على بيانات لهذه الدعوة</p>
                            </div>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                <AlertTriangle className="w-12 h-12 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-red-700 mb-2">خطأ</h2>
                                <p className="text-gray-600">حدث خطأ أثناء التحقق. يرجى المحاولة مرة أخرى.</p>
                            </div>
                        </>
                    )}

                </CardContent>
            </Card>
        </div>
    );
};

export default VerifyGuest;
