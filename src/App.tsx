import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SentryUserContext } from "./components/SentryUserContext";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import { useAdMobBanner } from "@/hooks/useAdMobBanner";
import { UpdateNotification } from "@/components/UpdateNotification";
import { AppHealthMonitor } from "@/components/AppHealthMonitor";
import { StickyAdBanner } from "@/components/StickyAdBanner";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import * as Sentry from "@sentry/react";
import Index from "./pages/Index";
import { Navigate } from "react-router-dom";
import Welcome from "./pages/Welcome";
import ResetPassword from "./pages/ResetPassword";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Summary from "./pages/Summary";
import Share from "./pages/Share";
import Profile from "./pages/Profile";
import Pricing from "./pages/Pricing";
import Download from "./pages/Download";
import Install from "./pages/Install";
import AdminPanel from "./pages/AdminPanel";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminFeedback from "./pages/AdminFeedback";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import AdminBlockedIPs from "./pages/AdminBlockedIPs";
import Achievements from "./pages/Achievements";
import AcademicSummary from "./pages/AcademicSummary";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const SentryRoutes = Sentry.withSentryRouting(Routes);

const AppContent = () => {
  // Hook para detectar e gerenciar instalação PWA
  usePWAInstallPrompt();
  // Banner AdMob (apenas em build nativo iOS/Android e para usuários free)
  useAdMobBanner();

  return (
    <>
      <SentryRoutes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Navigate to="/library" replace />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/library" element={<Library />} />
        <Route path="/reader/:id" element={<Reader />} />
        <Route path="/summary/:id" element={<Summary />} />
        <Route path="/share/:id" element={<Share />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/download" element={<Download />} />
        <Route path="/install" element={<Install />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/feedback" element={<AdminFeedback />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
        <Route path="/admin/blocked-ips" element={<AdminBlockedIPs />} />
        <Route path="/conquistas" element={<Achievements />} />
        <Route path="/resumo-academico" element={<AcademicSummary />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </SentryRoutes>
      <StickyAdBanner />
      <CookieConsentBanner />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdateNotification />
      <AppHealthMonitor />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <SentryUserContext>
              <AppContent />
            </SentryUserContext>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
