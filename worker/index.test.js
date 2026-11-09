// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import worker from "./index.js";

function makeEnv(body = "asset body") {
  const assetResponse = new Response(body, {
    status: 200,
    headers: { "content-type": "text/html", "cache-control": "public, max-age=0" },
  });
  return { ASSETS: { fetch: vi.fn(async () => assetResponse) } };
}

describe("worker fetch handler", () => {
  it("redirects http to https with 301, keeping path and query", async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("http://scoreeasy.app/live/abc?x=1&y=2"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://scoreeasy.app/live/abc?x=1&y=2");
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("redirects the bare http origin to the https origin", async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request("http://scoreeasy.app/"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://scoreeasy.app/");
  });

  it("redirects a POST over http with 301 too", async () => {
    const env = makeEnv();
    const req = new Request("http://scoreeasy.app/api?x=1", { method: "POST", body: "{}" });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://scoreeasy.app/api?x=1");
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("passes https through to ASSETS with the same request and adds HSTS", async () => {
    const env = makeEnv("hello");
    const req = new Request("https://scoreeasy.app/history?tab=1");
    const res = await worker.fetch(req, env);
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello");
    expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(res.headers.get("cache-control")).toBe("public, max-age=0");
  });

  it.each([
    "http://localhost:8787/",
    "http://127.0.0.1:8787/x",
    "http://[::1]:8787/x",
  ])("does not redirect or add HSTS for local %s", async (url) => {
    const env = makeEnv();
    const req = new Request(url);
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(req);
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });
});
