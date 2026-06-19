import { test, expect } from "@playwright/test";

/**
 * Fluxo autenticado básico:
 *  1) Library abre logada e lista pelo menos um livro.
 *  2) Abrir o primeiro livro leva ao Reader e o PDF é renderizado.
 *
 * Requer storageState gerado por e2e/auth.setup.ts.
 */

test("Library abre logada e exibe a coleção", async ({ page }) => {
  await page.goto("/library", { waitUntil: "networkidle" });

  // Não pode estar no AuthDialog.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Heading da Library.
  await expect(
    page.getByRole("heading", { name: /minha biblioteca/i, level: 1 }),
  ).toBeVisible();

  // Pelo menos um card de livro (premium gratuito sempre existe).
  const bookCards = page.locator('[data-testid="book-card"], a[href^="/reader/"]');
  await expect(bookCards.first()).toBeVisible({ timeout: 15_000 });
});

test("Reader carrega o PDF do livro selecionado", async ({ page }) => {
  await page.goto("/library", { waitUntil: "networkidle" });

  const firstBookLink = page.locator('a[href^="/reader/"]').first();
  await expect(firstBookLink).toBeVisible({ timeout: 15_000 });

  // Captura o id esperado a partir do href ANTES de clicar.
  const href = await firstBookLink.getAttribute("href");
  const expectedId = href?.replace(/^\/reader\//, "").split(/[/?#]/)[0];
  expect(expectedId, "href deve conter um id de livro").toBeTruthy();

  await firstBookLink.click();

  // URL deve corresponder exatamente ao id capturado.
  await expect(page).toHaveURL(
    new RegExp(`/reader/${expectedId}(?:[/?#]|$)`),
    { timeout: 15_000 },
  );

  // pdf.js renderiza páginas em <canvas> dentro de .react-pdf__Page.
  const firstPage = page.locator(".react-pdf__Page canvas").first();
  await expect(firstPage).toBeVisible({ timeout: 30_000 });

  // Sanity: canvas pintado (largura > 0).
  const width = await firstPage.evaluate(
    (el) => (el as HTMLCanvasElement).width,
  );
  expect(width).toBeGreaterThan(0);
});
