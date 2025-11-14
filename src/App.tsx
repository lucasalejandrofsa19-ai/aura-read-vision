import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SentryUserContext } from "./components/SentryUserContext";
import * as Sentry from "@sentry/react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Summary from "./pages/Summary";
import Share from "./pages/Share";
import Profile from "./pages/Profile";
import Pricing from "./pages/Pricing";
import Download from "./pages/Download";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const SentryRoutes = Sentry.withSentryRouting(Routes);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <SentryUserContext>
              <SentryRoutes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/library" element={<Library />} />
              <Route path="/reader/:id" element={<Reader />} />
              <Route path="/summary/:id" element={<Summary />} />
              <Route path="/share/:id" element={<Share />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/download" element={<Download />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </SentryRoutes>
            </SentryUserContext>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
