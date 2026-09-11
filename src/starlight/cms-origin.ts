import { siteConfig } from '../site.config.ts';

/**
 * The public Docs and Admin share one Worker origin. Workers Builds sets this
 * public value after the custom domain exists; source config remains a local fallback.
 */
export const cmsOrigin = process.env.CMS_ORIGIN?.replace(/\/$/, '') || siteConfig.url;
