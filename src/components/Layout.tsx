import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, Calendar, Users, Wand2, QrCode, 
    MessageCircle, BarChart3, Bot, Megaphone, Wallet, 
    Sparkles, Briefcase, Activity, LogOut, User as UserIcon,
    Menu, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navigation = [
        { name: 'لوحة التحكم', href: '/dashboard', icon: LayoutDashboard },
        { name: 'المركز الاستراتيجي', href: '/financial-hub', icon: Activity },
        { name: 'السجل المالي', href: '/business-ledger', icon: Briefcase },

        { name: 'إدارة المناسبات', href: '/admin/events', icon: Calendar },
        { name: 'قائمة الضيوف', href: '/upload-guests', icon: Users },
        { name: 'استوديو الدعوات', href: '/studio', icon: Wand2 },
        { name: 'إرسال واتساب', href: '/whatsapp-sender', icon: MessageCircle },
        { name: 'مركز الحملات', href: '/campaigns', icon: Megaphone },
        { name: 'Sales AI 🤖', href: '/sales-ai', icon: Bot },
        { name: 'الماسح الضوئي', href: '/scanner', icon: QrCode },
    ];

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-lony-sand flex flex-col md:flex-row font-kufi overflow-hidden" dir="rtl">
            {/* Mobile Header */}
            <div className="md:hidden bg-lony-navy p-4 flex items-center justify-between shadow-lg sticky top-0 z-50 h-16">
                <button 
                    onClick={toggleSidebar}
                    className="p-2 text-lony-gold hover:bg-white/10 rounded-lg transition-colors"
                >
                    {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
                <div className="flex flex-col items-end">
                    <h1 className="text-xl font-bold text-lony-gold font-amiri tracking-wider leading-none">Lony Pro</h1>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Luxury Invitations</p>
                </div>
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={cn(
                "bg-lony-navy text-white flex flex-col shadow-2xl transition-all duration-500 z-50 fixed inset-y-0 right-0 md:relative md:translate-x-0 h-full",
                isSidebarOpen ? "translate-x-0" : "translate-x-full",
                isCollapsed ? "md:w-16" : "md:w-60 w-60"
            )}>
                {/* Collapse Toggle Button (Desktop Only) */}
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -left-3 top-10 bg-lony-gold text-lony-navy w-6 h-6 rounded-full hidden md:flex items-center justify-center shadow-lg border-2 border-lony-navy hover:scale-110 transition-transform z-[60]"
                >
                    {isCollapsed ? <X size={14} className="rotate-45" /> : <X size={14} />}
                </button>

                <div className={cn(
                    "p-4 text-center border-b border-white/10 hidden md:block transition-opacity duration-300",
                    isCollapsed ? "opacity-0 h-0 p-0 overflow-hidden" : "opacity-100"
                )}>
                    <h1 className="text-xl font-bold text-lony-gold font-amiri tracking-wider">Lony Pro</h1>
                    <p className="text-[10px] text-gray-400 mt-1 tracking-widest uppercase">Luxury Invitations</p>
                </div>

                <nav className="flex-1 mt-8 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={cn(
                                    'flex items-center gap-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group overflow-hidden',
                                    isCollapsed ? 'px-3 justify-center' : 'px-6',
                                    isActive
                                        ? 'bg-lony-gold text-lony-navy shadow-lg scale-[1.02]'
                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                )}
                            >
                                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-lony-navy" : "text-lony-gold")} />
                                {!isCollapsed && <span className="text-base text-right flex-1 whitespace-nowrap">{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                    <div className={cn(
                        "flex items-center gap-3 py-3 bg-white/5 rounded-2xl border border-white/5 overflow-hidden transition-all",
                        isCollapsed ? "px-2 justify-center" : "px-4"
                    )}>
                        <div className="w-10 h-10 min-w-[40px] rounded-full bg-lony-gold/20 flex items-center justify-center border border-lony-gold/30">
                            <UserIcon className="w-5 h-5 text-lony-gold" />
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 overflow-hidden text-right">
                                <p className="text-xs text-lony-gold font-bold">المستخدم الحالي</p>
                                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => signOut()}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-300 border border-transparent hover:border-red-500/20",
                            isCollapsed ? "" : "px-4"
                        )}
                    >
                        <LogOut className="w-4 h-4" />
                        {!isCollapsed && <span className="text-sm font-bold">تسجيل الخروج</span>}
                    </button>

                    {!isCollapsed && (
                        <div className="text-center">
                            <p className="text-[10px] text-gray-500 font-bold tracking-widest">LONY PRO v1.8</p>
                        </div>
                    )}
            </aside>

            {/* Main Content */}
            <main className={cn(
                "flex-1 overflow-y-auto bg-lony-sand h-[calc(100vh-64px)] md:h-screen transition-all duration-300",
                (location.pathname === '/whatsapp-sender' || location.pathname === '/sender-test' || location.pathname === '/sender-custom') ? "p-0" : "p-2 md:p-4"
            )}>
                <div className={cn(
                    (location.pathname === '/whatsapp-sender' || location.pathname === '/sender-test' || location.pathname === '/sender-custom') ? "w-full" : "max-w-7xl mx-auto"
                )}>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
