import { test, expect, Page } from "@playwright/test";

/**
 * Specs autenticados — usam storageState gerado por e2e/auth.setup.ts.
 * Verificam o item "PDFs Públicos" na Library e no Reader.
 */

const ACCESSIBLE_NAME = "PDFs Públicos (abre em nova aba)";
const DESCRIPTION = /Abre o catálogo de PDFs públicos em uma nova aba/i;

async function assertMenuItemDescribedBy(page: Page) {
  const item = page.getByRole("menuitem", { name: ACCESSIBLE_NAME }).first();
  await expect(item).toBeVisible();
  const id = await item.getAttribute("aria-describedby");
  expect(id, "aria-describedby presente").toBeTruthy();
  await expect(page.locator(`#${id}`)).toHaveText(DESCRIPTION);
}

test("Library: menu de Ajuda expõe PDFs Públicos acessível", async ({ page }) => {
  await page.goto("/library", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /ajuda/i }).click();
  await assertMenuItemDescribedBy(page);
});

test("Reader: menu expõe PDFs Públicos acessível durante a leitura", async ({
  page,
}) => {
  // Entra via Library e abre o primeiro livro disponível.
  await page.goto("/library", { waitUntil: "networkidle" });
  const firstBook = page.getByRole("link").filter({ hasText: /./ }).first();
  await firstBook.click();
  await expect(page).toHaveURL(/\/reader/, { timeout: 15_000 });

  const menuTrigger = page
    .getByRole("button", { name: /mais|opções|menu/i })
    .first();
  await menuTrigger.click();
  await assertMenuItemDescribedBy(page);
});
