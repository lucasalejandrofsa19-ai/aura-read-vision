import { test, expect, Page } from "@playwright/test";

/**
 * E2E: garante que o item "PDFs Públicos" aparece com o nome acessível
 * padronizado (PUBLIC_PDFS_TOOLTIP) e com aria-describedby presente
 * em todos os pontos de acesso (GlobalFooter, Library, Reader).
 *
 * Mantém paridade com as constantes em src/lib/publicPdfs.ts.
 *
 * Rodar:
 *   BASE_URL=https://aura-read.lovable.app npx playwright test e2e/publicPdfsLink.spec.ts
 */

const BASE_URL = process.env.BASE_URL ?? "https://aura-read.lovable.app";
const ACCESSIBLE_NAME = "PDFs Públicos (abre em nova aba)";
const DESCRIPTION = /Abre o catálogo de PDFs públicos em uma nova aba/i;

async function assertHasDescribedBy(page: Page, role: "link" | "menuitem") {
  const el = page.getByRole(role, { name: ACCESSIBLE_NAME }).first();
  await expect(el).toBeVisible();
  const describedById = await el.getAttribute("aria-describedby");
  expect(describedById, "aria-describedby deve estar presente").toBeTruthy();
  const description = page.locator(`#${describedById}`);
  await expect(description).toHaveText(DESCRIPTION);
}

test.describe('"PDFs Públicos" — nome acessível e aria-describedby', () => {
  test("GlobalFooter na home", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await assertHasDescribedBy(page, "link");
  });

  test("Library: item no menu de Ajuda", async ({ page }) => {
    await page.goto(`${BASE_URL}/library`, { waitUntil: "networkidle" });

    // Se redirecionou para login ou abriu AuthDialog, pular — depende de credenciais.
    const needsAuth =
      !page.url().includes("/library") ||
      (await page.getByRole("dialog").count()) > 0;
    test.skip(needsAuth, "Library exige autenticação; configurar storageState para validar.");

    await page.getByRole("button", { name: /ajuda/i }).click();
    await assertHasDescribedBy(page, "menuitem");
  });

  test("Reader: item no menu durante a leitura", async ({ page }) => {
    // Reader exige um livro carregado e usuário autenticado.
    await page.goto(`${BASE_URL}/reader`, { waitUntil: "networkidle" });
    const onReader = page.url().includes("/reader");
    test.skip(!onReader, "Reader exige autenticação + livro selecionado; configurar storageState.");

    // Abrir o menu (botão "Mais opções" / ícone vertical).
    const menuTrigger = page.getByRole("button", { name: /mais|opções|menu/i }).first();
    await menuTrigger.click();
    await assertHasDescribedBy(page, "menuitem");
  });
});
