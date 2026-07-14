import { describe, it, expect } from "vitest";
import { extractHighlightText, type PdfTextItem, type HighlightRect } from "./extractHighlightText";

/**
 * Fixture: página de PDF com 3 linhas de texto, em PDF units (pt).
 *
 * pdf.js retorna transform = [scaleX, skewX, skewY, scaleY, x, y] onde
 * (x, y) é a origem BOTTOM-LEFT do glifo. Simulamos uma página 595×842
 * (A4 em pt) com font-size 12pt e line-height 20pt.
 *
 * Layout visual (top-down):
 *   Linha 1 (y_top ~= 100): "The quick brown fox"
 *   Linha 2 (y_top ~= 120): "jumps over the lazy dog"
 *   Linha 3 (y_top ~= 140): "in the moonlit garden"
 */
const VIEWPORT_HEIGHT = 842;
const FONT = 12;

// Helper: cria item na coordenada topo-esquerda desejada (mais intuitivo do que bottom-left).
function makeItem(str: string, xLeft: number, yTop: number, width: number, hasEOL = false): PdfTextItem {
  // pdf.js y = viewportHeight - yTop - fontHeight (origem bottom-left do glifo)
  const yBottom = VIEWPORT_HEIGHT - (yTop + FONT);
  return {
    str,
    hasEOL,
    width,
    height: FONT,
    transform: [FONT, 0, 0, FONT, xLeft, yBottom],
  };
}

const items: PdfTextItem[] = [
  // Linha 1 — dividida em 2 itens (como pdf.js frequentemente faz)
  makeItem("The quick ", 50, 100, 60),
  makeItem("brown fox", 110, 100, 55, /*hasEOL*/ true),
  // Linha 2
  makeItem("jumps over ", 50, 120, 65),
  makeItem("the lazy dog", 115, 120, 70, /*hasEOL*/ true),
  // Linha 3
  makeItem("in the moonlit garden", 50, 140, 120, /*hasEOL*/ true),
];

// Retângulo em PDF units cobrindo APENAS a linha 2.
const RECT_LINE2_PDF: HighlightRect = {
  x: 45,
  y: 118, // topo da linha
  width: 160,
  height: 14, // altura da linha
};

/**
 * Ao mudar o zoom, o canvas está em PDF units × scale.
 * Portanto o retângulo em pixels do canvas = retângulo PDF × zoom.
 * O usuário desenha exatamente sobre a mesma linha visual em qualquer zoom,
 * então esperamos SEMPRE o mesmo texto extraído.
 */
function scaledRect(rect: HighlightRect, scale: number): HighlightRect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

describe("extractHighlightText — igualdade visual × texto copiado em múltiplos zooms", () => {
  const EXPECTED_LINE2 = "jumps over the lazy dog";

  for (const zoom of [1.0, 1.5, 2.0]) {
    it(`retorna o texto da linha marcada em ${Math.round(zoom * 100)}% de zoom`, () => {
      const result = extractHighlightText({
        items,
        viewportHeight: VIEWPORT_HEIGHT,
        scale: zoom,
        rect: scaledRect(RECT_LINE2_PDF, zoom),
      });
      expect(result).toBe(EXPECTED_LINE2);
    });
  }

  it("produz resultado idêntico em 100%, 150% e 200% de zoom para a mesma marcação visual", () => {
    const outputs = [1.0, 1.5, 2.0].map((zoom) =>
      extractHighlightText({
        items,
        viewportHeight: VIEWPORT_HEIGHT,
        scale: zoom,
        rect: scaledRect(RECT_LINE2_PDF, zoom),
      }),
    );
    expect(outputs[0]).toBe(outputs[1]);
    expect(outputs[1]).toBe(outputs[2]);
    expect(outputs[0]).toBe(EXPECTED_LINE2);
  });

  it("não vaza texto das linhas vizinhas (tolerância estreita)", () => {
    const result = extractHighlightText({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scale: 1,
      rect: RECT_LINE2_PDF,
    });
    expect(result).not.toMatch(/brown fox/);
    expect(result).not.toMatch(/moonlit/);
  });

  it("reconstrói ordem de leitura ao marcar múltiplas linhas", () => {
    // Retângulo grande cobrindo linhas 1 e 2
    const rect: HighlightRect = { x: 45, y: 98, width: 200, height: 36 };
    const result = extractHighlightText({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scale: 1,
      rect,
    });
    expect(result).toBe("The quick brown fox jumps over the lazy dog");
  });

  it("mesma marcação visual em zoom 2× para múltiplas linhas produz texto idêntico", () => {
    const rectPdf: HighlightRect = { x: 45, y: 98, width: 200, height: 36 };
    const a = extractHighlightText({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scale: 1,
      rect: rectPdf,
    });
    const b = extractHighlightText({
      items,
      viewportHeight: VIEWPORT_HEIGHT,
      scale: 2,
      rect: scaledRect(rectPdf, 2),
    });
    expect(a).toBe(b);
  });
});
