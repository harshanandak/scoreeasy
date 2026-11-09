// Worker entry in front of the static assets (the Vite SPA build in ./dist).
//
// 1. Plain-http requests get a 301 to the same URL over https. The zone-level
//    "Always Use HTTPS" toggle is not available to us, so we do it here.
//    Local dev hosts are skipped so `wrangler dev` keeps working.
// 2. Everything else is served by the assets binding unchanged (SPA fallback,
//    trailing-slash handling, content types, caching headers). Https responses
//    only gain a Strict-Transport-Security header.
//
// HSTS is max-age only: includeSubDomains and preload are owner decisions.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HSTS = "max-age=31536000";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    const response = await env.ASSETS.fetch(request);
    if (url.protocol !== "https:") return response;

    // Responses from the assets binding can have immutable headers: copy first.
    const withHsts = new Response(response.body, response);
    withHsts.headers.set("Strict-Transport-Security", HSTS);
    return withHsts;
  },
};
