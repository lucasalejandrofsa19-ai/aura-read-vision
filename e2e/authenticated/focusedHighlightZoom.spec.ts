import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Marcação no FocusedReaderMode em múltiplos zooms.
 *
 * Objetivo: garantir que o texto extraído (copiado para clipboard) permanece
 * IDÊNTICO ao área visualmente marcada em 100%, 150% e 200% de zoom.
 *
 * Estratégia:
 *  1) Abre o primeiro livro da Library.
 *  2) Entra no Modo Leitura Focada.
 *  3) Para cada zoom (100/150/200%):
 *     a) Ajusta o zoom via botões A+/A-.
 *     b) Ativa "Destaque".
 *     c) Desenha um retângulo sobre a MESMA região visual da primeira linha
 *        de texto, proporcional ao zoom (retângulo × zoom).
 *     d) Aguarda toast de sucesso e lê o clipboard.
 *  4) Assere que todos os três textos são idênticos e não vazios.
 *
 * Requer storageState de e2e/auth.setup.ts.
 */

const ZOOMS = [1.0, 1.5, 2.0] as const;

// Retângulo base em coordenadas do canvas em 100% (px). Ajustado para cobrir
// tipicamente a primeira linha de texto útil da maioria dos PDFs de teste.
const BASE_RECT = { x: 120, y: 140, width: 320, height: 22 };

async function setZoom(page: Page, target: number) {
  // Zoom inicial do FocusedReaderMode é 1.2. Reset para 1.0 clicando A- até desabilitar.
  const zoomOut = page.getByRole("button", { name: /^A-$/ });
  const zoomIn = page.getByRole("button", { name: /^A\+$/ });
  const zoomLabel = page.locator("text=/^\\d+%$/").first();

  // Move mouse para exibir controles.
  await page.mouse.move(400, 400);
  await expect(zoomLabel).toBeVisible();

  // Loop de segurança com limite.
  for (let i = 0; i < 30; i++) {
    const label = (await zoomLabel.textContent())?.trim() ?? "";
    const current = parseInt(label.replace("%", ""), 10) / 100;
    if (Math.abs(current - target) < 0.05) return;
    if (current < target) {
      await zoomIn.click();
    } else {
      await zoomOut.click();
    }
    await page.waitForTimeout(80);
  }
  throw new Error(`Não conseguiu ajustar zoom para ${target * 100}%`);
}

async function drawHighlightRect(
  page: Page,
  rect: { x: number; y: number; width: number; height: number },
) {
  // O canvas do HighlightCanvas fica dentro do container relativo, absoluto top:0/left:0.
  // Localizamos o wrapper .react-pdf__Page para pegar sua origem.
  const pageEl = page.locator(".react-pdf__Page").first();
  const box = await pageEl.boundingBox();
  if (!box) throw new Error("PDF page bounding box indisponível");

  const startX = box.x + rect.x;
  const startY = box.y + rect.y;
  const endX = startX + rect.width;
  const endY = startY + rect.height;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Movimentos intermediários para simular arrasto real.
  await page.mouse.move(startX + rect.width / 2, startY + rect.height / 2, { steps: 8 });
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();
}

test.describe("FocusedReaderMode — marcação equivalente em múltiplos zooms", () => {
  test("texto copiado é idêntico em 100%, 150% e 200% de zoom", async ({
    page,
    context,
  }) => {
    // Clipboard read/write são necessários — useHighlights copia texto extraído.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/library", { waitUntil: "networkidle" });
    const firstBookLink = page.locator('a[href^="/reader/"]').first();
    await expect(firstBookLink).toBeVisible({ timeout: 15_000 });
    await firstBookLink.click();

    // Aguarda o PDF carregar.
    await expect(page.locator(".react-pdf__Page canvas").first()).toBeVisible({
      timeout: 30_000,
    });

    // Entra no Modo Leitura Focada.
    await page
      .getByRole("button", { name: /modo leitura focada/i })
      .click();
    await expect(page.getByText(/Modo Leitura Focada/i)).toBeVisible();
    await expect(page.locator(".react-pdf__Page canvas").first()).toBeVisible({
      timeout: 30_000,
    });

    // Ativa o botão de destaque (só precisa uma vez — estado persiste no componente).
    const highlightBtn = page.getByRole("button", { name: /destaque/i });
    await highlightBtn.click();

    const extracted: Array<{ zoom: number; text: string }> = [];

    for (const zoom of ZOOMS) {
      await setZoom(page, zoom);
      // Aguarda re-render após mudança de escala.
      await page.waitForTimeout(300);

      // Escala o retângulo proporcionalmente para marcar a mesma região visual.
      const scaledRect = {
        x: BASE_RECT.x * zoom,
        y: BASE_RECT.y * zoom,
        width: BASE_RECT.width * zoom,
        height: BASE_RECT.height * zoom,
      };

      await drawHighlightRect(page, scaledRect);

      // Aguarda persistência (toast "Highlight salvo").
      await expect(
        page.getByText(/highlight salvo|destaque criado|destaque adicionado/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Lê o clipboard — useHighlights copia o texto extraído após sucesso.
      const clipText = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return "";
        }
      });

      extracted.push({ zoom, text: clipText.trim() });

      // Fecha o toast atual para não interferir na próxima leitura.
      await page.waitForTimeout(600);
    }

    // Log para debug em CI.
    console.log("Textos extraídos por zoom:", extracted);

    // Todos devem ter conteúdo.
    for (const { zoom, text } of extracted) {
      expect(text, `zoom ${zoom * 100}% deveria extrair texto`).not.toBe("");
    }

    // E devem ser idênticos entre si — a garantia principal.
    expect(extracted[1].text).toBe(extracted[0].text);
    expect(extracted[2].text).toBe(extracted[0].text);
  });
});
