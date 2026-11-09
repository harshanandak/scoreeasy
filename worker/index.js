// Worker entry in front of the static assets (the Vite SPA build in ./dist).
//
// 1. www.scoreeasy.app gets a 301 to https://scoreeasy.app with the same path
//    and query, in one hop for both http and https, so there is one canonical
//    address. This check runs before rule 2.
// 2. Plain-http requests get a 301 to the same URL over https. The zone-level
//    "Always Use HTTPS" toggle is not available to us, so we do it here.
//    Local dev hosts are skipped so `wrangler dev` keeps working.
// 3. Everything else is served by the assets binding unchanged (SPA fallback,
//    trailing-slash handling, content types, caching headers). Https responses
//    only gain a Strict-Transport-Security header.
//
// HSTS is max-age only: includeSubDomains and preload are owner decisions.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HSTS = "max-age=31536000";
const WWW_HOST = "www.scoreeasy.app";
const APEX_HOST = "scoreeasy.app";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // URL lowercases the hostname, so this match is case-insensitive.
    if (url.hostname === WWW_HOST) {
      url.protocol = "https:";
      url.hostname = APEX_HOST;
      return Response.redirect(url.toString(), 301);
    }

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
