import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderDetails from './pages/OrderDetails';
import EventManager from './pages/EventManager';
import UploadGuests from './pages/UploadGuests';

import UnifiedInvitationStudio from './pages/UnifiedInvitationStudio';
import ClientLogin from './pages/ClientLogin';
import ClientDashboard from './pages/ClientDashboard';
import Scanner from './pages/Scanner';
import EventScanner from './pages/EventScanner';
import GuestVerification from './pages/GuestVerification';
import VerifyGuest from './pages/VerifyGuest';
import InspectorLogin from './pages/InspectorLogin';
import GuestView from './pages/GuestView';
import ClientIntake from './pages/ClientIntake';
import GuestLanding from './pages/GuestLanding';
import WhatsAppHub from './pages/WhatsAppHub';
import WhatsAppSender from './pages/WhatsAppSender';
import ExternalCardsUpload from './pages/ExternalCardsUpload';
import QuickWhatsAppUpload from './pages/QuickWhatsAppUpload';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import EventSummary from './pages/EventSummary';

import Login from './pages/Login';
import { Loader2 } from 'lucide-react';


const AppContent: React.FC = () => {
    const location = useLocation();
    const { user, loading } = useAuth();

    // Routes that don't need authentication (public routes)
    const publicRoutes = ['/client/', '/portal/', '/scanner', '/v/', '/invite/', '/intake', '/inspector', '/verify-scan/'];
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
                <Route path="/client/login" element={<ClientLogin />} />
                <Route path="/client/dashboard/:eventId" element={<ClientDashboard />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/scanner/:token" element={<EventScanner />} />
                <Route path="/v/:qr_token" element={<GuestView />} />
                <Route path="/verify/:guestId" element={<GuestVerification />} />
                <Route path="/invite/:uuid" element={<GuestLanding />} />
                <Route path="/verify-scan/:id" element={<VerifyGuest />} />
                <Route path="/inspector" element={<InspectorLogin />} />
                <Route path="/intake" element={<ClientIntake />} />
                <Route path="/portal/:orderId" element={<ClientDashboard />} />
                <Route path="/client-dashboard/:orderId" element={<ClientDashboard />} />
            </Routes>
        );
    }

    // Protected routes (require authentication)
    if (!user) {
        return <Login />;
    }

    return (
        <Layout>
            <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/orders/:id" element={<OrderDetails />} />
                <Route path="/event" element={<EventManager />} />
                <Route path="/upload-guests" element={<UploadGuests />} />
                <Route path="/studio" element={<UnifiedInvitationStudio />} />
                <Route path="/whatsapp" element={<WhatsAppHub />} />
                <Route path="/whatsapp-sender" element={<WhatsAppSender />} />
                <Route path="/quick-upload" element={<QuickWhatsAppUpload />} />
                <Route path="/external-upload" element={<ExternalCardsUpload />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/event-summary/:eventId" element={<EventSummary />} />
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
