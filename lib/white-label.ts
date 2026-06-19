import type { Organization, OrgBranding } from '@/lib/types'
import { DEFAULT_ORG_BRANDING } from '@/lib/types'

/**
 * Return the effective branding for an org, falling back to NOVAX defaults
 * for any field not set in the org's custom branding.
 */
export function getOrgBranding(org: Organization | null): OrgBranding {
  if (!org?.branding) return DEFAULT_ORG_BRANDING
  return {
    ...DEFAULT_ORG_BRANDING,
    ...org.branding,
  }
}

/**
 * Build a <style> tag string that overrides CSS custom properties
 * for this org's brand color. Injected into the root layout.
 *
 * We override the --novax family of variables so every component
 * that uses bg-novax, text-novax, etc. picks up the org color.
 */
export function buildBrandingCSS(branding: OrgBranding): string {
  const primary = branding.primary_color ?? '#1B3D38'

  // Generate a simple tonal scale from the primary color.
  // For now we use the primary directly; a future enhancement
  // can derive hover/muted/accent/light variants via color math.
  return `
    :root {
      --novax: ${primary};
      --novax-hover: color-mix(in srgb, ${primary} 85%, black);
      --novax-muted: color-mix(in srgb, ${primary} 60%, white);
      --novax-accent: color-mix(in srgb, ${primary} 45%, white);
      --novax-light: color-mix(in srgb, ${primary} 8%, white);
      --novax-light-hover: color-mix(in srgb, ${primary} 14%, white);
      --novax-border: color-mix(in srgb, ${primary} 25%, white);
      --novax-border-active: color-mix(in srgb, ${primary} 45%, white);
    }
  `.trim()
}

/**
 * Check whether an org has active white-label access based on plan.
 */
export function hasWhiteLabel(org: Organization | null): boolean {
  if (!org) return false
  return org.plan === 'white_label' || org.plan === 'agency'
}
