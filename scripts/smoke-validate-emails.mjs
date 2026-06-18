#!/usr/bin/env node
/**
 * Smoke test for the email-template validator.
 *
 * 1. Creates a temporary promotional template WITHOUT a `category` field.
 * 2. Registers it in registry.ts.
 * 3. Runs `npm run validate:emails` and asserts it EXITS NON-ZERO.
 * 4. Always cleans up (template file + registry edits), even on failure.
 *
 * Exit 0 → validator correctly blocked the invalid template.
 * Exit 1 → validator did NOT catch the regression (CI guard is broken).
 */
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TPL_DIR = join(
  ROOT,
  'supabase/functions/_shared/transactional-email-templates',
)
const TPL_NAME = 'promo-smoke-invalid'
const TPL_FILE = join(TPL_DIR, `${TPL_NAME}.tsx`)
const REGISTRY = join(TPL_DIR, 'registry.ts')

const IMPORT_LINE = `import { template as promoSmokeInvalid } from './${TPL_NAME}.tsx'`
const MAP_LINE = `  '${TPL_NAME}': promoSmokeInvalid,`

const TPL_SOURCE = `import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const Email = () => (
  <Html><Head /><Body><Container><Text>smoke</Text></Container></Body></Html>
)

export const template = {
  component: Email,
  subject: 'Smoke test',
} satisfies TemplateEntry
`

const originalRegistry = readFileSync(REGISTRY, 'utf8')

function cleanup() {
  if (existsSync(TPL_FILE)) unlinkSync(TPL_FILE)
  writeFileSync(REGISTRY, originalRegistry, 'utf8')
}

process.on('SIGINT', () => { cleanup(); process.exit(130) })
process.on('SIGTERM', () => { cleanup(); process.exit(143) })

try {
  // 1. Drop invalid template
  writeFileSync(TPL_FILE, TPL_SOURCE, 'utf8')

  // 2. Patch registry: add import after last import, add map entry before `}`
  let next = originalRegistry
  const lastImportIdx = next.lastIndexOf("from '")
  const lastImportEnd = next.indexOf('\n', lastImportIdx)
  next =
    next.slice(0, lastImportEnd + 1) +
    IMPORT_LINE + '\n' +
    next.slice(lastImportEnd + 1)

  next = next.replace(/(export const TEMPLATES[^=]*=\s*\{[\s\S]*?)(\n\})/, (_m, body, close) =>
    `${body}\n${MAP_LINE}${close}`,
  )
  writeFileSync(REGISTRY, next, 'utf8')

  // 3. Run validator — MUST fail
  const result = spawnSync('node', ['scripts/validate-email-templates.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  })

  console.log(result.stdout)
  if (result.stderr) console.error(result.stderr)

  if (result.status === 0) {
    console.error('\n❌ SMOKE FAILED: validator returned 0 for an invalid template.')
    console.error('   The CI guard would NOT block a misconfigured promotional template.\n')
    cleanup()
    process.exit(1)
  }

  console.log(`\n✅ Smoke OK: validator correctly exited with code ${result.status}.`)
  cleanup()
  process.exit(0)
} catch (err) {
  console.error('Smoke harness crashed:', err)
  cleanup()
  process.exit(1)
}
