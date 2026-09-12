export type DeployHookResult = { buildId: string | null; alreadyExists: boolean };

function transportError(error: unknown): Error {
  // Do not persist runtime error messages: they can contain the secret hook URL.
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new Error('Workers Deploy Hook request timed out');
  }
  if (error instanceof TypeError) {
    return new Error('Workers Deploy Hook network request failed');
  }
  return new Error('Workers Deploy Hook transport failed');
}

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
  // This deliberately matches Cloudflare's documented Deploy Hook request. The
  // hook URL itself is the credential; no Access or API-token header is used.
  try { response = await request(parsed.href, { method: 'POST' }); }
  catch (error) { throw transportError(error); }
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
