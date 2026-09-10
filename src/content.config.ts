import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { cmsLoader } from './starlight/loader.ts';

import { loadSnapshot } from './starlight/source.ts';

export const collections = {
  docs: defineCollection({
    loader: cmsLoader({ loadSnapshot }),
    schema: docsSchema(),
  }),
};
