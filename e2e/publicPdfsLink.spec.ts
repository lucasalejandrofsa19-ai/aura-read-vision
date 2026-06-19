import { test, expect, Page } from "@playwright/test";

/**
 * Verifica o item "PDFs Públicos" no GlobalFooter (rota pública).
 */

const ACCESSIBLE_NAME = "PDFs Públicos (abre em nova aba)";
const DESCRIPTION = /Abre o catálogo de PDFs públicos em uma nova aba/i;

async function assertHasDescribedBy(page: Page, role: "link" | "menuitem") {
  const el = page.getByRole(role, { name: ACCESSIBLE_NAME }).first();
  await expect(el).toBeVisible();
  const id = await el.getAttribute("aria-describedby");
  expect(id, "aria-describedby presente").toBeTruthy();
  await expect(page.locator(`#${id}`)).toHaveText(DESCRIPTION);
}

test("GlobalFooter expõe PDFs Públicos com nome e descrição acessíveis", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await assertHasDescribedBy(page, "link");
});
