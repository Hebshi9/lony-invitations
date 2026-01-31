import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { KeyRound, ArrowRight } from 'lucide-react';

const ClientLogin: React.FC = () => {
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase
                .from('events')
                .select('id')
                .eq('token', token)
                .single();

            if (error || !data) {
                setError('رمز الدخول غير صحيح');
            } else {
                navigate(`/client/dashboard/${data.id}`);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('حدث خطأ أثناء تسجيل الدخول');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                        <KeyRound className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">بوابة العملاء</CardTitle>
                    <p className="text-gray-500">أدخل رمز الحدث للوصول إلى الإحصائيات</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="token" className="block text-sm font-medium text-gray-700 text-right">
                                رمز الحدث
                            </label>
                            <input
                                id="token"
                                type="text"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-md text-center text-lg tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="XXXX-XXXX"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md text-center">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full gap-2 flex-row-reverse"
                            disabled={loading}
                        >
                            {loading ? 'جاري التحقق...' : 'دخول'}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ClientLogin;
