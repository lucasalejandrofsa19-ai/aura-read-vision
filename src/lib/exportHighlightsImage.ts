import html2canvas from "html2canvas";

interface HighlightItem {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const sanitizeFilename = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "destaques";

/**
 * Exporta a lista de destaques como uma imagem PNG (poster vertical).
 * Renderiza um node offscreen estilizado e captura via html2canvas.
 */
export const exportHighlightsAsImage = async (
  bookTitle: string,
  highlights: HighlightItem[]
): Promise<void> => {
  if (!highlights.length) throw new Error("Nenhum destaque para exportar");

  // Limitamos a 60 destaques por imagem para manter legibilidade
  const items = highlights.slice(0, 60);

  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    "width:900px",
    "padding:48px",
    "background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",
    "color:#f8fafc",
    "font-family:'Inter','Segoe UI',system-ui,sans-serif",
    "box-sizing:border-box",
  ].join(";");

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;border-bottom:1px solid rgba(248,250,252,0.15);padding-bottom:20px;">
      <div>
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#94a3b8;">AURA READ · Meus destaques</p>
        <h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;">${escapeHtml(bookTitle)}</h1>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:36px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">${highlights.length}</p>
        <p style="margin:0;font-size:11px;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;">trechos</p>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${items
        .map(
          (h) => `
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(248,250,252,0.08);border-left:4px solid ${escapeHtml(h.color || "#fef08a")};border-radius:10px;padding:14px 18px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:6px;">
                <span>Página ${h.page_number}</span>
                <span>${new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;">${escapeHtml((h.text || "").slice(0, 600))}${(h.text || "").length > 600 ? "…" : ""}</p>
            </div>
          `
        )
        .join("")}
      ${
        highlights.length > items.length
          ? `<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:8px;">+ ${highlights.length - items.length} destaques não exibidos nesta imagem</p>`
          : ""
      }
    </div>
    <p style="margin-top:32px;text-align:center;font-size:11px;color:#64748b;letter-spacing:.1em;">gerado em ${new Date().toLocaleString("pt-BR")} · auraread.store</p>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
        "image/png"
      )
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(bookTitle)}-destaques-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    container.remove();
  }
};
