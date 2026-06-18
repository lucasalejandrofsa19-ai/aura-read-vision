import { Link, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";

const HIDDEN_PREFIXES = ["/reader", "/admin"];

const GlobalFooter = () => {
  const { pathname } = useLocation();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container max-w-screen-2xl mx-auto px-4 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} AURA READ</p>
        <nav className="flex items-center gap-4">
          <Link
            to="/trust"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Segurança e Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
};

export default GlobalFooter;
