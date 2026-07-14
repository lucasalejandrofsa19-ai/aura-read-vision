/**
 * Extração de texto de um retângulo desenhado sobre a página PDF.
 *
 * Função pura para permitir testes: recebe os text items no formato do
 * pdf.js (`items` de `getTextContent()`), a altura do viewport em PDF units
 * (`getViewport({ scale: 1 }).height`), o zoom atual de renderização e as
 * coordenadas do highlight em pixels do canvas.
 *
 * A implementação normaliza as coordenadas para PDF units, computa
 * interseção com cada item, ordena por linha (y) e depois por x, e junta
 * os fragmentos respeitando `hasEOL` e espaçamento.
 */

export interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
  width?: number;
  height?: number;
  // pdf.js transform: [a, b, c, d, e, f] onde a/d são escalas e e/f a origem
  transform: number[];
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractOptions {
  /** Itens retornados por `page.getTextContent()` do pdf.js. */
  items: PdfTextItem[];
  /** Altura do viewport em PDF units (`getViewport({ scale: 1 }).height`). */
  viewportHeight: number;
  /** Zoom atual do react-pdf (canvas está em PDF units × scale). */
  scale: number;
  /** Retângulo do highlight, em pixels do canvas. */
  rect: HighlightRect;
  /**
   * Tolerância de sobreposição em PDF units.
   * Padrão baixo (2pt) para não capturar linhas vizinhas.
   */
  tolerance?: number;
}

export function extractHighlightText({
  items,
  viewportHeight,
  scale,
  rect,
  tolerance = 2,
}: ExtractOptions): string {
  const zoom = scale || 1;
  const hlLeft = rect.x / zoom;
  const hlTop = rect.y / zoom;
  const hlRight = (rect.x + rect.width) / zoom;
  const hlBottom = (rect.y + rect.height) / zoom;

  type Hit = { str: string; hasEOL: boolean; x: number; y: number };
  const hits: Hit[] = [];

  for (const item of items) {
    if (!item || typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
    const [a, , , d, e, f] = item.transform;
    const itemHeight = Math.abs(d) || 12;
    const itemWidth = (item.width ?? 0) * Math.abs(a || 1) || (item.width ?? 0);

    // pdf.js: origem bottom-left → converter para top-left (mesmo referencial do canvas).
    const canvasItemY = viewportHeight - f;
    const itemTop = canvasItemY - itemHeight;
    const itemBottom = canvasItemY;
    const itemLeft = e;
    const itemRight = e + itemWidth;

    const xOverlap = itemLeft < hlRight + tolerance && itemRight > hlLeft - tolerance;
    const yOverlap = itemTop < hlBottom + tolerance && itemBottom > hlTop - tolerance;

    if (xOverlap && yOverlap) {
      hits.push({
        str: item.str,
        hasEOL: !!item.hasEOL,
        x: itemLeft,
        y: itemTop,
      });
    }
  }

  hits.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 4) return a.y - b.y;
    return a.x - b.x;
  });

  let result = "";
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    result += cur.str;
    const next = hits[i + 1];
    if (!next) break;
    const sameLine = Math.abs(next.y - cur.y) <= 4;
    if (!sameLine || cur.hasEOL) {
      if (!result.endsWith(" ")) result += " ";
    } else if (!cur.str.endsWith(" ") && !next.str.startsWith(" ")) {
      result += " ";
    }
  }

  return result.replace(/\s+/g, " ").trim();
}
