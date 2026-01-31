import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { Calendar, MapPin, Type, Loader2, CheckCircle, QrCode, Clock } from 'lucide-react';
import FeaturesSelector from '../components/FeaturesSelector';
import { EventFeatures, DEFAULT_FEATURES } from '../lib/features';

const EventManager: React.FC = () => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [venue, setVenue] = useState('');
    const [activationTime, setActivationTime] = useState('');
    const [openingTime, setOpeningTime] = useState('13:00');
    const [country, setCountry] = useState('Saudi Arabia');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [generatedToken, setGeneratedToken] = useState('');

    // Features State
    const [features, setFeatures] = useState<Partial<EventFeatures>>(DEFAULT_FEATURES);
    const [hostPin, setHostPin] = useState('');

    // QR Settings State
    const [qrSettings, setQrSettings] = useState({
        show_name: true,
        show_table: true,
        show_companions: true,
        show_category: false
    });

    const handleSubmit = async () => {
        if (!name || !date) {
            setMessage('الرجاء تعبئة الحقول المطلوبة');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // Generate a "Pro" token: WED-XXXX
            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const token = `WED-${randomCode}`;

            // Combine Date and Activation Time
            let activationTimestamp = null;
            if (date && activationTime) {
                activationTimestamp = new Date(`${date}T${activationTime}`).toISOString();
            }

            // Combine Date and Opening Time
            let openingTimestamp = null;
            if (date && openingTime) {
                openingTimestamp = new Date(`${date}T${openingTime}`).toISOString();
            }

            const { error } = await supabase
                .from('events')
                .insert({
                    name,
                    date,
                    venue,
                    token,
                    host_pin: features.enable_host_pin ? hostPin : null,
                    activation_time: activationTimestamp,
                    opening_time: openingTimestamp,
                    country,
                    features: features,
                    settings: {
                        qr_fields: {
                            ...qrSettings,
                            show_custom: []
                        },
                        portal_settings: {}
                    }
                });

            if (error) throw error;

            setGeneratedToken(token);
            setMessage('تم إنشاء الحدث بنجاح');
            setName('');
            setDate('');
            setVenue('');
            setActivationTime('');
            setOpeningTime('13:00');
            setHostPin('');
            setFeatures(DEFAULT_FEATURES);
            setQrSettings({
                show_name: true,
                show_table: true,
                show_companions: true,
                show_category: false
            });

        } catch (error: any) {
            console.error('Error creating event:', error);
            setMessage(`حدث خطأ: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 font-kufi" dir="rtl">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-lony-navy font-amiri">إعداد الحدث الجديد</h1>
            </div>

            {message && (
                <div className={`p-4 rounded-xl ${message.includes('خطأ') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} border border-current`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    {/* Host PIN (only if feature enabled) */}
                    {features.enable_host_pin && (
                        <Card className="border-none shadow-xl bg-white/80 backdrop-blur">
                            <CardHeader className="border-b border-gray-100 pb-4">
                                <CardTitle className="text-xl text-lony-navy flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-lony-gold" />
                                    رمز المضيف (Host PIN)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <label className="text-sm font-medium text-gray-600">الرقم السري للمضيف</label>
                                <input
                                    type="text"
                                    maxLength={4}
                                    className="w-full pr-4 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold"
                                    placeholder="مثال: 1234"
                                    value={hostPin}
                                    onChange={(e) => setHostPin(e.target.value)}
                                />
                                <p className="text-xs text-gray-400">سيطلب منك هذا الرقم للتحكم الكامل</p>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-none shadow-xl bg-white/80 backdrop-blur">
                        <CardHeader className="border-b border-gray-100 pb-4">
                            <CardTitle className="text-xl text-lony-navy flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-lony-gold" />
                                تفاصيل المناسبة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-600">اسم المناسبة</label>
                                <div className="relative">
                                    <Type className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        className="w-full pr-10 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all"
                                        placeholder="مثال: حفل زفاف محمد وسارة"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-600">التاريخ</label>
                                <div className="relative">
                                    <Calendar className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        type="date"
                                        className="w-full pr-10 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {features.qr_time_restricted && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-600">وقت تفعيل الدخول (Activation)</label>
                                        <div className="relative">
                                            <Clock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                            <input
                                                type="time"
                                                className="w-full pr-10 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all"
                                                value={activationTime}
                                                onChange={(e) => setActivationTime(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400">الوقت الذي يسمح فيه بالمسح</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-600">وقت فتح القاعة (Opening)</label>
                                        <div className="relative">
                                            <Clock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                            <input
                                                type="time"
                                                className="w-full pr-10 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all"
                                                value={openingTime}
                                                onChange={(e) => setOpeningTime(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400">الوقت الذي يظهر في البطاقة</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-600">الدولة / المنطقة الزمنية</label>
                                <div className="relative">
                                    <MapPin className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                    <select
                                        className="w-full pr-10 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all"
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                    >
                                        <option value="Saudi Arabia">السعودية (KSA)</option>
                                        <option value="UAE">الإمارات (UAE)</option>
                                        <option value="Kuwait">الكويت (Kuwait)</option>
                                        <option value="Qatar">قطر (Qatar)</option>
                                        <option value="Bahrain">البحرين (Bahrain)</option>
                                        <option value="Oman">عمان (Oman)</option>
                                        <option value="Egypt">مصر (Egypt)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-600">المكان (القاعة)</label>
                                <div className="relative">
                                    <MapPin className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        className="w-full pr-10 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all"
                                        placeholder="مثال: قاعة المملكة"
                                        value={venue}
                                        onChange={(e) => setVenue(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white/80 backdrop-blur">
                        <CardHeader className="border-b border-gray-100 pb-4">
                            <CardTitle className="text-xl text-lony-navy flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-lony-gold" />
                                إعدادات بطاقة الدخول (QR)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <p className="text-sm text-gray-500 mb-4">اختر البيانات التي ستظهر للضيف عند مسح الرمز:</p>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="font-medium text-gray-700">اسم الضيف</span>
                                <input
                                    type="checkbox"
                                    checked={qrSettings.show_name}
                                    onChange={(e) => setQrSettings({ ...qrSettings, show_name: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="font-medium text-gray-700">رقم الطاولة</span>
                                <input
                                    type="checkbox"
                                    checked={qrSettings.show_table}
                                    onChange={(e) => setQrSettings({ ...qrSettings, show_table: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="font-medium text-gray-700">عدد المرافقين</span>
                                <input
                                    type="checkbox"
                                    checked={qrSettings.show_companions}
                                    onChange={(e) => setQrSettings({ ...qrSettings, show_companions: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="font-medium text-gray-700">الفئة (VIP/عام)</span>
                                <input
                                    type="checkbox"
                                    checked={qrSettings.show_category}
                                    onChange={(e) => setQrSettings({ ...qrSettings, show_category: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                />
                            </label>
                        </CardContent>
                    </Card>

                    {/* Features Selector - NEW */}
                    <FeaturesSelector
                        features={features}
                        onChange={setFeatures}
                    />

                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-lony-navy hover:bg-lony-navy/90 text-white py-6 text-lg rounded-xl shadow-lg shadow-lony-navy/20 transition-all hover:scale-[1.02]"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'إنشاء الحدث'}
                    </Button>
                </div>

                {/* Success State / Token Display */}
                {generatedToken && (
                    <div className="space-y-8 animate-in slide-in-from-left duration-500">
                        <Card className="border-none shadow-xl bg-lony-navy text-white overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                            <CardContent className="flex flex-col items-center justify-center h-full py-12 space-y-6 relative z-10">
                                <div className="w-20 h-20 bg-lony-gold rounded-full flex items-center justify-center mb-4 shadow-lg shadow-lony-gold/30">
                                    <CheckCircle className="w-10 h-10 text-lony-navy" />
                                </div>
                                <h2 className="text-2xl font-bold font-amiri">تم إنشاء الحدث بنجاح!</h2>
                                <p className="text-gray-300 text-center max-w-xs">استخدم هذا الرمز للدخول إلى بوابة العملاء وتطبيق الماسح</p>

                                <div className="bg-white/10 p-6 rounded-2xl border border-white/20 backdrop-blur-sm w-full max-w-xs text-center">
                                    <span className="block text-sm text-lony-gold mb-2 uppercase tracking-widest">Access Token</span>
                                    <span className="text-4xl font-mono font-bold tracking-wider">{generatedToken}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventManager;
