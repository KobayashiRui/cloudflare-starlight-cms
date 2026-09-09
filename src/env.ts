/**
 * Worker bindings come from `wrangler types`. Secrets cannot be generated from
 * wrangler.jsonc, so only those runtime-only values are declared here.
 */
export type RuntimeEnv = CloudflareBindings & {
  MEDIA_PUBLIC_URL?: string;
  WORKERS_DEPLOY_HOOK_URL?: string;
};
