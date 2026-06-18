import { lazy, Suspense } from "react";
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

// Landing carregada eager (LCP da home)
import Index from "./pages/Index";

// Demais rotas lazy — reduz bundle inicial drasticamente
const Welcome = lazy(() => import("./pages/Welcome"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Library = lazy(() => import("./pages/Library"));
const Reader = lazy(() => import("./pages/Reader"));
const Summary = lazy(() => import("./pages/Summary"));
const Share = lazy(() => import("./pages/Share"));
const SharedBook = lazy(() => import("./pages/SharedBook"));
const Profile = lazy(() => import("./pages/Profile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Download = lazy(() => import("./pages/Download"));
const Install = lazy(() => import("./pages/Install"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const AdminAuditLogs = lazy(() => import("./pages/AdminAuditLogs"));
const AdminBlockedIPs = lazy(() => import("./pages/AdminBlockedIPs"));
const Achievements = lazy(() => import("./pages/Achievements"));
const AcademicSummary = lazy(() => import("./pages/AcademicSummary"));
const Guide = lazy(() => import("./pages/Guide"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Demo = lazy(() => import("./pages/Demo"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SentryRoutes = Sentry.withSentryRouting(Routes);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppContent = () => {
  // Hook para detectar e gerenciar instalação PWA
  usePWAInstallPrompt();
  // Banner AdMob (apenas em build nativo iOS/Android e para usuários free)
  useAdMobBanner();

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <SentryRoutes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Navigate to="/library" replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/library" element={<Library />} />
          <Route path="/reader/:id" element={<Reader />} />
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="/share/:id" element={<Share />} />
          <Route path="/shared/:token" element={<SharedBook />} />
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
          <Route path="/guia" element={<Guide />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/demo" element={<Demo />} />



          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </SentryRoutes>
      </Suspense>
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
