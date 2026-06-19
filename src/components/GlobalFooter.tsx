import { useId } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Tag, BookOpen, FileText, ExternalLink } from "lucide-react";
import { PUBLIC_PDFS_LABEL, PUBLIC_PDFS_TOOLTIP, PUBLIC_PDFS_DESCRIPTION } from "@/lib/publicPdfs";

const HIDDEN_PREFIXES = ["/reader", "/admin"];

const GlobalFooter = () => {
  const { pathname } = useLocation();
  const publicPdfsDescId = useId();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container max-w-screen-2xl mx-auto px-4 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} AURA READ</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Tag className="h-3.5 w-3.5" />
            Pricing
          </Link>
          <Link
            to="/guia"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Guia
          </Link>
          <a
            href="/pdfs-publicos"
            target="_blank"
            rel="noopener noreferrer"
            title={PUBLIC_PDFS_TOOLTIP}
            aria-label={PUBLIC_PDFS_TOOLTIP}
            aria-describedby={publicPdfsDescId}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            {PUBLIC_PDFS_LABEL}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span id={publicPdfsDescId} className="sr-only">{PUBLIC_PDFS_DESCRIPTION}</span>
          </a>
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
