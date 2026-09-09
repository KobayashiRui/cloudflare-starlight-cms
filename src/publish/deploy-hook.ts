/** Low-level transport. Publish delivery state and retry are connected in P3. */
export async function triggerDeployHook(url: string, request: typeof fetch = fetch): Promise<void> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://api.cloudflare.com' ||
      !/^\/client\/v4\/workers\/builds\/deploy_hooks\/[a-zA-Z0-9_-]+$/.test(parsed.pathname) ||
      parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Invalid Workers Deploy Hook URL');
  }
  let response: Response;
  try { response = await request(parsed.href, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000) }); }
  catch { throw new Error('Workers Deploy Hook request failed'); }
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Workers Deploy Hook rejected: ${response.status}`);
}
