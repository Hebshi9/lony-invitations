import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderDetails from './pages/OrderDetails';
import AdminEventsPanel from './pages/AdminEventsPanel';
import UploadGuests from './pages/UploadGuests';

import UnifiedInvitationStudio from './pages/UnifiedInvitationStudio';
import InvitationStudio from './pages/InvitationStudio';
import ClientDashboard from './pages/ClientDashboard';
import Scanner from './pages/Scanner';
import EventScanner from './pages/EventScanner';
import GuestVerification from './pages/GuestVerification';
import VerifyGuest from './pages/VerifyGuest';
import InspectorLogin from './pages/InspectorLogin';
import GuestView from './pages/GuestView';
import ClientIntake from './pages/ClientIntake';
import GuestLanding from './pages/GuestLanding';
import SecureGate from './pages/SecureGate';
import { XCircle } from 'lucide-react';

import WhatsAppSender from './pages/WhatsAppSender';
import WhatsAppSenderTest from './pages/WhatsAppSenderTest';
import WhatsAppSenderCustom from './pages/WhatsAppSenderCustom';
import SalesAI from './pages/SalesAI';
import ExternalCardsUpload from './pages/ExternalCardsUpload';
import QuickWhatsAppUpload from './pages/QuickWhatsAppUpload';
import CampaignCenter from './pages/CampaignCenter';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import FinancialHub from './pages/FinancialHub';
import AIOperations from './pages/AIOperations';
import BusinessLedger from './pages/BusinessLedger';
import EventSummary from './pages/EventSummary';
import RSVPDashboard from './pages/RSVPDashboard';
import DemoExperience from './pages/DemoExperience';

import Login from './pages/Login';
import { Loader2 } from 'lucide-react';


const AppContent: React.FC = () => {
    const location = useLocation();
    const { user, loading, signOut } = useAuth();

    // Only essential guest-facing routes are public
    const publicRoutes = ['/v/', '/s/', '/invite/', '/host/', '/client-dashboard/', '/client/dashboard/', '/intake/'];
    const isPublic = publicRoutes.some(path => location.pathname.startsWith(path));

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    // Public routes (no auth needed)
    if (isPublic) {
        return (
            <Routes>
                <Route path="/host/:magicToken" element={<ClientDashboard />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/scanner/:token" element={<EventScanner />} />
                <Route path="/v/:qr_token" element={<GuestView />} />
                <Route path="/s/:token" element={<SecureGate />} />
                <Route path="/verify/:guestId" element={<GuestVerification />} />
                <Route path="/invite/:uuid" element={<GuestLanding />} />
                <Route path="/verify-scan/:id" element={<VerifyGuest />} />
                <Route path="/inspector" element={<InspectorLogin />} />
                <Route path="/intake/:token" element={<ClientIntake />} />
                <Route path="/demo" element={<DemoExperience />} />
                <Route path="/client-dashboard/:orderId" element={<ClientDashboard />} />
                <Route path="/client/dashboard/:orderId" element={<ClientDashboard />} />
            </Routes>
        );
    }

    // Protected routes (require authentication)
    if (!user) {
        return <Login />;
    }

    // --- ELITE LOCK LOGIC ---
    const userEmail = (user?.email || '').toLowerCase().trim();
    const isAuthorized = userEmail === 'projectju18@gmail.com' || userEmail === 'saraaljefry@gmail.com';

    if (user && !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 text-center" dir="rtl">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border-2 border-red-200 max-w-md">
                    <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-black text-red-700 mb-4">هذا النظام خاص ومحمي</h1>
                    <p className="text-gray-600 leading-relaxed mb-2">
                        عذراً، البريد الإلكتروني <span className="font-bold text-red-600">({user.email})</span> غير مصرح له بالدخول.
                    </p>
                    <p className="text-gray-400 text-xs mb-6 italic">
                        (إذا كان هذا البريد صحيحاً، يرجى إبلاغ المطور لإضافته للقائمة البيضاء)
                    </p>
                    <button 
                        onClick={() => signOut()}
                        className="w-full py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition"
                    >
                        خروج فوراً
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Layout>
            <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/orders/:id" element={<OrderDetails />} />
                <Route path="/admin/events" element={<AdminEventsPanel />} />
                <Route path="/upload-guests" element={<UploadGuests />} />
                <Route path="/studio" element={<UnifiedInvitationStudio />} />
                <Route path="/studio-new" element={<InvitationStudio />} />

                <Route path="/whatsapp-sender" element={<WhatsAppSender />} />
                <Route path="/sender-test" element={<WhatsAppSenderTest />} />
                <Route path="/sender-custom" element={<WhatsAppSenderCustom />} />
                <Route path="/sales-ai" element={<SalesAI />} />
                <Route path="/quick-upload" element={<QuickWhatsAppUpload />} />
                <Route path="/external-upload" element={<ExternalCardsUpload />} />
                <Route path="/campaigns" element={<CampaignCenter />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/financial-hub" element={<FinancialHub />} />
                <Route path="/ai-operations" element={<AIOperations />} />
                <Route path="/business-ledger" element={<BusinessLedger />} />
                <Route path="/event-summary/:eventId" element={<EventSummary />} />
                <Route path="/rsvp-dashboard" element={<RSVPDashboard />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Layout>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
