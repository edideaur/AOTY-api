import { describe, it, expect } from "bun:test";
import worker from "../src/index.ts";

function req(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("CORS", () => {
  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await worker.fetch(req("/", "OPTIONS"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("GET responses include CORS headers", async () => {
    const res = await worker.fetch(req("/openapi.json"));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET /", () => {
  it("returns 200 HTML", async () => {
    const res = await worker.fetch(req("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("includes Scalar script tag", async () => {
    const res = await worker.fetch(req("/"));
    const text = await res.text();
    expect(text).toContain("scalar/api-reference");
  });

  it("includes AOTY API heading", async () => {
    const res = await worker.fetch(req("/"));
    const text = await res.text();
    expect(text).toContain("AOTY API");
  });

  it("links to Discord", async () => {
    const res = await worker.fetch(req("/"));
    const text = await res.text();
    expect(text).toContain("discord.gg/UdCUsd2X");
  });

  it("links to GitHub", async () => {
    const res = await worker.fetch(req("/"));
    const text = await res.text();
    expect(text).toContain("github.com/edideaur");
  });

  it("links to Instagram", async () => {
    const res = await worker.fetch(req("/"));
    const text = await res.text();
    expect(text).toContain("instagram.com/edideaur");
  });
});

describe("GET /openapi.json", () => {
  it("returns 200 JSON", async () => {
    const res = await worker.fetch(req("/openapi.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("is valid OpenAPI 3.0.3", async () => {
    const res = await worker.fetch(req("/openapi.json"));
    const body = await res.json() as Record<string, unknown>;
    expect(body.openapi).toBe("3.0.3");
    expect(body.paths).toBeDefined();
    expect(body.components).toBeDefined();
  });

  it("spec references /album endpoint", async () => {
    const res = await worker.fetch(req("/openapi.json"));
    const body = await res.json() as { paths: Record<string, unknown> };
    expect(body.paths["/album"]).toBeDefined();
  });
});

describe("404", () => {
  it("unknown path returns 404", async () => {
    const res = await worker.fetch(req("/does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("404 body has error field", async () => {
    const res = await worker.fetch(req("/does-not-exist"));
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });
});

describe("GET /album parameter validation", () => {
  it("returns 400 when both params missing", async () => {
    const res = await worker.fetch(req("/album"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name missing", async () => {
    const res = await worker.fetch(req("/album?artist=Kendrick+Lamar"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when artist missing", async () => {
    const res = await worker.fetch(req("/album?name=GNX"));
    expect(res.status).toBe(400);
  });

  it("400 body has error field", async () => {
    const res = await worker.fetch(req("/album"));
    const body = await res.json() as { error: string };
    expect(body.error).toContain("artist");
  });
});

describe("GET /search parameter validation", () => {
  const searchPaths = ["/search", "/search/albums", "/search/artists", "/search/labels"];

  for (const path of searchPaths) {
    it(`${path} returns 400 without q`, async () => {
      const res = await worker.fetch(req(path));
      expect(res.status).toBe(400);
    });

    it(`${path} 400 body has error field`, async () => {
      const res = await worker.fetch(req(path));
      const body = await res.json() as { error: string };
      expect(body.error).toBeDefined();
    });
  }
});

describe("response shape", () => {
  it("all errors return JSON content-type", async () => {
    for (const path of ["/album", "/search", "/does-not-exist"]) {
      const res = await worker.fetch(req(path));
      expect(res.headers.get("content-type")).toContain("application/json");
    }
  });
});
