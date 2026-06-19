import html2canvas from "html2canvas";

interface HighlightItem {
  id: string;
  page_number: number;
  text: string;
  color: string | null;
  created_at: string;
}

const PER_IMAGE = 60;

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

const renderChunk = async (
  bookTitle: string,
  chunk: HighlightItem[],
  totalCount: number,
  partIndex: number,
  totalParts: number
): Promise<Blob> => {
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

  const partLabel =
    totalParts > 1 ? `Parte ${partIndex + 1} de ${totalParts}` : "Meus destaques";

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;border-bottom:1px solid rgba(248,250,252,0.15);padding-bottom:20px;">
      <div>
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#94a3b8;">AURA READ · ${escapeHtml(partLabel)}</p>
        <h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;">${escapeHtml(bookTitle)}</h1>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:36px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;">${totalCount}</p>
        <p style="margin:0;font-size:11px;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;">trechos no total</p>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${chunk
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
    </div>
    <p style="margin-top:32px;text-align:center;font-size:11px;color:#64748b;letter-spacing:.1em;">gerado em ${new Date().toLocaleString("pt-BR")} · auraread.store${totalParts > 1 ? ` · parte ${partIndex + 1}/${totalParts}` : ""}</p>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
        "image/png"
      )
    );
  } finally {
    container.remove();
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/**
 * Exporta a lista de destaques como uma ou mais imagens PNG.
 * Quando houver mais de 60 destaques, gera múltiplas imagens
 * (parte-01, parte-02, ...) com layout coerente entre elas.
 */
export const exportHighlightsAsImage = async (
  bookTitle: string,
  highlights: HighlightItem[]
): Promise<void> => {
  if (!highlights.length) throw new Error("Nenhum destaque para exportar");

  const chunks: HighlightItem[][] = [];
  for (let i = 0; i < highlights.length; i += PER_IMAGE) {
    chunks.push(highlights.slice(i, i + PER_IMAGE));
  }

  const base = sanitizeFilename(bookTitle);
  const stamp = Date.now();
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const blob = await renderChunk(bookTitle, chunks[i], highlights.length, i, total);
    const suffix =
      total > 1 ? `-parte-${String(i + 1).padStart(2, "0")}-de-${String(total).padStart(2, "0")}` : "";
    downloadBlob(blob, `${base}-destaques${suffix}-${stamp}.png`);
  }
};
