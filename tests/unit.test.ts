import { describe, it, expect } from "bun:test";
import { decodeEntities, deepDecodeEntities, cleanImageUrl, RES_HEADERS, PROBLEM_HEADERS } from "../src/constants.js";
import { sanitizeImageUrls } from "../src/index.js";
import { openApiSpec } from "../src/openapi.js";
import { POSTMAN_BODY } from "../src/postman.js";

describe("decodeEntities", () => {
  it("decodes basic HTML numeric entities", () => {
    expect(decodeEntities("&#38;")).toBe("&");
    expect(decodeEntities("&#60;")).toBe("<");
    expect(decodeEntities("&#62;")).toBe(">");
    expect(decodeEntities("&#34;")).toBe('"');
    expect(decodeEntities("&#39;")).toBe("'");
  });

  it("decodes hex entities", () => {
    expect(decodeEntities("&#x26;")).toBe("&");
    expect(decodeEntities("&#x3C;")).toBe("<");
    expect(decodeEntities("&#x3E;")).toBe(">");
    expect(decodeEntities("&#x22;")).toBe('"');
  });

  it("decodes named entities", () => {
    expect(decodeEntities("&amp;")).toBe("&");
    expect(decodeEntities("&lt;")).toBe("<");
    expect(decodeEntities("&gt;")).toBe(">");
    expect(decodeEntities("&quot;")).toBe('"');
    expect(decodeEntities("&apos;")).toBe("'");
    expect(decodeEntities("&nbsp;")).toBe(" ");
    expect(decodeEntities("&ldquo;")).toBe("\u201C");
    expect(decodeEntities("&rdquo;")).toBe("\u201D");
    expect(decodeEntities("&lsquo;")).toBe("\u2018");
    expect(decodeEntities("&rsquo;")).toBe("\u2019");
    expect(decodeEntities("&mdash;")).toBe("\u2014");
    expect(decodeEntities("&ndash;")).toBe("\u2013");
    expect(decodeEntities("&hellip;")).toBe("\u2026");
    expect(decodeEntities("&copy;")).toBe("\u00A9");
    expect(decodeEntities("&eacute;")).toBe("\u00E9");
  });

  it("decodes Latin-1 entities", () => {
    expect(decodeEntities("&oacute;")).toBe("\u00F3");
    expect(decodeEntities("&aacute;")).toBe("\u00E1");
    expect(decodeEntities("&iacute;")).toBe("\u00ED");
    expect(decodeEntities("&uacute;")).toBe("\u00FA");
    expect(decodeEntities("&ntilde;")).toBe("\u00F1");
    expect(decodeEntities("&auml;")).toBe("\u00E4");
    expect(decodeEntities("&ouml;")).toBe("\u00F6");
    expect(decodeEntities("&aring;")).toBe("\u00E5");
    expect(decodeEntities("&ccedil;")).toBe("\u00E7");
    expect(decodeEntities("lucy mir&oacute; al mundo y not&oacute; que est&aacute; girando")).toBe("lucy miró al mundo y notó que está girando");
  });

  it("decodes extended Latin and symbol entities", () => {
    expect(decodeEntities("&scaron; &Scaron; &zcaron; &Zcaron;")).toBe("š Š ž Ž");
    expect(decodeEntities("&ccaron; &Ccaron; &lstrok; &Lstrok;")).toBe("č Č ł Ł");
    expect(decodeEntities("&aogon; &eogon; &cacute; &sacute;")).toBe("ą ę ć ś");
    expect(decodeEntities("&abreve; &scedil; &tcedil; &odblac; &udblac;")).toBe("ă ş ţ ő ű");
  });

  it("handles double-escaped entities", () => {
    expect(decodeEntities("&amp;amp;")).toBe("&");
    expect(decodeEntities("&amp;quot;")).toBe('"');
    expect(decodeEntities("&amp;ldquo;")).toBe("\u201C");
    expect(decodeEntities("&amp;oacute;")).toBe("ó");
  });

  it("deepDecodeEntities decodes nested objects and arrays", () => {
    const data = {
      title: "lucy mir&oacute; al mundo y not&oacute; que est&aacute; girando",
      tracks: [
        { name: "Track &amp; Title", artists: ["AKRIILA &amp; Co."] },
      ],
      score: 84,
      nested: {
        quote: "&ldquo;Great Album&rdquo;",
      },
    };
    const decoded = deepDecodeEntities(data);
    expect(decoded.title).toBe("lucy miró al mundo y notó que está girando");
    expect(decoded.tracks[0]?.name).toBe("Track & Title");
    expect(decoded.tracks[0]?.artists[0]).toBe("AKRIILA & Co.");
    expect(decoded.nested.quote).toBe("“Great Album”");
    expect(decoded.score).toBe(84);
  });

  it("leaves normal strings unchanged", () => {
    expect(decodeEntities("Kendrick Lamar - GNX")).toBe("Kendrick Lamar - GNX");
    expect(decodeEntities("")).toBe("");
  });
});

