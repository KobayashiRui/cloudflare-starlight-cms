import { expect, it, vi } from 'vitest';
import { triggerDeployHook } from '../src/publish/deploy-hook.ts';

const url = 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test-hook';
it('POSTs a hook without following redirects', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
  await triggerDeployHook(url, request);
  expect(request).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'POST', redirect: 'error' }));
});
it('reports rejected hooks', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
  await expect(triggerDeployHook(url, request)).rejects.toThrow('429');
});
it('does not expose secret URLs from network errors', async () => {
  const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(`failed: ${url}`));
  await expect(triggerDeployHook(url, request)).rejects.toThrow(/^Workers Deploy Hook request failed$/);
});
it.each(['http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test',
  'https://evil.example/hook', `${url}?secret=value`, 'https://api.cloudflare.com/client/v4/pages/hook'])
('rejects wrong destinations without a request: %s', async (invalid) => {
  const request = vi.fn<typeof fetch>();
  await expect(triggerDeployHook(invalid, request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
