import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Wand2, QrCode, MessageCircle, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();

    const navigation = [
        { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
        { name: 'الإحصائيات', href: '/analytics', icon: BarChart3 },
        { name: 'إعداد الحدث', href: '/event', icon: Calendar },
        { name: 'قائمة الضيوف', href: '/upload-guests', icon: Users },
        { name: 'استوديو الدعوات', href: '/studio', icon: Wand2 },
        { name: 'إرسال واتساب', href: '/whatsapp', icon: MessageCircle },
        { name: 'الماسح الضوئي', href: '/scanner', icon: QrCode },
    ];

    return (
        <div className="min-h-screen bg-lony-sand flex flex-row-reverse font-kufi" dir="rtl">
            {/* Sidebar */}
            <aside className="w-72 bg-lony-navy text-white hidden md:flex flex-col shadow-2xl">
                <div className="p-8 text-center border-b border-white/10">
                    <h1 className="text-3xl font-bold text-lony-gold font-amiri tracking-wider">Lony Pro</h1>
                    <p className="text-xs text-gray-400 mt-2 tracking-widest uppercase">Luxury Invitations</p>
                </div>

                <nav className="flex-1 mt-8 px-4 space-y-3">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    'flex items-center gap-4 px-6 py-4 rounded-xl text-sm font-medium transition-all duration-300 flex-row-reverse group',
                                    isActive
                                        ? 'bg-lony-gold text-lony-navy shadow-lg translate-x-[-4px]'
                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                )}
                            >
                                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-lony-navy" : "text-lony-gold")} />
                                <span className="text-base">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-white/10">
                    <div className="bg-white/5 rounded-lg p-4 text-center">
                        <p className="text-xs text-gray-400">نسخة تجريبية v1.0</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto bg-lony-sand">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
