import { describe, it, expect } from "bun:test";
import worker from "../src/index.ts";

const mockEnv = {
  aoty_cache: { get: async () => null, put: async () => {} },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function req(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

function fetch(path: string, method = "GET") {
  return worker.fetch(req(path, method), mockEnv);
}

describe("CORS", () => {
  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await fetch("/", "OPTIONS");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("GET responses include CORS headers", async () => {
    const res = await fetch("/openapi.json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET /", () => {
  it("returns 200 HTML", async () => {
    const res = await fetch("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("includes Scalar script tag", async () => {
    const text = await (await fetch("/")).text();
    expect(text).toContain("scalar/api-reference");
  });

  it("includes AOTY API heading", async () => {
    const text = await (await fetch("/")).text();
    expect(text).toContain("AOTY API");
  });

  it("links to Discord", async () => {
    const text = await (await fetch("/")).text();
    expect(text).toContain("discord.gg/UdCUsd2X");
  });

  it("links to GitHub", async () => {
    const text = await (await fetch("/")).text();
    expect(text).toContain("github.com/edideaur");
  });

  it("links to Instagram", async () => {
    const text = await (await fetch("/")).text();
    expect(text).toContain("instagram.com/edideaur");
  });
});

describe("GET /openapi.json", () => {
  it("returns 200 JSON", async () => {
    const res = await fetch("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("is valid OpenAPI 3.1.0", async () => {
    const body = await (await fetch("/openapi.json")).json() as Record<string, unknown>;
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths).toBeDefined();
    expect(body.components).toBeDefined();
  });

  it("spec references /album endpoint", async () => {
    const body = await (await fetch("/openapi.json")).json() as { paths: Record<string, unknown> };
    expect(body.paths["/album"]).toBeDefined();
  });
});

describe("404", () => {
  it("unknown path returns 404", async () => {
    const res = await fetch("/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("404 body has detail field (RFC 9457)", async () => {
    const body = await (await fetch("/does-not-exist")).json() as { detail: string; status: number };
    expect(body.detail).toBeDefined();
    expect(body.status).toBe(404);
  });
});

describe("GET /album parameter validation", () => {
  it("returns 400 when both params missing", async () => {
    const res = await fetch("/album");
    expect(res.status).toBe(400);
  });

  it("returns 400 when name missing", async () => {
    const res = await fetch("/album?artist=Kendrick+Lamar");
    expect(res.status).toBe(400);
  });

  it("returns 400 when artist missing", async () => {
    const res = await fetch("/album?name=GNX");
    expect(res.status).toBe(400);
  });

  it("400 body has detail field (RFC 9457)", async () => {
    const body = await (await fetch("/album")).json() as { detail: string; status: number };
    expect(body.detail).toContain("artist");
    expect(body.status).toBe(400);
  });
});

describe("GET /search parameter validation", () => {
  const searchPaths = ["/search", "/search/albums", "/search/artists", "/search/labels"];

  for (const path of searchPaths) {
    it(`${path} returns 400 without q`, async () => {
      const res = await fetch(path);
      expect(res.status).toBe(400);
    });

    it(`${path} 400 body has detail field (RFC 9457)`, async () => {
      const body = await (await fetch(path)).json() as { detail: string; status: number };
      expect(body.detail).toBeDefined();
      expect(body.status).toBe(400);
    });
  }
});

describe("response shape", () => {
  it("all errors return application/problem+json content-type", async () => {
    for (const path of ["/album", "/search", "/does-not-exist"]) {
      const res = await fetch(path);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
    }
  });
});