describe("Headers constants", () => {
  it("RES_HEADERS has required CORS and Content-Type", () => {
    expect(RES_HEADERS["Content-Type"]).toBe("application/json");
    expect(RES_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
    expect(RES_HEADERS["Access-Control-Allow-Methods"]).toContain("GET");
  });

  it("PROBLEM_HEADERS has application/problem+json", () => {
    expect(PROBLEM_HEADERS["Content-Type"]).toBe("application/problem+json");
    expect(PROBLEM_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
  });
});

describe("OpenAPI Specification validity", () => {
  it("spec has required top-level metadata", () => {
    expect(openApiSpec.openapi).toBe("3.1.0");
    expect(openApiSpec.info).toBeDefined();
    expect(openApiSpec.info.title).toBe("Album of the Year API");
    expect(openApiSpec.info.version).toBeDefined();
    expect(openApiSpec.paths).toBeDefined();
    expect(openApiSpec.components).toBeDefined();
  });

  it("all endpoints in openApiSpec define valid operations", () => {
    const paths = Object.entries(openApiSpec.paths);
    expect(paths.length).toBeGreaterThanOrEqual(70);

    for (const [path, methods] of paths) {
      expect(path.startsWith("/")).toBe(true);
      const getMethod = (methods as Record<string, unknown>).get as Record<string, unknown> | undefined;
      expect(getMethod).toBeDefined();
      expect(typeof getMethod?.operationId).toBe("string");
      expect(getMethod?.responses).toBeDefined();
    }
  });

  it("all schemas in components are objects", () => {
    const schemas = openApiSpec.components?.schemas ?? {};
    const schemaEntries = Object.entries(schemas);
    expect(schemaEntries.length).toBeGreaterThan(10);

    for (const [name, schema] of schemaEntries) {
      expect(typeof name).toBe("string");
      expect(typeof schema).toBe("object");
    }
  });
});

describe("Postman collection", () => {
  it("contains valid Postman collection JSON", () => {
    const collection = JSON.parse(POSTMAN_BODY);
    expect(collection.info).toBeDefined();
    expect(collection.info.name).toBe("AOTY API");
    expect(Array.isArray(collection.item)).toBe(true);
    expect(collection.item.length).toBeGreaterThan(0);
  });
});

describe("cleanImageUrl and sanitizeImageUrls", () => {
  it("strips /200x0/ and other dimension prefixes from AOTY CDN URLs", () => {
    expect(cleanImageUrl("https://cdn2.albumoftheyear.org/200x0/album/1931016-prima_162200.jpg"))
      .toBe("https://cdn2.albumoftheyear.org/album/1931016-prima_162200.jpg");
    expect(cleanImageUrl("https://cdn2.albumoftheyear.org/375x0/album/564912-dont-be-dumb.jpg"))
      .toBe("https://cdn2.albumoftheyear.org/album/564912-dont-be-dumb.jpg");
    expect(cleanImageUrl("https://cdn2.albumoftheyear.org/50x0/album/100.jpg"))
      .toBe("https://cdn2.albumoftheyear.org/album/100.jpg");
    expect(cleanImageUrl("https://cdn2.albumoftheyear.org/750x0/album/100.jpg"))
      .toBe("https://cdn2.albumoftheyear.org/album/100.jpg");
  });

  it("strips cdn-cgi/image/ resize prefixes", () => {
    expect(cleanImageUrl("https://cdn.albumoftheyear.org/cdn-cgi/image/width=200,format=auto/album/1884687-lost-weekend.jpg"))
      .toBe("https://cdn.albumoftheyear.org/album/1884687-lost-weekend.jpg");
    expect(cleanImageUrl("https://cdn.albumoftheyear.org/cdn-cgi/image/width=350,format=auto/l/full/35652.jpg"))
      .toBe("https://cdn.albumoftheyear.org/l/full/35652.jpg");
  });

  it("strips /sq/ square-thumb segments from artist image URLs", () => {
    expect(cleanImageUrl("https://cdn.albumoftheyear.org/artists/sq/kanye-west_1586101900.jpg"))
      .toBe("https://cdn.albumoftheyear.org/artists/kanye-west_1586101900.jpg");
    expect(cleanImageUrl("https://cdn.albumoftheyear.org/artists/sq/death-grips_1762891915.jpg"))
      .toBe("https://cdn.albumoftheyear.org/artists/death-grips_1762891915.jpg");
    // combined with dimension prefixes
    expect(cleanImageUrl("https://cdn2.albumoftheyear.org/200x0/artists/sq/pic.jpg"))
      .toBe("https://cdn2.albumoftheyear.org/artists/pic.jpg");
  });

  it("leaves non-thumbnail URLs and null unchanged", () => {
    expect(cleanImageUrl(null)).toBeNull();
    expect(cleanImageUrl(undefined)).toBeUndefined();
    expect(cleanImageUrl("https://cdn2.albumoftheyear.org/album/1931016-prima_162200.jpg"))
      .toBe("https://cdn2.albumoftheyear.org/album/1931016-prima_162200.jpg");
    expect(cleanImageUrl("https://external.com/photo.jpg"))
      .toBe("https://external.com/photo.jpg");
  });

  it("recursively sanitizes image URLs in objects and arrays", () => {
    const input = {
      title: "Album",
      cover: "https://cdn2.albumoftheyear.org/200x0/album/1931016-prima_162200.jpg",
      nested: {
        avatar: "https://cdn.albumoftheyear.org/cdn-cgi/image/width=150,format=auto/user/pic.jpg",
      },
      list: [
        { image: "https://cdn2.albumoftheyear.org/375x0/album/pic2.jpg" },
        "https://cdn2.albumoftheyear.org/50x0/album/pic3.jpg",
      ],
    };

    const sanitized = sanitizeImageUrls(input);
    expect(sanitized.cover).toBe("https://cdn2.albumoftheyear.org/album/1931016-prima_162200.jpg");
    expect(sanitized.nested.avatar).toBe("https://cdn.albumoftheyear.org/user/pic.jpg");
    expect(sanitized.list[0].image).toBe("https://cdn2.albumoftheyear.org/album/pic2.jpg");
    expect(sanitized.list[1]).toBe("https://cdn2.albumoftheyear.org/album/pic3.jpg");
  });

  it("sanitizes /sq/ artist thumbnails to full-size URLs", () => {
    const input = {
      name: "Kanye West",
      image: "https://cdn.albumoftheyear.org/artists/sq/kanye-west_1586101900.jpg",
      similarArtists: [
        { name: "Death Grips", image: "https://cdn.albumoftheyear.org/artists/sq/death-grips_1762891915.jpg" },
      ],
    };
    const sanitized = sanitizeImageUrls(input);
    expect(sanitized.image).toBe("https://cdn.albumoftheyear.org/artists/kanye-west_1586101900.jpg");
    expect(sanitized.similarArtists[0].image).toBe("https://cdn.albumoftheyear.org/artists/death-grips_1762891915.jpg");
  });
});

describe("OpenAPI spec integrity", () => {
  it("has no dangling $ref schema references", () => {
    const defined = new Set(Object.keys(openApiSpec.components.schemas));
    const used = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record["$ref"] === "string") {
          const match = (record["$ref"] as string).match(/#\/components\/schemas\/(.+)/);
          if (match?.[1]) used.add(match[1]);
        }
        for (const item of Object.values(record)) walk(item);
      }
    };
    walk(openApiSpec.paths);
    const missing = [...used].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });

  it("defines ArtistLink and the previously missing result schemas", () => {
    const schemas = openApiSpec.components.schemas as Record<string, unknown>;
    for (const name of [
      "ArtistLink",
      "EntityCorrectionsResult",
      "UserAlbumTrackRatingsResult",
      "AlbumDistributionRow",
      "AllCommentsResult",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
  });

  it("ensures numeric fields in schemas are typed as integer or number, not string", () => {
    const schemas = openApiSpec.components.schemas as Record<string, { properties?: Record<string, { type?: string | string[] }>; allOf?: Array<{ properties?: Record<string, { type?: string | string[] }> }> }>;
    const numericFields = new Set([
      "criticScore", "criticCount", "userScore", "userCount", "rating", "ratingCount",
      "rank", "likes", "replies", "followers", "albumCount", "artistId",
      "albumsRated", "usedBy", "useCount", "points", "lengthSeconds", "durationSeconds",
      "totalLengthSeconds", "tracklistTotalLengthSeconds", "dateTimestamp", "dateExactTimestamp",
      "datePublishedTimestamp", "dateCreatedTimestamp", "dateModifiedTimestamp", "releaseDateTimestamp",
      "memberSinceTimestamp", "ratedDateTimestamp", "pubDateTimestamp", "addedOnTimestamp",
      "lastPostExactTimestamp",
    ]);

    for (const [schemaName, schema] of Object.entries(schemas)) {
      if (schemaName === "RandomFiltersMeta") continue;
      const props = schema.properties ?? {};
      if (schema.allOf) {
        for (const part of schema.allOf) {
          if (part.properties) Object.assign(props, part.properties);
        }
      }
      for (const [propName, propDef] of Object.entries(props)) {
        if (numericFields.has(propName)) {
          const typeStr = Array.isArray(propDef.type) ? propDef.type.join(",") : propDef.type;
          expect(typeStr).not.toContain("string");
          expect(typeStr === "integer" || typeStr === "number" || typeStr?.includes("integer") || typeStr?.includes("number")).toBe(true);
        }
      }
    }
  });

  it("uses unique operationIds across all paths", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (value !== null && typeof value === "object") {
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
          if (key === "operationId" && typeof item === "string") {
            if (seen.has(item)) dupes.push(item);
            seen.add(item);
          } else walk(item);
        }
      }
    };
    walk(openApiSpec.paths);
    expect(dupes).toEqual([]);
  });

  it("documents every data route including aliases", async () => {
    const source = await Bun.file(new URL("../src/index.ts", import.meta.url)).text();
    const routed = new Set<string>();
    for (const match of source.matchAll(/path === "([^"]+)"/g)) {
      if (match[1]) routed.add(match[1]);
    }
    // Doc/health/meta/infra endpoints intentionally excluded from the API spec.
    const excluded = new Set([
      "/",
      "/scalar",
      "/redoc",
      "/swagger",
      "/rapidoc",
      "/rapipdf",
      "/elements",
      "/robots.txt",
      "/health",
      "/.well-known/health",
      "/.well-known/api-catalog",
      "/.well-known/security.txt",
      "/.well-known/ai-plugin.json",
      "/openapi.json",
      "/.well-known/openapi.json",
      "/openapi.yaml",
      "/postman.json",
      "/humans.txt",
      "/sitemap.xml",
      "/version.json",
      "/manifest.json",
      "/opensearch.xml",
      "/favicon.ico",
      "/ping",
    ]);
    const specPaths = new Set(Object.keys(openApiSpec.paths));
    const undocumented = [...routed].filter((p) => !specPaths.has(p) && !excluded.has(p));
    expect(undocumented).toEqual([]);
  });
});
