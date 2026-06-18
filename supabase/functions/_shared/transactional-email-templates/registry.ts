import type { ComponentType } from 'npm:react@18.3.1'
import { template as subscriptionUpgraded } from './subscription-upgraded.tsx'
import { template as subscriptionCancelled } from './subscription-cancelled.tsx'

export type EmailCategory = 'ads' | 'content' | 'product_updates' | 'transactional'

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
   */
  category?: EmailCategory
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'subscription-upgraded': subscriptionUpgraded,
  'subscription-cancelled': subscriptionCancelled,
}
