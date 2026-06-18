#!/usr/bin/env node
/**
 * Build-time validator for promotional email templates.
 *
 * Statically scans `supabase/functions/_shared/transactional-email-templates/`
 * and ensures every template registered in `registry.ts` whose filename matches
 * a promotional prefix declares a valid `category`.
 *
 * Exits with code 1 (failing the build / deploy) on any issue.
 *
 * Run via `npm run validate:emails` or as part of `prebuild`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(
  __dirname,
  '..',
  'supabase',
  'functions',
  '_shared',
  'transactional-email-templates',
)

const VALID_CATEGORIES = ['ads', 'content', 'product_updates', 'transactional']
const PROMOTIONAL_CATEGORIES = ['ads', 'content', 'product_updates']
const PROMOTIONAL_PREFIXES = [
  'promo-',
  'newsletter-',
  'announce-',
  'announcement-',
  'campaign-',
  'digest-',
  'marketing-',
]

const issues = []
const fail = (file, reason) => issues.push({ file, reason })

let registrySource
try {
  registrySource = readFileSync(join(TEMPLATES_DIR, 'registry.ts'), 'utf8')
} catch (err) {
  console.error('[validate-email-templates] Cannot read registry.ts:', err.message)
  process.exit(1)
}

// Extract registered template names from the TEMPLATES map.
const registered = new Map() // name -> imported identifier
const mapBlock = registrySource.match(/TEMPLATES[^=]*=\s*\{([\s\S]*?)\}/)
if (!mapBlock) {
  console.error('[validate-email-templates] Could not locate TEMPLATES map in registry.ts')
  process.exit(1)
}
for (const m of mapBlock[1].matchAll(/['"]([a-z0-9-]+)['"]\s*:\s*([A-Za-z0-9_]+)/g)) {
  registered.set(m[1], m[2])
}

// Map imported identifier -> source file
const importMap = new Map()
for (const m of registrySource.matchAll(
  /import\s*\{\s*template\s+as\s+([A-Za-z0-9_]+)\s*\}\s*from\s*['"]\.\/([^'"]+)['"]/g,
)) {
  importMap.set(m[1], m[2])
}

for (const [name, ident] of registered) {
  const fileRel = importMap.get(ident)
  if (!fileRel) {
    fail('registry.ts', `Template '${name}' references missing import '${ident}'`)
    continue
  }
  const filePath = join(TEMPLATES_DIR, fileRel)
  let src
  try {
    src = readFileSync(filePath, 'utf8')
  } catch {
    fail(fileRel, `Cannot read template source for '${name}'`)
    continue
  }

  // Extract category literal: category: 'xxx'
  const catMatch = src.match(/category\s*:\s*['"]([^'"]+)['"]/)
  const category = catMatch?.[1]

  const isPromo = PROMOTIONAL_PREFIXES.some((p) => name.startsWith(p))

  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      fail(
        fileRel,
        `Template '${name}' has invalid category '${category}'. Expected one of: ${VALID_CATEGORIES.join(', ')}`,
      )
    } else if (isPromo && !PROMOTIONAL_CATEGORIES.includes(category)) {
      fail(
        fileRel,
        `Promotional template '${name}' must use a promotional category (${PROMOTIONAL_CATEGORIES.join(', ')}), got '${category}'`,
      )
    }
  } else if (isPromo) {
    fail(
      fileRel,
      `Promotional template '${name}' is missing required 'category' field (expected one of: ${PROMOTIONAL_CATEGORIES.join(', ')})`,
    )
  }
}

// Also warn about template files not registered (orphans).
const onDisk = readdirSync(TEMPLATES_DIR).filter(
  (f) => f.endsWith('.tsx') && !f.startsWith('_'),
)
const registeredFiles = new Set([...importMap.values()])
for (const f of onDisk) {
  if (!registeredFiles.has(f)) {
    console.warn(`[validate-email-templates] WARN: ${f} is not registered in registry.ts`)
  }
}

if (issues.length > 0) {
  console.error('\n❌ Email template validation failed:\n')
  for (const i of issues) {
    console.error(`  • ${i.file}: ${i.reason}`)
  }
  console.error(`\n${issues.length} issue(s) found. Fix before deploying.\n`)
  process.exit(1)
}

console.log(`✅ Email templates OK (${registered.size} registered)`)
