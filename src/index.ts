import { adminApp } from './admin/app.ts';
import type { RuntimeEnv } from './env.ts';

export default {
  async fetch(request: Request, env: RuntimeEnv, executionCtx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/admin')) return env.ASSETS.fetch(request);
    return adminApp.fetch(request, env, executionCtx);
  },
} satisfies ExportedHandler<RuntimeEnv>;
