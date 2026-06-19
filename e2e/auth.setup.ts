import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * Setup: realiza login via email/senha e persiste a sessão em
 * playwright/.auth/user.json para que os specs autenticados
 * (Library, Reader) iniciem já logados.
 *
 * Variáveis de ambiente obrigatórias na CI:
 *   E2E_EMAIL, E2E_PASSWORD
 * Opcional:
 *   BASE_URL (default: produção)
 */

export const STORAGE_STATE = path.join(
  process.cwd(),
  "playwright/.auth/user.json",
);

const BASE_URL = process.env.BASE_URL ?? "https://aura-read.lovable.app";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

setup("authenticate", async ({ page }) => {
  setup.skip(
    !EMAIL || !PASSWORD,
    "E2E_EMAIL/E2E_PASSWORD não definidos — testes autenticados serão pulados.",
  );

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  // Library abre o AuthDialog automaticamente quando não há sessão.
  await page.goto(`${BASE_URL}/library`, { waitUntil: "networkidle" });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  await dialog.getByLabel(/email/i).fill(EMAIL!);
  await dialog.getByLabel(/senha|password/i).first().fill(PASSWORD!);
  await dialog
    .getByRole("button", { name: /entrar|sign in|login/i })
    .first()
    .click();

  // Sessão estabelecida quando o dialog fecha e a Library aparece.
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/library/);

  await page.context().storageState({ path: STORAGE_STATE });
});
