import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Mail, Lock, Loader2, LogIn, UserPlus } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { signIn, signUp } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (isSignUp) {
                await signUp(email, password);
                setSuccess('✅ تم إنشاء الحساب! تحقق من بريدك الإلكتروني للتفعيل');
                setEmail('');
                setPassword('');
            } else {
                await signIn(email, password);
            }
        } catch (err: any) {
            const errorMessage = err.message || 'حدث خطأ';

            // Friendly error messages
            if (errorMessage.includes('Invalid login credentials')) {
                setError('❌ البريد الإلكتروني أو كلمة المرور غير صحيحة');
            } else if (errorMessage.includes('Email not confirmed')) {
                setError('⚠️ يرجى تفعيل حسابك من البريد الإلكتروني');
            } else if (errorMessage.includes('User already registered')) {
                setError('⚠️ هذا البريد مسجل بالفعل. حاول تسجيل الدخول');
            } else {
                setError(`❌ ${errorMessage}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4" dir="rtl">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <div className="text-6xl mb-4">🎨</div>
                    <CardTitle className="text-3xl font-black bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent italic">
                        بوابة لوني الآمنة
                    </CardTitle>
                    <p className="text-gray-500 text-sm mt-2 font-bold">
                        خاص بمسؤولي النظام والمصممين فقط
                    </p>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Mail className="w-4 h-4 inline ml-1" />
                                البريد الإلكتروني
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="example@email.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Lock className="w-4 h-4 inline ml-1" />
                                كلمة المرور
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="••••••••"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                            {isSignUp && (
                                <p className="text-xs text-gray-500 mt-1">
                                    6 أحرف على الأقل
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                                {success}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 text-lg font-semibold shadow-lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin ml-2" />
                                    جاري التحقق...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5 ml-2" />
                                    دخول الإدارة
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
