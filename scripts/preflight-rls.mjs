#!/usr/bin/env node
/**
 * Local pre-flight: mirrors the GitHub Actions "Pre-flight" step.
 * Run before `npm run test:rls` or the seed script.
 *
 * Loads .env.local / .env if present (no extra deps).
 */
import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^["']|["']$/g, "");
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const REQUIRED = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];

const errors = [];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) errors.push(`Missing env vars: ${missing.join(", ")}`);

const url = process.env.VITE_SUPABASE_URL;
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
  errors.push("VITE_SUPABASE_URL must look like https://<ref>.supabase.co");
}
for (const k of ["TEST_USER_A_EMAIL", "TEST_USER_B_EMAIL"]) {
  const v = process.env[k];
  if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errors.push(`${k} invalid email`);
}
for (const k of ["TEST_USER_A_PASSWORD", "TEST_USER_B_PASSWORD"]) {
  const v = process.env[k];
  if (v && v.length < 8) errors.push(`${k} must be ≥8 chars`);
}
if (
  process.env.TEST_USER_A_EMAIL &&
  process.env.TEST_USER_A_EMAIL === process.env.TEST_USER_B_EMAIL
) {
  errors.push("TEST_USER_A_EMAIL and TEST_USER_B_EMAIL must differ");
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor !== 20) errors.push(`Node 20.x required, found ${process.version}`);

for (const pkg of ["vitest", "@supabase/supabase-js"]) {
  try {
    await import(`${pkg}/package.json`, { with: { type: "json" } });
  } catch {
    errors.push(`Dependency '${pkg}' not installed. Run npm install.`);
  }
}

if (errors.length) {
  console.error("✗ Pre-flight failed:");
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}
console.log("✓ Pre-flight passed — secrets, formats and versions OK.");
