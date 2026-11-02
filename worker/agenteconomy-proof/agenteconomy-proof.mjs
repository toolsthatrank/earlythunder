// Exact-path ownership proof for the free Agent Economy Report owner claim.
// Bind only this file's exact HTTPS URL; all ordinary site traffic stays on Pages.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.hostname !== 'earlythunder.com' || url.pathname !== '/.well-known/agenteconomy-verify.txt') {
      return new Response('Not found\n', { status: 404 });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed\n', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const token = env.AGENTECO_VERIFY_TOKEN;
    if (!token || /[\r\n]/.test(token)) {
      return new Response('Proof unavailable\n', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(request.method === 'HEAD' ? null : token + '\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  },
};
