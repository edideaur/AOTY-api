import { error } from "./utils";
import { handleListItems } from "./handlers/listItems";
import { handleLists } from "./handlers/lists";
import { handleAlbum } from "./handlers/album";
import { handleDiscover, handleDiscoverCategory } from "./handlers/anticipated";
import { handleMustHear } from "./handlers/musthear";
import type { JSONResponse } from "./types";

const API_INFO = {
  name: "Album of the Year API",
  version: "1.0.0",
  endpoints: {
    "/": "API documentation",
    "/lists": "Get all year end lists (optional: ?y=2025 for specific year)",
    "/list?slug=<slug>": "Get a specific list by slug (e.g., ?slug=2618-the-needle-drops-top-50-albums-of-2025)",
    "/album?artist=<artist>&album=<album>": "Get album details with critics and user reviews",
    "/discover": "Get discover/popular albums with reviews",
    "/discover/albums": "Same as /discover",
    "/discover/singles": "Get discover singles with reviews",
    "/discover/top-rated": "Get top rated albums",
    "/discover/under-radar": "Get under the radar albums",
    "/discover/anticipated": "Get highly anticipated albums",
    "/musthear": "Get must hear albums (optional: ?page=2, ?decade=2020, ?year=2024)"
  },
  examples: {
    lists: [
      "GET /lists - All lists",
      "GET /lists?y=2025 - 2025 lists only"
    ],
    list: [
      "GET /list?slug=2618-the-needle-drops-top-50-albums-of-2025"
    ],
    album: [
      "GET /album?artist=Kanye+West&album=Late+Registration"
    ],
    discover: [
      "GET /discover",
      "GET /discover/albums",
      "GET /discover/singles",
      "GET /discover/top-rated",
      "GET /discover/under-radar",
      "GET /discover/anticipated"
    ],
    musthear: [
      "GET /musthear",
      "GET /musthear?page=2",
      "GET /musthear?decade=2020",
      "GET /musthear?decade=2020s&page=2",
      "GET /musthear?year=2024",
      "GET /musthear?year=2024&page=2"
    ]
  }
};

const handleRoot = (): JSONResponse => {
  return new Response(JSON.stringify(API_INFO, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

const handleRequest = async (request: Request): Promise<JSONResponse> => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const rawUrl = request.url;
  const qIdx = rawUrl.indexOf('?');
  const fixedUrl = qIdx === -1 ? rawUrl
    : rawUrl.slice(0, qIdx + 1) + rawUrl.slice(qIdx + 1).replace(/\?/g, '&');
  const url = new URL(fixedUrl);
  const pathname = url.pathname;
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  switch (pathname) {
    case "/":
      return handleRoot();

    case "/lists":
      return handleLists(params.y);

    case "/list": {
      if (!params.slug) return error("Missing slug parameter", 400);
      return handleListItems(params.slug);
    }

    case "/album": {
      if (!params.artist || !params.album) return error("Missing artist or album parameter", 400);
      return handleAlbum(params.artist, params.album);
    }

    case "/discover":
    case "/discover/albums": {
      return handleDiscover();
    }

    case "/discover/singles": {
      return handleDiscoverCategory("singles");
    }

    case "/discover/top-rated": {
      return handleDiscoverCategory("top-rated");
    }

    case "/discover/under-radar": {
      return handleDiscoverCategory("under-radar");
    }

    case "/discover/anticipated": {
      return handleDiscoverCategory("anticipated");
    }

    case "/musthear": {
      return handleMustHear(params.page || "1", params.decade || null, params.year || null);
    }

    default: {
      return error(`Unknown endpoint: ${pathname}. Available: /, /lists, /list, /album, /discover`, 404);
    }
  }
};

export default {
  fetch(request: Request): Promise<JSONResponse> {
    return handleRequest(request);
  }
};