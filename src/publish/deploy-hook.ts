export type DeployHookResult = { buildId: string | null; alreadyExists: boolean };

/**
 * Low-level Workers Builds transport. The URL is a secret, so errors deliberately
 * contain no destination or response body.
 */
export async function triggerDeployHook(url: string, request: typeof fetch = fetch): Promise<DeployHookResult> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://api.cloudflare.com' ||
      !/^\/client\/v4\/workers\/builds\/deploy_hooks\/[a-zA-Z0-9_-]+$/.test(parsed.pathname) ||
      parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Invalid Workers Deploy Hook URL');
  }
  let response: Response;
  try { response = await request(parsed.href, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000) }); }
  catch { throw new Error('Workers Deploy Hook request failed'); }
  if (!response.ok) throw new Error(`Workers Deploy Hook rejected: ${response.status}`);
  try {
    const body = await response.json() as { result?: { build_uuid?: unknown; already_exists?: unknown } };
    return {
      buildId: typeof body.result?.build_uuid === 'string' ? body.result.build_uuid : null,
      alreadyExists: body.result?.already_exists === true,
    };
  } catch {
    // Cloudflare currently returns JSON, but accepting a successful empty response
    // keeps the hook boundary compatible with a future 2xx response format.
    return { buildId: null, alreadyExists: false };
  }
}
