import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InspectorLogin: React.FC = () => {
    const [code, setCode] = useState('');
    const navigate = useNavigate();

    const handleLogin = () => {
        // Simple protection for now - in production use real Auth
        if (code === '1234') { // Default PIN
            localStorage.setItem('lony_inspector_mode', 'true');
            alert('تم تفعيل وضع المفتش بنجاح! الآن يمكنك مسح الأكواد بكاميرا الجوال.');
            navigate('/dashboard');
        } else {
            alert('رمز غير صحيح');
        }
    };

    return (
        <div className="min-h-screen bg-lony-navy flex items-center justify-center p-4 font-kufi" dir="rtl">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <ShieldCheck className="w-16 h-16 text-lony-gold mx-auto mb-4" />
                    <CardTitle>دخول المفتشين</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-center text-gray-500 text-sm">
                        أدخل رمز المرور لتفعيل أدوات التفتيش على هذا الجهاز.
                    </p>
                    <input
                        type="password"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="رمز المرور"
                        className="w-full p-3 border rounded-lg text-center text-2xl tracking-widest"
                    />
                    <Button onClick={handleLogin} className="w-full bg-lony-gold text-lony-navy font-bold py-4">
                        تفعيل
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default InspectorLogin;
