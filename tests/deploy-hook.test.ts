import { expect, it, vi } from 'vitest';
import { triggerDeployHook } from '../src/publish/deploy-hook.ts';

const url = 'https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test-hook';
it('POSTs a hook using Cloudflare’s documented request shape', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
  await triggerDeployHook(url, request);
  expect(request).toHaveBeenCalledWith(url, { method: 'POST' });
});
it('returns the build identifier when the hook accepts the request', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: { build_uuid: 'build-123', already_exists: true } }, { status: 202 }));
  await expect(triggerDeployHook(url, request)).resolves.toEqual({ buildId: 'build-123', alreadyExists: true });
});
it('reports rejected hooks', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
  await expect(triggerDeployHook(url, request)).rejects.toThrow('429');
});
it('does not expose secret URLs from network errors', async () => {
  const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(`failed: ${url}`));
  await expect(triggerDeployHook(url, request)).rejects.toThrow(/^Workers Deploy Hook transport failed$/);
});
it('reports a safe network category for TypeError fetch failures', async () => {
  const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError(`failed: ${url}`));
  await expect(triggerDeployHook(url, request)).rejects.toThrow(/^Workers Deploy Hook network request failed$/);
});
it.each(['http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/test',
  'https://evil.example/hook', `${url}?secret=value`, 'https://api.cloudflare.com/client/v4/pages/hook'])
('rejects wrong destinations without a request: %s', async (invalid) => {
  const request = vi.fn<typeof fetch>();
  await expect(triggerDeployHook(invalid, request)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
