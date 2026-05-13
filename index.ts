import { BASE, RES_HEADERS } from "./constants.js";
import { openApiSpec } from "./openapi.js";
import { scrapeAlbumBlocks } from "./scrapers/albumBlock.js";
import { findAlbumUrl, scrapeAlbumPage } from "./scrapers/album.js";
import { scrapeNewsPage } from "./scrapers/news.js";
import { scrapeListsIndex, scrapeListDetail } from "./scrapers/lists.js";
import { scrapeArtistSearch, scrapeLabelSearch } from "./scrapers/search.js";
import { scrapeAlbumStats, scrapeAlbumCredits } from "./scrapers/albumExtras.js";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: RES_HEADERS });
}

function corsOptions(): Response {
  return new Response(null, { status: 204, headers: RES_HEADERS });
}

function scalarPage(): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>AOTY API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { --scalar-custom-header-height: 50px; }
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
  </style>
</head>
<body>
  <header class="custom-header scalar-app">
    <b>AOTY API</b>
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
    </nav>
  </header>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

async function fetchAlbumBlocks(aotyPath: string) {
  const res = await fetch(`${BASE}${aotyPath}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Upstream fetch failed: ${res.status}`);
  return scrapeAlbumBlocks(res);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname: path, searchParams: q } = url;

    if (request.method === "OPTIONS") return corsOptions();

    try {
      if (path === "/") {
        return scalarPage();
      }

      if (path === "/openapi.json") {
        return json(openApiSpec);
      }

      if (path === "/album") {
        const artist = q.get("artist");
        const name = q.get("name");
        const minimal = q.get("minimal") === "true";
        if (!artist || !name) {
          return json({ error: "Missing required parameters: artist, name" }, 400);
        }
        const albumUrl = await findAlbumUrl(artist, name);
        if (!albumUrl) {
          return json({ error: "Album not found" }, 404);
        }
        const detail = await scrapeAlbumPage(albumUrl);
        if (!minimal && detail.id) {
          const [stats, credits] = await Promise.all([
            scrapeAlbumStats(detail.id),
            scrapeAlbumCredits(detail.id),
          ]);
          detail.stats = stats;
          detail.credits = credits;
        }
        return json(detail);
      }

      if (path === "/releases") {
        const page = Math.max(1, parseInt(q.get("page") ?? "1", 10));
        const albums = await fetchAlbumBlocks(`/releases/${page}/`);
        return json({ page, albums });
      }

      if (path === "/releases/singles") {
        const page = Math.max(1, parseInt(q.get("page") ?? "1", 10));
        const albums = await fetchAlbumBlocks(`/releases/singles/${page}/`);
        return json({ page, albums });
      }

      if (path === "/upcoming") {
        const page = Math.max(1, parseInt(q.get("page") ?? "1", 10));
        const albums = await fetchAlbumBlocks(`/upcoming/${page}/`);
        return json({ page, albums });
      }

      if (path === "/discover") {
        const albums = await fetchAlbumBlocks("/discover/");
        return json({ albums });
      }

      if (path === "/discover/singles") {
        const albums = await fetchAlbumBlocks("/discover/singles/");
        return json({ albums });
      }

      if (path === "/discover/anticipated") {
        const albums = await fetchAlbumBlocks("/discover/anticipated/");
        return json({ albums });
      }

      if (path === "/discover/under-radar") {
        const albums = await fetchAlbumBlocks("/discover/under-radar/");
        return json({ albums });
      }

      if (path === "/must-hear") {
        const year = q.get("year");
        const decade = q.get("decade");
        const page = Math.max(1, parseInt(q.get("page") ?? "1", 10));

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

        const albums = await fetchAlbumBlocks(aotyPath);
        return json({ year: periodLabel, page, albums });
      }

      if (path === "/news") {
        const page = Math.max(1, parseInt(q.get("page") ?? "1", 10));
        const type = q.get("type") ?? "newsworthy";
        const validTypes = ["newsworthy", "new", "comment"];
        const feedType = validTypes.includes(type) ? type : "newsworthy";
        const aotyUrl = `${BASE}/l/${feedType}/${page}/`;
        const items = await scrapeNewsPage(aotyUrl);
        return json({ page, type: feedType, items });
      }

      if (path === "/lists") {
        const year = q.get("year");
        const aotyUrl = year
          ? `${BASE}/lists.php?y=${year}`
          : `${BASE}/lists.php`;
        const lists = await scrapeListsIndex(aotyUrl);
        return json({ year: year ? parseInt(year, 10) : null, lists });
      }

      const listMatch = path.match(/^\/list\/(.+)$/);
      if (listMatch) {
        const slug = listMatch[1];
        const aotyUrl = `${BASE}/list/${slug}/`;
        const result = await scrapeListDetail(aotyUrl);
        return json(result);
      }

      if (path === "/search") {
        const queryStr = q.get("q");
        if (!queryStr) return json({ error: "Missing required parameter: q" }, 400);
        const enc = encodeURIComponent(queryStr);

        const [albums, artists, labels] = await Promise.all([
          fetchAlbumBlocks(`/search/albums/?q=${enc}`),
          scrapeArtistSearch(`${BASE}/search/artists/?q=${enc}`),
          scrapeLabelSearch(`${BASE}/search/labels/?q=${enc}`),
        ]);
        return json({ query: queryStr, albums, artists, labels });
      }

      if (path === "/search/albums") {
        const queryStr = q.get("q");
        if (!queryStr) return json({ error: "Missing required parameter: q" }, 400);
        const albums = await fetchAlbumBlocks(`/search/albums/?q=${encodeURIComponent(queryStr)}`);
        return json({ query: queryStr, albums });
      }

      if (path === "/search/artists") {
        const queryStr = q.get("q");
        if (!queryStr) return json({ error: "Missing required parameter: q" }, 400);
        const artists = await scrapeArtistSearch(`${BASE}/search/artists/?q=${encodeURIComponent(queryStr)}`);
        return json({ query: queryStr, artists });
      }

      if (path === "/search/labels") {
        const queryStr = q.get("q");
        if (!queryStr) return json({ error: "Missing required parameter: q" }, 400);
        const labels = await scrapeLabelSearch(`${BASE}/search/labels/?q=${encodeURIComponent(queryStr)}`);
        return json({ query: queryStr, labels });
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return json({ error: message }, 500);
    }
  },
};
