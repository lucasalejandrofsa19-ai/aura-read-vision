import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  getLinkStatusEntries,
  clearLinkStatusEntries,
  collectEnvSnapshot,
  type LinkStatusEntry,
  type LinkStatusEnvSnapshot,
} from "@/lib/linkStatusLog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const levelColor: Record<LinkStatusEntry["level"], string> = {
  error: "destructive",
  unhandled: "destructive",
  warn: "secondary",
  info: "outline",
  resource: "destructive",
} as unknown as Record<LinkStatusEntry["level"], string>;

const fmt = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
};

const LinkStatus = () => {
  const [entries, setEntries] = useState<LinkStatusEntry[]>([]);
  const [env, setEnv] = useState<LinkStatusEnvSnapshot | null>(null);

  const refresh = () => setEntries(getLinkStatusEntries().slice().reverse());

  useEffect(() => {
    refresh();
    collectEnvSnapshot().then(setEnv);
    const id = window.setInterval(refresh, 2000);
    return () => window.clearInterval(id);
  }, []);

  const payload = () => JSON.stringify({ env, entries: getLinkStatusEntries() }, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload());
      toast.success("Diagnóstico copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const handleClear = () => {
    clearLinkStatusEntries();
    refresh();
    toast.success("Log limpo");
  };

  return (
    <>
      <Helmet>
        <title>Status do link — Aura Read</title>
        <meta name="description" content="Diagnóstico de carregamento do Aura Read: erros, ambiente e informações do dispositivo." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <header className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Status do link</h1>
              <p className="text-sm text-muted-foreground">
                Diagnóstico local de carregamento. Nada é enviado a servidores externos.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refresh}>Atualizar</Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>Copiar</Button>
              <Button variant="destructive" size="sm" onClick={handleClear}>Limpar</Button>
            </div>
          </header>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Ambiente</h2>
            {env ? (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div><dt className="inline text-muted-foreground">URL: </dt><dd className="inline break-all">{env.url}</dd></div>
                <div><dt className="inline text-muted-foreground">Referrer: </dt><dd className="inline break-all">{env.referrer || "—"}</dd></div>
                <div className="md:col-span-2"><dt className="inline text-muted-foreground">User-Agent: </dt><dd className="inline break-all">{env.userAgent}</dd></div>
                <div><dt className="inline text-muted-foreground">Idioma: </dt><dd className="inline">{env.language}</dd></div>
                <div><dt className="inline text-muted-foreground">Online: </dt><dd className="inline">{String(env.online)}</dd></div>
                <div><dt className="inline text-muted-foreground">Viewport: </dt><dd className="inline">{env.viewport} @ {env.dpr}x</dd></div>
                <div><dt className="inline text-muted-foreground">Cookies: </dt><dd className="inline">{String(env.cookieEnabled)}</dd></div>
                <div><dt className="inline text-muted-foreground">localStorage: </dt><dd className="inline">{String(env.storage.localStorage)}</dd></div>
                <div><dt className="inline text-muted-foreground">sessionStorage: </dt><dd className="inline">{String(env.storage.sessionStorage)}</dd></div>
                <div><dt className="inline text-muted-foreground">Standalone (PWA): </dt><dd className="inline">{String(env.standalone)}</dd></div>
                <div><dt className="inline text-muted-foreground">Service Worker: </dt><dd className="inline">{env.serviceWorker.supported ? `${env.serviceWorker.registrations} reg.` : "não suportado"}</dd></div>
                {env.serviceWorker.controllerScope && (
                  <div className="md:col-span-2"><dt className="inline text-muted-foreground">SW controller: </dt><dd className="inline break-all">{env.serviceWorker.controllerScope}</dd></div>
                )}
                {env.connection && (
                  <div className="md:col-span-2">
                    <dt className="inline text-muted-foreground">Conexão: </dt>
                    <dd className="inline">
                      {env.connection.effectiveType ?? "?"} · {env.connection.downlink ?? "?"} Mbps · rtt {env.connection.rtt ?? "?"}ms
                      {env.connection.saveData ? " · saveData" : ""}
                    </dd>
                  </div>
                )}
                <div><dt className="inline text-muted-foreground">Timestamp: </dt><dd className="inline">{env.timestamp}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Coletando ambiente…</p>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Eventos capturados</h2>
              <span className="text-xs text-muted-foreground">{entries.length} entrada(s), mais recente primeiro</span>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum erro capturado. Se o link falhou em outro dispositivo, abra <code>/status</code> lá logo após reproduzir a falha.
              </p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e, i) => (
                  <li key={i} className="border border-border rounded-md p-3 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={(levelColor[e.level] as never) || "secondary"}>{e.level}</Badge>
                      <span className="text-muted-foreground text-xs">{fmt(e.ts)}</span>
                    </div>
                    <p className="mt-1 font-medium break-words">{e.message}</p>
                    {(e.source || e.line != null) && (
                      <p className="text-xs text-muted-foreground break-all mt-1">
                        {e.source}{e.line != null ? `:${e.line}${e.column != null ? `:${e.column}` : ""}` : ""}
                      </p>
                    )}
                    {e.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">stack</summary>
                        <pre className="text-xs mt-1 whitespace-pre-wrap break-all bg-muted/50 p-2 rounded">{e.stack}</pre>
                      </details>
                    )}
                    {e.url && (
                      <p className="text-xs text-muted-foreground break-all mt-1">em {e.url}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="text-center pt-2">
            <Link to="/" className="text-sm text-primary underline">Voltar ao início</Link>
          </div>
        </div>
      </main>
    </>
  );
};

export default LinkStatus;
