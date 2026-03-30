import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { Calendar, MapPin, Type, Loader2, CheckCircle, QrCode, Clock } from 'lucide-react';
import FeaturesSelector from '../components/FeaturesSelector';
import { EventFeatures, DEFAULT_FEATURES } from '../lib/features';

interface EventManagerProps {
    initialEvent?: any;
    onSuccess?: () => void;
}

const EventManager: React.FC<EventManagerProps> = ({ initialEvent, onSuccess }) => {
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
    const [qrSettings, setQrSettings] = useState(() => {
        if (initialEvent?.settings?.qr_fields) {
            return initialEvent.settings.qr_fields;
        }
        return {
            show_name: true,
            show_table: true,
            show_companions: true,
            show_category: false
        };
    });

    // WhatsApp Automation Settings State
    const [whatsappSettings, setWhatsappSettings] = useState(() => {
        const defaults = {
            enable_48h_report: true,
            enable_no_reply_reminder: true,
            enable_pre_event_reminder: true,
            pre_event_reminder_days: 2,
            enable_direct_send: false
        };
        if (initialEvent?.settings?.whatsapp_settings) {
            return { ...defaults, ...initialEvent.settings.whatsapp_settings };
        }
        return defaults;
    });

    useEffect(() => {
        if (initialEvent) {
            setName(initialEvent.name || '');
            setDate(initialEvent.date || '');
            setVenue(initialEvent.venue || '');
            setCountry(initialEvent.country || 'Saudi Arabia');
            setHostPin(initialEvent.host_pin || '');

            if (initialEvent.activation_time) {
                const actTime = new Date(initialEvent.activation_time);
                setActivationTime(`${actTime.getHours().toString().padStart(2, '0')}:${actTime.getMinutes().toString().padStart(2, '0')}`);
            }
            if (initialEvent.opening_time) {
                const openTime = new Date(initialEvent.opening_time);
                setOpeningTime(`${openTime.getHours().toString().padStart(2, '0')}:${openTime.getMinutes().toString().padStart(2, '0')}`);
            }
            if (initialEvent.features) {
                setFeatures({ ...DEFAULT_FEATURES, ...initialEvent.features });
            }
        }
    }, [initialEvent]);

    const handleSubmit = async () => {
        if (!name || !date) {
            setMessage('الرجاء تعبئة الحقول المطلوبة');
            return;
        }

        // Validate: activation time required when time restriction is enabled
        if (features.qr_time_restricted && !activationTime) {
            setMessage('⚠️ يجب تحديد وقت تفعيل الباركود عند تفعيل التقييد الزمني');
            return;
        }

        // Validate: Host PIN required when PIN feature is enabled
        if (features.enable_host_pin && (!hostPin || hostPin.length < 4)) {
            setMessage('⚠️ يجب إدخال رقم سري مكون من 4 أرقام على الأقل');
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

            let error;
            if (initialEvent) {
                const { error: updateError } = await supabase
                    .from('events')
                    .update({
                        name, date, venue,
                        host_pin: features.enable_host_pin ? hostPin : null,
                        activation_time: activationTimestamp,
                        opening_time: openingTimestamp,
                        qr_active_from: activationTimestamp,
                        qr_active_until: activationTimestamp ? new Date(new Date(activationTimestamp).getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
                        qr_activation_enabled: !!features.qr_time_restricted,
                        country, features: features,
                        settings: { ...initialEvent.settings, qr_fields: { ...qrSettings, show_custom: [] }, whatsapp_settings: whatsappSettings, portal_settings: {} }
                    })
                    .eq('id', initialEvent.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('events')
                    .insert({
                        name, date, venue, token,
                        host_pin: features.enable_host_pin ? hostPin : null,
                        activation_time: activationTimestamp,
                        opening_time: openingTimestamp,
                        qr_active_from: activationTimestamp,
                        qr_active_until: activationTimestamp ? new Date(new Date(activationTimestamp).getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
                        qr_activation_enabled: !!features.qr_time_restricted,
                        country, features: features,
                        settings: { qr_fields: { ...qrSettings, show_custom: [] }, whatsapp_settings: whatsappSettings, portal_settings: {} }
                    });
                error = insertError;
            }

            if (error) throw error;

            if (!initialEvent) {
                setGeneratedToken(token);
                setName(''); setDate(''); setVenue(''); setActivationTime(''); setOpeningTime('13:00'); setHostPin(''); setFeatures(DEFAULT_FEATURES);
                setQrSettings({ show_name: true, show_table: true, show_companions: true, show_category: false });
                setWhatsappSettings({ enable_48h_report: true, enable_no_reply_reminder: true, enable_pre_event_reminder: true, pre_event_reminder_days: 2 });
            }

            setMessage(initialEvent ? 'تم تحديث الحدث بنجاح' : 'تم إنشاء الحدث بنجاح');
            if (onSuccess) onSuccess();

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
                <h1 className="text-3xl font-bold text-lony-navy font-amiri">{initialEvent ? 'تعديل الحدث' : 'إعداد الحدث الجديد'}</h1>
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

                    <Card className="border-none shadow-xl bg-white/80 backdrop-blur">
                        <CardHeader className="border-b border-gray-100 pb-4">
                            <CardTitle className="text-xl text-lony-navy flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-lony-gold" />
                                إعدادات الأتمتة والواتساب
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <p className="text-sm text-gray-500 mb-4">اختر الخصائص التلقائية التي تود تفعيلها لهذه المناسبة:</p>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <div>
                                    <span className="block font-medium text-gray-700">تقرير الـ 48 ساعة</span>
                                    <span className="block text-xs text-gray-500">إرسال تقرير ملخص لصاحب المناسبة بعد 48 ساعة من الإطلاق</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={whatsappSettings.enable_48h_report}
                                    onChange={(e) => setWhatsappSettings({ ...whatsappSettings, enable_48h_report: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-white border border-lony-gold/20 rounded-lg cursor-pointer hover:bg-lony-gold/5 transition-colors">
                                <div className="flex-1">
                                    <span className="block font-semibold text-lony-navy">نمط الإرسال المباشر (بدون اعتذار)</span>
                                    <span className="block text-xs text-gray-500">إرسال كرت الدعوة فوراً للضيف دون طلب تأكيد أو اعتذار</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={whatsappSettings.enable_direct_send}
                                    onChange={(e) => setWhatsappSettings({ ...whatsappSettings, enable_direct_send: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold ml-3"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <div>
                                    <span className="block font-medium text-gray-700">تذكير "عدم الرد"</span>
                                    <span className="block text-xs text-gray-500">مراسلة الضيوف الذين لم يجيبوا بعد 24 ساعة للرد بنعم أو لا</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={whatsappSettings.enable_no_reply_reminder}
                                    onChange={(e) => setWhatsappSettings({ ...whatsappSettings, enable_no_reply_reminder: e.target.checked })}
                                    className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                />
                            </label>

                            <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <span className="block font-medium text-gray-700">تذكير المؤكدين قبل المناسبة</span>
                                        <span className="block text-xs text-gray-500">إرسال تذكير أوتوماتيكي للضيوف المؤكدين بموعد المناسبة</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={whatsappSettings.enable_pre_event_reminder}
                                        onChange={(e) => setWhatsappSettings({ ...whatsappSettings, enable_pre_event_reminder: e.target.checked })}
                                        className="w-5 h-5 text-lony-navy rounded focus:ring-lony-gold"
                                    />
                                </label>

                                {whatsappSettings.enable_pre_event_reminder && (
                                    <div className="flex items-center gap-3 pt-2 border-t border-gray-200 mt-2">
                                        <span className="text-sm font-medium text-gray-600">قبل</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="14"
                                            value={whatsappSettings.pre_event_reminder_days}
                                            onChange={(e) => setWhatsappSettings({ ...whatsappSettings, pre_event_reminder_days: parseInt(e.target.value) || 2 })}
                                            className="w-20 px-3 py-1 bg-white border border-gray-200 rounded text-center focus:ring-2 focus:ring-lony-gold"
                                        />
                                        <span className="text-sm font-medium text-gray-600">أيام من موعد الحدث</span>
                                    </div>
                                )}
                            </div>
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
                        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (initialEvent ? 'حفظ التغييرات' : 'إنشاء الحدث')}
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
