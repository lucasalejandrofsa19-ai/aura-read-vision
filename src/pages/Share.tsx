import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function randomToken(len = 32) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const Share = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (!user) {
      setError("Faça login para gerar um link de compartilhamento.");
      setCreating(false);
      return;
    }
    (async () => {
      setCreating(true);
      setError(null);
      try {
        // Reusa um link existente válido (>1 dia restante), senão cria um novo.
        const { data: existing } = await supabase
          .from("book_shares")
          .select("token, expires_at")
          .eq("book_id", id)
          .eq("created_by", user.id)
          .gt("expires_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let token = existing?.token as string | undefined;
        let exp = existing?.expires_at as string | undefined;

        if (!token) {
          token = randomToken(24);
          const { data: inserted, error: insertErr } = await supabase
            .from("book_shares")
            .insert({ book_id: id, token, created_by: user.id })
            .select("token, expires_at")
            .single();
          if (insertErr) throw insertErr;
          token = inserted.token;
          exp = inserted.expires_at;
        }

        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://auraread.store";
        setShareUrl(`${origin}/shared/${token}`);
        setExpiresAt(exp ?? null);
      } catch (e: any) {
        console.error("[Share] error creating share link", e);
        setError(e?.message || "Não foi possível gerar o link de compartilhamento.");
      } finally {
        setCreating(false);
      }
    })();
  }, [id, user]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <SEO
        title="Compartilhar Livro — AURA READ"
        description="Gere um link e QR Code públicos para compartilhar este livro."
        path={`/share/${id ?? ""}`}
        noindex
      />
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/reader/${id}`)}
            className="mb-4 aura-soft transition-aura"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="glass rounded-2xl p-8 aura-soft text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mb-6"
            >
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                Compartilhar Livro
              </h1>
              <p className="text-sm text-muted-foreground">
                Qualquer pessoa com o link poderá visualizar — sem precisar de conta.
              </p>
            </motion.div>

            {creating && (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando link público…</p>
              </div>
            )}

            {!creating && error && (
              <div className="py-8 flex flex-col items-center gap-3">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            {!creating && !error && shareUrl && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white p-6 rounded-xl inline-block mb-6 aura-safira"
                >
                  <QRCodeSVG
                    value={shareUrl}
                    size={200}
                    level="H"
                    includeMargin
                    fgColor="#1a1f2e"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-sm text-muted-foreground mb-4">
                    Escaneie o QR Code ou copie o link abaixo
                  </p>

                  <div className="flex gap-2">
                    <div className="flex-1 glass rounded-lg px-4 py-3 text-xs text-left truncate border border-primary/20">
                      {shareUrl}
                    </div>
                    <Button
                      size="icon"
                      onClick={handleCopy}
                      className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity aura-safira"
                      aria-label="Copiar link"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-4">
                    {expiresLabel
                      ? `Link válido até ${expiresLabel}. Não é preciso ter o app para visualizar.`
                      : "Não é necessário ter o app para visualizar."}
                  </p>
                </motion.div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Share;
