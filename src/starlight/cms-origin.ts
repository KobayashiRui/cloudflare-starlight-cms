import { siteConfig } from '../site.config.ts';

/** The public Docs and Admin share one Worker origin, set in the project source. */
export const cmsOrigin = siteConfig.url.replace(/\/$/, '');
