import { test, expect, type Route } from "@playwright/test";

/**
 * E2E: contas Premium NÃO exibem aviso/contador de imagens no
 * HighlightImageDialog; contas grátis continuam vendo o alerta/contador
 * conforme o limite.
 *
 * Estratégia:
 *  - Reaproveita a sessão autenticada (storageState do auth.setup.ts).
 *  - Intercepta chamadas REST do Supabase para forçar dois estados de
 *    conta sem depender do papel real do usuário no banco:
 *      • `/rest/v1/user_roles?...`  → controla `hasPremiumAccess`
 *      • `/rest/v1/highlight_images?...select=*&...count=exact&head=true`
 *        → controla o `imageCount` do dialog
 *  - Abre um livro com destaques em `/summary/:id` (o primeiro visível
 *    na Library) e clica no botão "Gerar Imagem" de um destaque.
 *
 * Se a conta de teste não possuir nenhum livro com destaques (sem texto),
 * o teste faz `test.skip` — segue o mesmo padrão de calibração usado em
 * `focusedHighlightZoom.spec.ts`.
 */

const BASE_URL = process.env.BASE_URL ?? "https://aura-read.lovable.app";

type Tier = "premium" | "free";

const mockSupabase = async (page: import("@playwright/test").Page, opts: {
  tier: Tier;
  imageCount: number;
}) => {
  // user_roles → controla hasPremiumAccess
  await page.route(/\/rest\/v1\/user_roles\?.*select=role/, async (route: Route) => {
    const body = opts.tier === "premium" ? [{ role: "premium" }] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // highlight_images count (head=true) → controla imageCount
  await page.route(/\/rest\/v1\/highlight_images\?.*/, async (route: Route) => {
    const req = route.request();
    const prefer = req.headers()["prefer"] ?? "";
    // Só interceptamos a variação HEAD/count=exact. Deixa passar a listagem
    // da galeria (retorna array), que o próprio backend responde.
    if (prefer.includes("count=exact") && req.method() === "HEAD") {
      await route.fulfill({
        status: 206,
        headers: { "Content-Range": `0-*/${opts.imageCount}` },
        body: "",
      });
      return;
    }
    if (prefer.includes("count=exact")) {
      await route.fulfill({
        status: 206,
        headers: { "Content-Range": `0-*/${opts.imageCount}` },
        contentType: "application/json",
        body: "[]",
      });
      return;
    }
    await route.continue();
  });
};

const openSummaryOfFirstBookWithHighlight = async (
  page: import("@playwright/test").Page,
) => {
  await page.goto(`${BASE_URL}/library`, { waitUntil: "networkidle" });

  // Pega o primeiro card de livro visível.
  const firstBook = page.locator('[data-testid="book-card"], a[href*="/reader/"]').first();
  if (!(await firstBook.count())) test.skip(true, "Nenhum livro na Library.");

  // Extrai o bookId a partir do href, se disponível.
  const href = await firstBook.getAttribute("href");
  const bookId = href?.match(/\/reader\/([0-9a-f-]+)/i)?.[1];
  if (!bookId) test.skip(true, "Não foi possível determinar o bookId do primeiro livro.");

  await page.goto(`${BASE_URL}/summary/${bookId}`, { waitUntil: "networkidle" });

  const geraBtn = page.getByRole("button", { name: /gerar imagem/i }).first();
  if (!(await geraBtn.count())) {
    test.skip(true, "Livro sem destaques com texto para exibir o botão 'Gerar Imagem'.");
  }
  await geraBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText(/gerar imagem do destaque/i)).toBeVisible();
  return dialog;
};

test.describe("HighlightImageDialog @auth — visibilidade do contador de imagens", () => {
  test("conta Premium não exibe contador nem aviso de limite", async ({ page }) => {
    await mockSupabase(page, { tier: "premium", imageCount: 5 });
    const dialog = await openSummaryOfFirstBookWithHighlight(page);

    // Espera o loadImageCount resolver (a chamada foi mockada).
    await page.waitForTimeout(500);

    await expect(dialog.getByText(/imagens geradas:/i)).toHaveCount(0);
    await expect(dialog.getByText(/gratuitas restantes/i)).toHaveCount(0);
    await expect(dialog.getByText(/assine o plano premium\/pro/i)).toHaveCount(0);
    await expect(dialog.getByText(/você já usou .* de .* imagens gratuitas/i)).toHaveCount(0);
  });

  test("conta grátis no limite exibe alerta com CTA para Premium/Pro", async ({ page }) => {
    await mockSupabase(page, { tier: "free", imageCount: 3 });
    const dialog = await openSummaryOfFirstBookWithHighlight(page);

    await expect(dialog.getByText(/você já usou 3 de 3 imagens gratuitas/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(dialog.getByText(/assine o plano premium\/pro/i)).toBeVisible();
  });

  test("conta grátis abaixo do limite exibe contador de gratuitas restantes", async ({ page }) => {
    await mockSupabase(page, { tier: "free", imageCount: 1 });
    const dialog = await openSummaryOfFirstBookWithHighlight(page);

    await expect(dialog.getByText(/imagens geradas:\s*1/i)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/gratuitas restantes/i)).toBeVisible();
  });
});
