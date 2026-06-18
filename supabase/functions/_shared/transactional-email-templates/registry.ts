import type { ComponentType } from 'npm:react@18.3.1'
import { template as subscriptionUpgraded } from './subscription-upgraded.tsx'
import { template as subscriptionCancelled } from './subscription-cancelled.tsx'

export type EmailCategory = 'ads' | 'content' | 'product_updates' | 'transactional'

export const VALID_CATEGORIES: readonly EmailCategory[] = [
  'ads',
  'content',
  'product_updates',
  'transactional',
] as const

export const PROMOTIONAL_CATEGORIES: readonly EmailCategory[] = [
  'ads',
  'content',
  'product_updates',
] as const

/**
 * Filename prefixes that identify a template as promotional. Templates whose
 * registry key starts with one of these MUST declare a promotional category.
 */
export const PROMOTIONAL_NAME_PREFIXES = [
  'promo-',
  'newsletter-',
  'announce-',
  'announcement-',
  'campaign-',
  'digest-',
  'marketing-',
] as const

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: ComponentType<any>
  subject: string | ((data: Record<string, unknown>) => string)
  displayName?: string
  // deno-lint-ignore no-explicit-any
  previewData?: Record<string, any>
  to?: string
  /**
   * Promotional category for opt-out filtering against `email_preferences`.
   * Omit (or use 'transactional') for essential mail — those always send.
   * Promotional templates (see PROMOTIONAL_NAME_PREFIXES) MUST set one of
   * 'ads' | 'content' | 'product_updates'.
   */
  category?: EmailCategory
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'subscription-upgraded': subscriptionUpgraded,
  'subscription-cancelled': subscriptionCancelled,
}

export interface RegistryValidationIssue {
  templateName: string
  reason: string
}

/**
 * Validate a single template's `category` field.
 * Returns null when valid, or an issue describing the problem.
 */
export function validateTemplateCategory(
  templateName: string,
  entry: TemplateEntry,
): RegistryValidationIssue | null {
  const isPromotionalName = PROMOTIONAL_NAME_PREFIXES.some((p) =>
    templateName.startsWith(p),
  )

  if (entry.category !== undefined) {
    if (!VALID_CATEGORIES.includes(entry.category)) {
      return {
        templateName,
        reason: `Invalid category '${String(entry.category)}'. Expected one of: ${VALID_CATEGORIES.join(', ')}`,
      }
    }
    if (isPromotionalName && !PROMOTIONAL_CATEGORIES.includes(entry.category)) {
      return {
        templateName,
        reason: `Promotional template must use a promotional category (${PROMOTIONAL_CATEGORIES.join(', ')}), got '${entry.category}'`,
      }
    }
    return null
  }

  // category missing
  if (isPromotionalName) {
    return {
      templateName,
      reason: `Promotional template is missing required 'category' field (expected one of: ${PROMOTIONAL_CATEGORIES.join(', ')})`,
    }
  }
  return null
}

/**
 * Validate the whole registry. Run at module load to fail fast on bad config.
 */
export function validateRegistry(
  templates: Record<string, TemplateEntry> = TEMPLATES,
): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = []
  for (const [name, entry] of Object.entries(templates)) {
    const issue = validateTemplateCategory(name, entry)
    if (issue) issues.push(issue)
  }
  return issues
}

// Fail-fast: log clear errors on cold start if any template is misconfigured.
const _startupIssues = validateRegistry()
if (_startupIssues.length > 0) {
  for (const issue of _startupIssues) {
    console.error(
      `[email-registry] Invalid template '${issue.templateName}': ${issue.reason}`,
    )
  }
}
