import { siteConfig } from '../site.config.ts';

/**
 * Workers Builds can set this public value after the custom domain exists.
 * Keeping the source setting as a fallback preserves straightforward local use.
 */
export const publicSiteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || siteConfig.url;
