import { BASE, FETCH_OPTS, FETCH_OPTS_FRESH, RES_HEADERS, PROBLEM_HEADERS, type FetchOpts } from "./constants.js";
import { openApiSpec } from "./openapi.js";
import { POSTMAN_BODY } from "./postman.js";
import { scrapeAlbumBlocks } from "./scrapers/albumBlock.js";
import { findAlbumUrl, scrapeAlbumPage } from "./scrapers/album.js";
import { scrapeNewsPage } from "./scrapers/news.js";
import { scrapeListsIndex, scrapeListDetail } from "./scrapers/lists.js";
import { scrapeArtistSearch, scrapeLabelSearch } from "./scrapers/search.js";
import { scrapeAlbumStats, scrapeAlbumCredits } from "./scrapers/albumExtras.js";

const OPENAPI_BODY = JSON.stringify(openApiSpec);

interface Env {
  aoty_cache: KVNamespace;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function corsOptions(): Response {
  return new Response(null, { status: 204, headers: RES_HEADERS });
}

function toYaml(val: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (val === null) return "null";
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (typeof val === "string") {
    // quote strings containing special YAML chars or starting with special chars
    if (/[:{}\[\],#&*?|<>=!%@`]/.test(val) || /^[-?]/.test(val) || val.includes("\n"))
      return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    return val.map((v) => `\n${pad}- ${toYaml(v, indent + 1)}`).join("");
  }
  // object
  const entries = Object.entries(val as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([k, v]) => {
      const key = /[:{}\[\],#&*?|<>=!%@`\s]/.test(k) ? `"${k}"` : k;
      const rendered = toYaml(v, indent + 1);
      return typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length > 0
        ? `\n${pad}${key}:${rendered}`
        : Array.isArray(v) && (v as unknown[]).length > 0
        ? `\n${pad}${key}:${rendered}`
        : `\n${pad}${key}: ${rendered}`;
    })
    .join("");
}

const OPENAPI_YAML = `%YAML 1.2\n---${toYaml(openApiSpec)}\n`;

const HTTP_TITLES: Record<number, string> = {
  400: "Bad Request",
  404: "Not Found",
  500: "Internal Server Error",
};

function problem(detail: string, status: number): Response {
  return new Response(
    JSON.stringify({ type: "about:blank", title: HTTP_TITLES[status] ?? "Error", status, detail }),
    { status, headers: PROBLEM_HEADERS },
  );
}

const TTL = {
  HOUR:  3_600,
  DAY:   86_400,
  WEEK:  604_800,
  MONTH: 2_592_000,
} as const;

function computeTtl(path: string, q: URLSearchParams, data: unknown): number | undefined {
  // News + live listings refresh constantly
  if (path === "/news"
    || path === "/releases" || path === "/releases/singles"
    || path === "/discover" || path === "/discover/singles"
    || path === "/discover/anticipated" || path === "/discover/under-radar"
  ) return TTL.HOUR;

  // Upcoming / search / current-year must-hear: 24 h
  if (path === "/upcoming" || path.startsWith("/search")) return TTL.DAY;

  if (path === "/must-hear") {
    const year = q.get("year");
    const decade = q.get("decade");
    // past year or any decade is frozen
    if (decade || (year && parseInt(year, 10) < new Date().getFullYear())) return TTL.MONTH;
    return TTL.DAY;
  }

  if (path === "/lists") {
    const year = q.get("year");
    if (year && parseInt(year, 10) < new Date().getFullYear()) return TTL.MONTH;
    return TTL.WEEK;
  }

  if (path.startsWith("/list/")) return TTL.MONTH;

  if (path === "/album") {
    const datePublished = (data as { datePublished?: string })?.datePublished;
    if (datePublished) {
      const ageDays = (Date.now() - new Date(datePublished).getTime()) / 86_400_000;
      if (ageDays < 30)  return TTL.DAY;
      if (ageDays < 365) return TTL.MONTH;
      return undefined; // indefinite
    }
    return TTL.DAY; // unknown age: be conservative
  }

  return TTL.DAY;
}

function buildCacheKey(url: URL): string {
  const qs = new URLSearchParams(
    [...url.searchParams.entries()].filter(([k]) => k !== "cache" && k !== "").sort()
  ).toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

function getRequiredParam(q: URLSearchParams, key: string): string {
  const value = q.get(key);
  if (!value) throw new ApiError(`Missing required parameter: ${key}`, 400);
  return value;
}

const PAGE_NAV = `<style>
  .aoty-nav{display:flex;align-items:center;justify-content:space-between;padding:0 18px;height:50px;background:#0f0f0f;color:rgba(255,255,255,.9);font-family:Inter,sans-serif;font-weight:600;font-size:13px;position:sticky;top:0;z-index:1000;box-shadow:inset 0 -1px 0 #222;}
  .aoty-nav nav{display:flex;align-items:center;gap:18px;}
  .aoty-nav a{display:flex;align-items:center;color:inherit;text-decoration:none;}
  .aoty-nav a:hover{color:rgba(255,255,255,.5);}
  .aoty-nav svg{width:18px;height:18px;fill:currentColor;display:block;}
</style>
<header class="aoty-nav">
  <span>AOTY API</span>
  <nav>
    <a href="https://discord.gg/UdCUsd2X" title="Discord" aria-label="Discord"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg></a>
    <a href="https://github.com/edideaur/aoty-api/" title="GitHub" aria-label="GitHub"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.509 11.509 0 0 1 3.004-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg></a>
    <a href="https://instagram.com/edideaur" title="Instagram" aria-label="Instagram"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></a>
    <a href="https://ko-fi.com/edideaur" title="Ko-fi" aria-label="Ko-fi"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/></svg></a>
  </nav>
</header>`;

const SCALAR_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API</title>
  <link rel="icon" href="https://Prigoana.com/favicon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="AOTY API" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap" rel="stylesheet" />
  <style>
    body { background: #0f0f0f; }
    :root { --scalar-custom-header-height: 50px; --scalar-background-1: #0f0f0f; --scalar-border-color: #0f0f0f; --scalar-color-1: rgba(255,255,255,0.9); --scalar-color-2: rgba(255,255,255,0.5); }
    .custom-header {
      height: var(--scalar-custom-header-height);
      background-color: var(--scalar-background-1);
      box-shadow: inset 0 -1px 0 var(--scalar-border-color);
      color: var(--scalar-color-1);
      font-size: var(--scalar-font-size-2);
      padding: 0 18px;
      position: sticky;
      justify-content: space-between;
      top: 0;
      z-index: 100;
    }
    .custom-header, .custom-header nav { display: flex; align-items: center; gap: 18px; }
    .custom-header nav a { display: flex; align-items: center; color: inherit; }
    .custom-header nav a:hover { color: var(--scalar-color-2); }
    .custom-header nav a svg { width: 18px; height: 18px; fill: currentColor; display: block; }
    .custom-header .site-title { font-family: 'Inter', sans-serif; font-weight: 600; font-size: var(--scalar-font-size-2); }
  </style>
</head>
<body>
  <header class="custom-header scalar-app">
    <span class="site-title">AOTY API</span>
    <nav>
      <a href="https://discord.gg/UdCUsd2X" title="Discord" aria-label="Discord">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>
      </a>
      <a href="https://github.com/edideaur/aoty-api/" title="GitHub" aria-label="GitHub">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.509 11.509 0 0 1 3.004-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
      </a>
      <a href="https://instagram.com/edideaur" title="Instagram" aria-label="Instagram">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
      </a>
      <a href="https://ko-fi.com/edideaur" title="Ko-fi" aria-label="Ko-fi">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/></svg>
      </a>
    </nav>
  </header>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

const REDOC_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API - ReDoc</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="https://Prigoana.com/favicon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="AOTY API" />
  <style>body { margin: 0; }</style>
</head>
<body>
${PAGE_NAV}
  <redoc spec-url="/openapi.json" hide-download-button></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc/bundles/redoc.standalone.js"></script>
</body>
</html>`;

const RAPIDOC_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API - RapiDoc</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="https://Prigoana.com/favicon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="AOTY API" />
</head>
<body>
${PAGE_NAV}
  <rapi-doc spec-url="/openapi.json" theme="dark" render-style="read" show-header="false" primary-color="#f97316"></rapi-doc>
  <script type="module" src="https://cdn.jsdelivr.net/npm/rapidoc/dist/rapidoc-min.js"></script>
</body>
</html>`;

const ELEMENTS_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API - Elements</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="https://Prigoana.com/favicon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="AOTY API" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stoplight/elements/styles.min.css" />
</head>
<body style="margin:0">
${PAGE_NAV}
  <elements-api apiDescriptionUrl="/openapi.json" router="hash" layout="sidebar"></elements-api>
  <script src="https://cdn.jsdelivr.net/npm/@stoplight/elements/web-components.min.js"></script>
</body>
</html>`;

const SWAGGER_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API - Swagger UI</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="https://Prigoana.com/favicon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="AOTY API" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css" />
</head>
<body>
${PAGE_NAV}
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui", presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset], layout: "BaseLayout" });
  </script>
</body>
</html>`;

const RAPIPDF_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API - RapiPDF</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="https://Prigoana.com/favicon.png" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="AOTY API" />
  <style>body { margin: 0; background: #0f0f0f; } rapi-pdf { display: block; }</style>
</head>
<body>
${PAGE_NAV}
  <rapi-pdf spec-url="/openapi.json" theme="dark" button-bg="#f97316"></rapi-pdf>
  <script type="module" src="https://unpkg.com/rapipdf/dist/rapipdf-min.js"></script>
</body>
</html>`;

const HUMANS_TXT = `/* TEAM */
Developer: edideaur
Contact: eduard@prigoana.com
Location: Romania

/* THANKS */
albumoftheyear.org - for existing

/* SITE */
Language: TypeScript
Platform: Cloudflare Workers
`;

const AI_PLUGIN = JSON.stringify({
  schema_version: "v1",
  name_for_human: "AOTY API",
  name_for_model: "aoty_api",
  description_for_human: "Unofficial REST API for albumoftheyear.org. Get album details, scores, reviews, releases, and more.",
  description_for_model: "Use this API to look up albums, artist scores, critic and user reviews, releases, must-hear lists, and music news from albumoftheyear.org.",
  auth: { type: "none" },
  api: { type: "openapi", url: "/openapi.json" },
  logo_url: "https://Prigoana.com/favicon.png",
  contact_email: "eduard@prigoana.com",
  legal_info_url: "https://www.albumoftheyear.org",
});

const VERSION_JSON = JSON.stringify({ version: "1.0.0", openapi: "3.1.0" });

const MANIFEST_JSON = JSON.stringify({
  name: "AOTY API",
  short_name: "AOTY API",
  description: openApiSpec.info.description,
  start_url: "/",
  display: "standalone",
  background_color: "#0f0f0f",
  theme_color: "#0f0f0f",
  icons: [{ src: "https://Prigoana.com/favicon.png", sizes: "any", type: "image/png" }],
});

const API_CATALOG = JSON.stringify({
  apis: [{
    title: openApiSpec.info.title,
    description: openApiSpec.info.description,
    openapiDescriptionURL: "/openapi.json",
  }],
});

function buildOpenSearch(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>AOTY API</ShortName>
  <Description>Search albums, artists, and labels on Album of the Year</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="application/json" template="${origin}/search/albums?q={searchTerms}"/>
  <Image height="16" width="16" type="image/png">https://Prigoana.com/favicon.png</Image>
</OpenSearchDescription>`;
}

const SITEMAP_CLIENTS = ["/", "/scalar", "/redoc", "/swagger", "/rapidoc", "/rapipdf", "/elements"];
const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_CLIENTS.map((p) => `  <url><loc>${p}</loc></url>`).join("\n")}
${Object.keys(openApiSpec.paths).map((p) => `  <url><loc>${p}</loc></url>`).join("\n")}
</urlset>`;

function htmlPage(body: string): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

function getPage(q: URLSearchParams): number {
  const n = parseInt(q.get("page") ?? "1", 10);
  return n >= 1 ? n : 1;
}

async function fetchAlbumBlocks(aotyPath: string, opts: FetchOpts) {
  const res = await fetch(`${BASE}${aotyPath}`, opts);
  if (!res.ok) throw new Error(`Upstream fetch failed: ${res.status}`);
  return scrapeAlbumBlocks(res);
}

async function route(path: string, q: URLSearchParams, opts: FetchOpts): Promise<unknown> {
  if (path === "/album") {
    const slug = q.get("slug");
    const artist = q.get("artist");
    const name = q.get("name");
    const minimal = q.get("minimal") === "true";

    let albumUrl: string | null;
    if (slug) {
      albumUrl = `${BASE}/album/${slug}/`;
    } else if (artist && name) {
      albumUrl = await findAlbumUrl(artist, name, opts);
      if (!albumUrl) throw new ApiError("Album not found", 404);
    } else {
      throw new ApiError("Provide either slug (ID or full slug) or both artist and name", 400);
    }

    const detail = await scrapeAlbumPage(albumUrl, opts);
    if (!minimal && detail.id) {
      const [stats, credits] = await Promise.all([
        scrapeAlbumStats(detail.id),
        scrapeAlbumCredits(detail.id),
      ]);
      detail.stats = stats;
      detail.credits = credits;
    }
    return detail;
  }

  if (path === "/releases") {
    const page = getPage(q);
    return { page, albums: await fetchAlbumBlocks(`/releases/${page}/`, opts) };
  }

  if (path === "/releases/singles") {
    const page = getPage(q);
    return { page, albums: await fetchAlbumBlocks(`/releases/singles/${page}/`, opts) };
  }

  if (path === "/upcoming") {
    const page = getPage(q);
    return { page, albums: await fetchAlbumBlocks(`/upcoming/${page}/`, opts) };
  }

  if (path === "/discover") {
    return { albums: await fetchAlbumBlocks("/discover/", opts) };
  }

  if (path === "/discover/singles") {
    return { albums: await fetchAlbumBlocks("/discover/singles/", opts) };
  }

  if (path === "/discover/anticipated") {
    return { albums: await fetchAlbumBlocks("/discover/anticipated/", opts) };
  }

  if (path === "/discover/under-radar") {
    return { albums: await fetchAlbumBlocks("/discover/under-radar/", opts) };
  }

  if (path === "/must-hear") {
    const year = q.get("year");
    const decade = q.get("decade");
    const page = getPage(q);

    let aotyPath: string;
    let periodLabel: string;
    if (year) {
      periodLabel = year;
      aotyPath = page > 1 ? `/must-hear/${year}/page/${page}/` : `/must-hear/${year}/`;
    } else if (decade) {
      periodLabel = decade;
      aotyPath = `/must-hear/${decade}/`;
    } else {
      periodLabel = "all";
      aotyPath = "/must-hear/";
    }

    return { year: periodLabel, page, albums: await fetchAlbumBlocks(aotyPath, opts) };
  }

  if (path === "/news") {
    const page = getPage(q);
    const type = q.get("type") ?? "newsworthy";
    const validTypes = ["newsworthy", "new", "comment"];
    const feedType = validTypes.includes(type) ? type : "newsworthy";
    return { page, type: feedType, items: await scrapeNewsPage(`${BASE}/l/${feedType}/${page}/`, opts) };
  }

  if (path === "/lists") {
    const year = q.get("year");
    const aotyUrl = year ? `${BASE}/lists.php?y=${year}` : `${BASE}/lists.php`;
    return { year: year ? parseInt(year, 10) : null, lists: await scrapeListsIndex(aotyUrl, opts) };
  }

  const listMatch = path.match(/^\/list\/(.+)$/);
  if (listMatch) {
    return scrapeListDetail(`${BASE}/list/${listMatch[1]}/`, opts);
  }

  if (path === "/search") {
    const queryStr = getRequiredParam(q, "q");
    const enc = encodeURIComponent(queryStr);
    const [albums, artists, labels] = await Promise.all([
      fetchAlbumBlocks(`/search/albums/?q=${enc}`, opts),
      scrapeArtistSearch(`${BASE}/search/artists/?q=${enc}`, opts),
      scrapeLabelSearch(`${BASE}/search/labels/?q=${enc}`, opts),
    ]);
    return { query: queryStr, albums, artists, labels };
  }

  if (path === "/search/albums") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, albums: await fetchAlbumBlocks(`/search/albums/?q=${encodeURIComponent(queryStr)}`, opts) };
  }

  if (path === "/search/artists") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, artists: await scrapeArtistSearch(`${BASE}/search/artists/?q=${encodeURIComponent(queryStr)}`, opts) };
  }

  if (path === "/search/labels") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, labels: await scrapeLabelSearch(`${BASE}/search/labels/?q=${encodeURIComponent(queryStr)}`, opts) };
  }

  throw new ApiError("Not found", 404);
}

async function handle(url: URL, env: Env): Promise<Response> {
    const { pathname: path, searchParams: q } = url;
    if (path === "/" || path === "/scalar") return htmlPage(SCALAR_HTML);
    if (path === "/redoc") return htmlPage(REDOC_HTML);
    if (path === "/swagger") return htmlPage(SWAGGER_HTML);
if (path === "/rapidoc") return htmlPage(RAPIDOC_HTML);
    if (path === "/rapipdf") return htmlPage(RAPIPDF_HTML);
    if (path === "/elements") return htmlPage(ELEMENTS_HTML);
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", {
        headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" },
      });
    }
    if (path === "/health" || path === "/.well-known/health") {
      return new Response('{"status":"ok"}', { headers: { ...RES_HEADERS, "Cache-Control": "no-store" } });
    }
    if (path === "/openapi.json" || path === "/.well-known/openapi.json") {
      return new Response(OPENAPI_BODY, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/openapi.yaml") {
      return new Response(OPENAPI_YAML, {
        headers: { "Content-Type": "application/yaml", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
      });
    }
    if (path === "/postman.json") {
      return new Response(POSTMAN_BODY, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/humans.txt") {
      return new Response(HUMANS_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
    }
    if (path === "/.well-known/security.txt") {
      const canonical = `${url.origin}/.well-known/security.txt`;
      return new Response(
        `Contact: mailto:eduard@prigoana.com\nExpires: 2027-01-01T00:00:00Z\nPreferred-Languages: en\nCanonical: ${canonical}\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } },
      );
    }
    if (path === "/.well-known/ai-plugin.json") {
      return new Response(AI_PLUGIN, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/sitemap.xml") {
      return new Response(SITEMAP_XML, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/ping") {
      return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "/favicon.ico") {
      return Response.redirect("https://Prigoana.com/favicon.png", 302);
    }
    if (path === "/version.json") {
      return new Response(VERSION_JSON, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/manifest.json") {
      return new Response(MANIFEST_JSON, { headers: { "Content-Type": "application/manifest+json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/opensearch.xml") {
      return new Response(buildOpenSearch(url.origin), { headers: { "Content-Type": "application/opensearchdescription+xml", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400" } });
    }
    if (path === "/.well-known/api-catalog") {
      return new Response(API_CATALOG, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }

    const skipCache = q.get("cache") === "false";
    const fetchOpts = skipCache ? FETCH_OPTS_FRESH : FETCH_OPTS;
    const cacheKey = buildCacheKey(url);

    if (!skipCache) {
      const cached = await env.aoty_cache.get(cacheKey);
      if (cached !== null) {
        const ttl = computeTtl(path, q, null);
        const cc = ttl ? `public, max-age=${ttl}` : "public";
        return new Response(cached, { headers: { ...RES_HEADERS, "X-Cache": "HIT", "Cache-Control": cc, "Server-Timing": `kv;desc="HIT"`, "Link": `</openapi.json>; rel="service-desc"` } });
      }
    }

    try {
      const t0 = Date.now();
      const data = await route(path, q, fetchOpts);
      const dur = Date.now() - t0;
      const body = JSON.stringify(data);
      const ttl = computeTtl(path, q, data);
      await env.aoty_cache.put(cacheKey, body, ttl ? { expirationTtl: ttl } : undefined);
      const cc = ttl ? `public, max-age=${ttl}` : "public";
      return new Response(body, { headers: { ...RES_HEADERS, "X-Cache": "MISS", "Cache-Control": cc, "Server-Timing": `kv;desc="MISS",fetch;dur=${dur}`, "Link": `</openapi.json>; rel="service-desc"` } });
    } catch (err) {
      if (err instanceof ApiError) return problem(err.message, err.status);
      return problem(err instanceof Error ? err.message : "Unknown error", 500);
    }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const method = request.method;
    if (method === "OPTIONS") return corsOptions();
    if (method !== "GET" && method !== "HEAD") {
      return new Response(null, { status: 405, headers: { "Allow": "GET, HEAD, OPTIONS", "Access-Control-Allow-Origin": "*" } });
    }
    const res = await handle(new URL(request.url), env);
    return method === "HEAD" ? new Response(null, { status: res.status, headers: res.headers }) : res;
  },
};
