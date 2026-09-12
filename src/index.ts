import { BASE, FETCH_OPTS, FETCH_OPTS_FRESH, RES_HEADERS, PROBLEM_HEADERS, CORS_HEADERS, cleanImageUrl, deepDecodeEntities, parseId, type FetchOpts } from "./constants.js";
import { openApiSpec } from "./openapi.js";
import { POSTMAN_BODY } from "./postman.js";
import { scrapeAlbumBlocks } from "./scrapers/albumBlock.js";
import { findAlbumUrl, scrapeAlbumCriticReviews, scrapeAlbumPage, scrapeAlbumTags, scrapeRandomAlbum, scrapeAlbumTagAutocomplete, scrapeRandomFilters } from "./scrapers/album.js";
import { scrapeNewsPageMeta, scrapeNewsFeed, scrapeNewsFeedXml } from "./scrapers/news.js";
import { scrapeListsIndex, scrapeListDetail, scrapeYearEndSummary, scrapeCommunityYearEnd } from "./scrapers/lists.js";
import { scrapeArtistSearch, scrapeLabelAutocomplete, scrapeLabelSearch, scrapeSearchAutocomplete, scrapeUserSearch } from "./scrapers/search.js";
import { scrapeAlbumStats, scrapeAlbumCredits, scrapeAlbumRatingHistory, scrapeAlbumDistribution, scrapeAlbumUsers, scrapeAlbumImages } from "./scrapers/albumExtras.js";
import { scrapeArtistPage, scrapeArtistTopSongs, scrapeSimilarArtists, scrapeArtistNews, scrapeArtistCredits, listArtistCreditRoles, scrapeRandomArtist, scrapeArtistDiscography, applyArtistImages, fetchArtistImage, scrapeArtistAka, scrapeArtistTagAutocomplete } from "./scrapers/artist.js";
import {
  scrapeArtistsOverview,
  scrapeCriticPage,
  scrapeGenrePage,
  scrapeGenresIndex,
  scrapeLabelPage,
  scrapePublicationListsPage,
  scrapePublicationPage,
  scrapePublicationPerfect,
  scrapePublicationReviewsPage,
  scrapeSubGenres,
  scrapeGenreName,
  scrapeGenreAutocomplete,
  scrapeTagPage,
  isTagSort,
} from "./scrapers/entities.js";
import { scrapeSongPage, scrapeSongRatingsPage, scrapeSongCriticLists, scrapeTopSongs, scrapeTopSongsPage, scrapeBestSongsYearEnd, scrapeBestSongsMeta, scrapeBestSongsLists } from "./scrapers/song.js";
import { scrapeRatingsChartPage, scrapeTopArtists, scrapeRatingSources, scrapeRatingGenres } from "./scrapers/charts.js";
import {
  scrapeAlbumCommentReplies,
  scrapeListCommentReplies,
  scrapeArtistCommentReplies,
  scrapeNewsEmbed,
  scrapeStatsRefresh,
  scrapeAlbumCriticLists,
  scrapeAlbumUserLists,
  scrapeAlbumSubAlbums,
  scrapeChangelog,
  scrapeCommentsPage,
  scrapeFaq,
  scrapeGuidelines,
  scrapeHomepage,
  scrapeNewsDetail,
  scrapeSearchNews,
  scrapeSearchTags,
  scrapeSiteStats,
  scrapeSiteUpdates,
  scrapeAllComments,
  scrapeEntityCorrections,
} from "./scrapers/social.js";
import {
  scrapeAlbumUserReviews,
  scrapeFollowArtists,
  scrapeFollowList,
  scrapeSearchLists,
  scrapeUserBadges,
  scrapeUserGenres,
  scrapeUserLibrary,
  scrapeUserLikedAlbums,
  scrapeUserListDetail,
  scrapeUserListened,
  scrapeUserLists,
  scrapeUserListsIndex,
  scrapeUserProfile,
  scrapeUserRatings,
  scrapeUserReviewBlocks,
  scrapeUserReviewDetail,
  scrapeUserReviewsPage,
  scrapeUserSpinList,
  scrapeUserTagDetail,
  scrapeUserTags,
  scrapeUsersCommunity,
  scrapeUserYearEnd,
  scrapeUserDistribution,
  scrapeUserArtistRatings,
  scrapeUserAlbumTrackRatings,
  scrapeUserPopup,
} from "./scrapers/user.js";
import type { AlbumDetail, RandomAlbumFilter } from "./types.js";

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
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Allow": "GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS",
    },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  const hasNullBody = res.status === 204 || res.status === 304 || res.body === null;
  return new Response(hasNullBody ? null : res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function toYaml(val: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (val === null) return "null";
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (typeof val === "string") {
    // quote strings containing special YAML chars or starting with special chars
    if (/[:{}[],#&*?|<>=!%@`]/.test(val) || /^[-?]/.test(val) || val.includes("\n"))
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
      const key = /[:{}[],#&*?|<>=!%@`\s]/.test(k) ? `"${k}"` : k;
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
  if (path.startsWith("/news") || path === "/feed/news" || path === "/feed/news.xml"
    || path === "/releases" || path === "/releases/singles" || path === "/releases/this-week" || path === "/releases/this-week/singles"
    || path === "/releases/by-date" || path === "/releases/month" || path === "/releases/week" || path === "/releases/vibe" || path === "/recently-added" || path === "/on-this-day"
    || path === "/discover" || path === "/discover/singles" || path === "/discover/people"
    || path === "/discover/anticipated" || path === "/discover/under-radar" || path === "/discover/top-rated"
    || path === "/updates" || path === "/users" || path === "/user-reviews" || path === "/home"
    || path === "/comments" || path === "/comments/all"
    || path === "/review/comments" || path === "/list/comments" || path === "/news-item/comments"
  ) return TTL.HOUR;

  // Upcoming / search / current-year charts / user content: 24 h
  if (path === "/upcoming" || path.startsWith("/search") || path === "/ratings"
    || path === "/top-artists" || path === "/songs/top" || path === "/artist/top-songs"
    || path === "/labels/autocomplete" || path === "/label/autocomplete"
    || path === "/genres/autocomplete" || path === "/genre/autocomplete"
    || path === "/artist/discography"
    || path === "/album/stats"
    || path === "/user/ratings" || path === "/user/perfect" || path === "/user/reviews" || path === "/user/lists"
    || path === "/user/listened" || path === "/user/library" || path === "/user/liked-albums"
    || path === "/user/spin-list" || path === "/user/following-artists"
    || path === "/user/tags" || path === "/user/tag" || path === "/user/genres" || path === "/user/badges"
    || path === "/user/stats" || path === "/user/favorites"
    || path.startsWith("/album/") || path === "/genre" || path === "/tag"
    || path === "/releases/decade"
  ) return TTL.DAY;

  if (path === "/releases/year") {
    const year = q.get("year");
    if (year && parseInt(year, 10) < new Date().getFullYear()) return TTL.MONTH;
    return TTL.HOUR;
  }

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

  if (path === "/artists") return TTL.HOUR;

  if (path === "/faq") return TTL.MONTH;

  if (path === "/stats") return TTL.HOUR;

  if (path === "/guidelines") return TTL.MONTH;

  if (path === "/changelog" || path === "/lists/users" || path === "/random/filters") return TTL.WEEK;

  if (
    path === "/album/user-lists"
    || path === "/album/critic-lists"
    || path === "/song/critic-lists"
    || path === "/album/critic-reviews"
    || path === "/album/reviews"
    || path === "/album/tags"
    || path === "/album/rating-history"
    || path === "/album/distribution"
    || path === "/album/images"
    || path === "/album/credits"
    || path === "/album/tracklist"
    || path === "/album/streaming"
    || path === "/album/streaming-links"
    || path === "/genre/name"
    || path === "/ratings/sources"
    || path === "/ratings/genres"
    || path === "/publication/perfect"
    || path === "/list/comments/replies"
    || path === "/artist/comments/replies"
  ) return TTL.MONTH;

  if (path === "/artist/credits" || path === "/artist/news" || path === "/artist/aka" || path === "/artist/tags/autocomplete" || path === "/artists/tags/autocomplete" || path === "/album/likes" || path === "/album/in-library" || path === "/user/artist-ratings" || path === "/user/track-ratings" || path === "/user/contributions" || path === "/user/stats/popup" || path === "/user/stats-popup" || path === "/album/corrections" || path === "/artist/corrections" || path === "/song/corrections" || path === "/corrections" || path === "/news-item/embed") return TTL.DAY;

  if (path === "/user/followers" || path === "/user/following" || path === "/user/distribution") return TTL.DAY;

  if (path === "/list/summary" || path === "/year-end" || path === "/songs/best" || path === "/songs/best/lists" || path === "/user/year-end") {
    const year = q.get("year");
    if (year && parseInt(year, 10) < new Date().getFullYear()) return TTL.MONTH;
    return TTL.WEEK;
  }

  if (path.startsWith("/list/")) return TTL.MONTH;

  if (path === "/album" || path === "/album/summary") {
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

export function buildCacheKey(url: URL): string {
  const qs = new URLSearchParams(
    [...url.searchParams.entries()].filter(([k]) => k !== "cache" && k !== "").sort()
  ).toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

export function getRequiredParam(q: URLSearchParams, key: string): string {
  const value = q.get(key);
  if (!value) throw new ApiError(`Missing required parameter: ${key}`, 400);
  return value;
}

export function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) return true;
  }
  return false;
}

export function normSlug(raw: string, keepSlashes = false): string {
  if (hasControlChars(raw)) {
    throw new ApiError("Invalid slug", 400);
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new ApiError("Invalid URI encoding in slug", 400);
  }
  if (hasControlChars(decoded)) {
    throw new ApiError("Invalid slug", 400);
  }
  let slug = decoded.trim().replace(/^\/+|\/+$/g, "");
  if (!keepSlashes) slug = slug.replace(/\/+$/, "");
  if (!slug) throw new ApiError("Slug cannot be empty", 400);
  if (slug.includes("..")) {
    throw new ApiError("Invalid slug", 400);
  }
  return slug;
}

const PAGE_NAV = `<style>
  .aoty-nav{display:flex;align-items:center;justify-content:space-between;padding:0 18px;height:50px;background:#18191c;color:rgba(255,255,255,.9);font-family:'Open Sans','Roboto',system-ui,-apple-system,sans-serif;font-weight:600;font-size:13px;position:sticky;top:0;z-index:1000;box-shadow:inset 0 -1px 0 #2f3136;}
  .aoty-nav nav{display:flex;align-items:center;gap:18px;}
  .aoty-nav a{display:flex;align-items:center;color:#b9bbbe;text-decoration:none;transition:color .15s;}
  .aoty-nav a:hover{color:#2ebd59;}
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
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    body {
      background: #202225;
      margin: 0;
      color: #ffffff;
      font-family: 'Open Sans', 'Roboto', system-ui, -apple-system, sans-serif;
    }

    /* AOTY Signature Theme for Scalar */
    :root,
    .light-mode,
    .dark-mode {
      --scalar-custom-header-height: 50px;
      --scalar-font: 'Open Sans', 'Roboto', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

      /* AOTY Dark Background Palette */
      --scalar-background-1: #202225;
      --scalar-background-2: #2f3136;
      --scalar-background-3: #36393f;
      --scalar-background-accent: rgba(46, 189, 89, 0.12);

      /* AOTY Typography & Muted Grays */
      --scalar-color-1: #ffffff;
      --scalar-color-2: #b9bbbe;
      --scalar-color-3: #72767d;
      --scalar-color-accent: #2ebd59;

      /* Borders */
      --scalar-border-color: #2f3136;

      /* Buttons & Highlights */
      --scalar-button-1: #2ebd59;
      --scalar-button-1-hover: #269e4a;
      --scalar-button-1-color: #ffffff;

      /* HTTP Verb Styling (AOTY Green/Blue/Yellow/Red) */
      --scalar-color-get: #2ebd59;
      --scalar-background-get: rgba(46, 189, 89, 0.14);
      --scalar-color-post: #4a70a9;
      --scalar-background-post: rgba(74, 112, 169, 0.14);
      --scalar-color-put: #e9bc1d;
      --scalar-background-put: rgba(233, 188, 29, 0.14);
      --scalar-color-delete: #d76666;
      --scalar-background-delete: rgba(215, 102, 102, 0.14);

      /* Sidebar & Search Navigation */
      --scalar-sidebar-background-1: #18191c;
      --scalar-sidebar-item-hover-background: #2f3136;
      --scalar-sidebar-item-active-background: rgba(46, 189, 89, 0.16);
      --scalar-sidebar-color-1: #ffffff;
      --scalar-sidebar-color-2: #b9bbbe;
      --scalar-sidebar-border-color: #26282c;
      --scalar-sidebar-search-background: #202225;
      --scalar-sidebar-search-border-color: #2f3136;
    }

    .custom-header {
      height: var(--scalar-custom-header-height);
      background-color: #18191c;
      box-shadow: inset 0 -1px 0 #2f3136;
      color: #ffffff;
      font-size: 13px;
      padding: 0 18px;
      position: sticky;
      display: flex;
      align-items: center;
      justify-content: space-between;
      top: 0;
      z-index: 100;
      font-family: 'Open Sans', 'Roboto', sans-serif;
    }
    .custom-header nav { display: flex; align-items: center; gap: 18px; }
    .custom-header nav a { display: flex; align-items: center; color: #b9bbbe; text-decoration: none; transition: color 0.15s; }
    .custom-header nav a:hover { color: #2ebd59; }
    .custom-header nav a svg { width: 18px; height: 18px; fill: currentColor; display: block; }
    .custom-header .site-title { font-weight: 700; font-size: 14px; letter-spacing: 0.5px; color: #ffffff; display: flex; align-items: center; gap: 6px; }
    .custom-header .site-title span.badge { background: #2ebd59; color: #000000; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
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
      <a href="https://ko-fi.com/edideaur" title="Ko-fi" aria-label="Ko-fi"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"/></svg></a>
    </nav>
  </header>
  <script id="api-reference" data-url="/openapi.json" data-configuration='{"theme":"none","darkMode":true,"hideModels":false}'></script>
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
    headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
  });
}

export function getPage(q: URLSearchParams): number {
  const raw = q.get("page");
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 1) return 1;
  return Math.min(n, 1000);
}

async function fetchAlbumBlocks(aotyPath: string, opts: FetchOpts) {
  const res = await fetch(`${BASE}${aotyPath}`, opts);
  if (!res.ok) throw new Error(`Upstream fetch failed: ${res.status}`);
  return scrapeAlbumBlocks(res);
}

const RESERVED_ALBUM_SUBPATHS = new Set([
  "similar", "summary", "user-reviews", "critic-reviews", "reviews", "comments",
  "tags", "rating-history", "distribution", "credits", "stats", "tracklist",
  "streaming", "streaming-links", "likes", "in-library", "library", "images",
  "corrections", "user-lists", "critic-lists",
]);

const RESERVED_ARTIST_SUBPATHS = new Set([
  "discography", "similar", "songs", "top-songs", "news", "credits", "corrections", "aka", "comments", "tags",
]);

const RESERVED_GENRE_SUBPATHS = new Set([
  "autocomplete", "name",
]);

const RESERVED_USER_SUBPATHS = new Set([
  "ratings", "perfect", "reviews", "listened", "library", "liked-albums",
  "tags", "tag", "lists", "list", "stats", "favorites", "followers",
  "following", "following-artists", "review", "genres", "badges", "year-end", "distribution",
  "artist-ratings", "track-ratings", "spin-list", "contributions", "stats-popup",
]);

const RESERVED_LIST_SUBPATHS = new Set([
  "summary", "comments",
]);

// Label listing sort orders (menu on label pages).
const LABEL_SORTS = new Set([
  "newest", "oldest",
  "critic-highest", "critic-lowest",
  "user-highest", "user-lowest",
  "artist-name", "album-name",
  "popularity", "likes",
]);

// Static / meta paths that cannot be embedded in a /batch request.
// They return HTML, XML or plaintext rather than API JSON.
const BATCH_BLOCKED_PATHS = new Set([
  "/", "/scalar", "/redoc", "/swagger", "/rapidoc", "/rapipdf", "/elements",
  "/openapi.json", "/openapi.yaml", "/postman.json", "/health", "/ping",
  "/version.json", "/manifest.json", "/opensearch.xml", "/sitemap.xml",
  "/feed/news.xml", "/robots.txt", "/humans.txt", "/favicon.ico",
  "/.well-known/health", "/.well-known/openapi.json", "/.well-known/security.txt",
  "/.well-known/ai-plugin.json", "/.well-known/api-catalog",
  "/batch",
]);

const BATCH_MAX_ITEMS = 10;
const BATCH_MAX_LENGTH = 4000;

export interface BatchItemResult {
  path: string;
  status: number;
  data?: unknown;
  error?: string | null;
}

export function parseBatchPaths(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const clean = items
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  if (clean.length === 0) throw new ApiError("Provide at least one path", 400);
  if (clean.length > BATCH_MAX_ITEMS) throw new ApiError(`Too many paths: max ${BATCH_MAX_ITEMS}`, 400);
  if (clean.join(",").length > BATCH_MAX_LENGTH) throw new ApiError(`paths is too long (max ${BATCH_MAX_LENGTH} chars)`, 400);
  for (const item of clean) {
    if (item.length > 2000) throw new ApiError("Individual path is too long (max 2000 chars)", 400);
  }
  return clean;
}

export async function executeBatchPaths(items: string[], opts: FetchOpts): Promise<{ count: number; results: BatchItemResult[] }> {
  const clean = parseBatchPaths(items);
  const results: BatchItemResult[] = await Promise.all(
    clean.map(async (item): Promise<BatchItemResult> => {
      let sub: URL;
      try {
        sub = new URL(item, "http://batch.local");
      } catch {
        return { path: item, status: 400, error: "Invalid path" };
      }
      const subPath = sub.pathname;
      if (BATCH_BLOCKED_PATHS.has(subPath) || subPath.startsWith("/.well-known/")) {
        return { path: item, status: 400, error: `Path not allowed in batch: ${subPath}` };
      }
      try {
        const data = await route(subPath, sub.searchParams, opts);
        return { path: item, status: 200, data };
      } catch (err) {
        if (err instanceof ApiError) return { path: item, status: err.status, error: err.message };
        return { path: item, status: 500, error: err instanceof Error ? err.message : "Unknown error" };
      }
    }),
  );
  return { count: results.length, results };
}

async function route(path: string, q: URLSearchParams, opts: FetchOpts): Promise<unknown> {
  let rawAlbumSlug = q.get("slug");
  if (!rawAlbumSlug) {
    const m = path.match(/^\/album\/([^/]+)$/);
    if (m?.[1] && !RESERVED_ALBUM_SUBPATHS.has(m[1])) {
      rawAlbumSlug = m[1];
    }
  }

  if (path === "/album" || (() => { const m = path.match(/^\/album\/([^/]+)$/); return !!m?.[1] && !RESERVED_ALBUM_SUBPATHS.has(m[1]); })()) {
    const artist = q.get("artist");
    const name = q.get("name");
    const minimal = q.get("minimal") === "true";

    let albumUrl: string | null;
    if (rawAlbumSlug) {
      const slug = normSlug(rawAlbumSlug);
      albumUrl = `${BASE}/album/${slug}/`;
    } else if (artist && name) {
      albumUrl = await findAlbumUrl(artist, name, opts);
      if (!albumUrl) throw new ApiError("Album not found", 404);
    } else {
      throw new ApiError("Provide either slug (ID or full slug) or both artist and name", 400);
    }

    // Artist image + stats + credits fan out in parallel; the scraper skips its own
    // sequential lookup here (minimal also skips it entirely).
    const detail = await scrapeAlbumPage(albumUrl, opts, false);
    if (!minimal && detail.id) {
      const [stats, credits, artistImage] = await Promise.all([
        scrapeAlbumStats(detail.id),
        scrapeAlbumCredits(detail.id),
        fetchArtistImage(detail.artistUrl, opts),
      ]);
      detail.stats = stats;
      detail.credits = credits;
      detail.artistImage = artistImage;
      // Summary producer/writer rows are text-only links; reuse credit photos by artist URL.
      if (credits) {
        const photos = credits.flatMap((section) => section.credits);
        applyArtistImages(detail.producers, photos);
        applyArtistImages(detail.writers, photos);
      }
    }
    return detail;
  }

  if (path === "/releases") {
    const page = getPage(q);
    const type = q.get("type");
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return { page, type: type ?? null, albums: await fetchAlbumBlocks(`/releases/${page}/${qs}`, opts) };
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
    const rawYear = q.get("year");
    const rawDecade = q.get("decade");
    const page = getPage(q);

    let aotyPath: string;
    let periodLabel: string;
    if (rawYear) {
      if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
      periodLabel = rawYear.trim();
      aotyPath = page > 1 ? `/must-hear/${periodLabel}/page/${page}/` : `/must-hear/${periodLabel}/`;
    } else if (rawDecade) {
      if (!/^\d{4}s$/.test(rawDecade.trim())) throw new ApiError("Invalid decade format", 400);
      periodLabel = rawDecade.trim();
      aotyPath = page > 1 ? `/must-hear/${periodLabel}/page/${page}/` : `/must-hear/${periodLabel}/`;
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
    const { items, hasNextPage } = await scrapeNewsPageMeta(`${BASE}/l/${feedType}/${page}/`, opts);
    return { page, type: feedType, hasNextPage, items };
  }

  const newsTypeMatch = path.match(/^\/news\/(newsworthy|new|comment)$/);
  if (newsTypeMatch?.[1]) {
    const feedType = newsTypeMatch[1];
    const page = getPage(q);
    const { items, hasNextPage } = await scrapeNewsPageMeta(`${BASE}/l/${feedType}/${page}/`, opts);
    return { page, type: feedType, hasNextPage, items };
  }

  if (path === "/feed/news") {
    return scrapeNewsFeed(opts);
  }

  if (path === "/lists") {
    const year = q.get("year");
    const sort = q.get("sort");
    const page = getPage(q);
    const params = new URLSearchParams();
    if (year) params.set("y", year);
    if (sort) params.set("sort", sort);
    if (page > 1) params.set("p", String(page));
    const qs = params.toString();
    const aotyUrl = qs ? `${BASE}/lists.php?${qs}` : `${BASE}/lists.php`;
    const { lists, sections } = await scrapeListsIndex(aotyUrl, opts);
    return { year: year ? parseInt(year, 10) : null, sort: sort ?? null, page, lists, sections };
  }

  if (path === "/list/summary") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear() - 1);
    if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
    const year = parseInt(rawYear.trim(), 10);
    const genre = q.get("genre");
    return scrapeYearEndSummary(year, genre, opts);
  }

  if (path === "/year-end") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear() - 1);
    if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
    const year = parseInt(rawYear.trim(), 10);
    return scrapeCommunityYearEnd(year, opts);
  }

  const listMatch = path.match(/^\/list\/(.+)$/);
  if (listMatch?.[1] && !RESERVED_LIST_SUBPATHS.has(listMatch[1].split("/")[0] ?? "")) {
    const slug = normSlug(listMatch[1]);
    return scrapeListDetail(`${BASE}/list/${slug}/`, opts);
  }

  if (path === "/search" || path === "/search/all") {
    const queryStr = getRequiredParam(q, "q");
    const enc = encodeURIComponent(queryStr);
    const [albums, artists, labels, lists, news, tags, users] = await Promise.all([
      fetchAlbumBlocks(`/search/albums/?q=${enc}`, opts),
      scrapeArtistSearch(`${BASE}/search/artists/?q=${enc}`, opts),
      scrapeLabelSearch(`${BASE}/search/labels/?q=${enc}`, opts),
      scrapeSearchLists(queryStr, opts),
      scrapeSearchNews(queryStr, opts),
      scrapeSearchTags(queryStr, opts),
      scrapeUserSearch(`${BASE}/search/?q=${enc}`, opts),
    ]);
    return { query: queryStr, albums, artists, labels, lists, news, tags, users };
  }

  if (path === "/search/albums") {
    const queryStr = getRequiredParam(q, "q");
    const page = getPage(q);
    const p = page > 1 ? `&p=${page}` : "";
    return { query: queryStr, page, albums: await fetchAlbumBlocks(`/search/albums/?q=${encodeURIComponent(queryStr)}${p}`, opts) };
  }

  if (path === "/search/artists") {
    const queryStr = getRequiredParam(q, "q");
    const page = getPage(q);
    const p = page > 1 ? `&p=${page}` : "";
    return { query: queryStr, page, artists: await scrapeArtistSearch(`${BASE}/search/artists/?q=${encodeURIComponent(queryStr)}${p}`, opts) };
  }

  if (path === "/search/labels") {
    const queryStr = getRequiredParam(q, "q");
    const page = getPage(q);
    const p = page > 1 ? `&p=${page}` : "";
    return { query: queryStr, page, labels: await scrapeLabelSearch(`${BASE}/search/labels/?q=${encodeURIComponent(queryStr)}${p}`, opts) };
  }

  if (path === "/search/lists") {
    const queryStr = getRequiredParam(q, "q");
    return scrapeSearchLists(queryStr, opts, getPage(q));
  }

  if (path === "/search/news") {
    const queryStr = getRequiredParam(q, "q");
    return scrapeSearchNews(queryStr, opts, getPage(q));
  }

  if (path === "/search/tags") {
    const queryStr = getRequiredParam(q, "q");
    return scrapeSearchTags(queryStr, opts, getPage(q));
  }

  if (path === "/search/users") {
    const queryStr = getRequiredParam(q, "q");
    const page = getPage(q);
    const p = page > 1 ? `&p=${page}` : "";
    return { query: queryStr, page, users: await scrapeUserSearch(`${BASE}/search/?q=${encodeURIComponent(queryStr)}${p}`, opts) };
  }

  if (path === "/search/autocomplete") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, suggestions: await scrapeSearchAutocomplete(queryStr, opts) };
  }

  if (path === "/labels/autocomplete" || path === "/label/autocomplete") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, suggestions: await scrapeLabelAutocomplete(queryStr, opts) };
  }

  let rawArtistSlug = q.get("slug");
  if (!rawArtistSlug) {
    const m = path.match(/^\/artist\/([^/]+)$/);
    if (m?.[1] && !RESERVED_ARTIST_SUBPATHS.has(m[1])) {
      rawArtistSlug = m[1];
    }
  }

  if (path === "/artist" || (() => { const m = path.match(/^\/artist\/([^/]+)$/); return !!m?.[1] && !RESERVED_ARTIST_SUBPATHS.has(m[1]); })()) {
    if (!rawArtistSlug) rawArtistSlug = getRequiredParam(q, "slug");
    const slug = normSlug(rawArtistSlug);
    const type = q.get("type");
    const sort = q.get("sort");
    const page = getPage(q);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (sort) params.set("s", sort);
    if (page > 1) params.set("p", String(page));
    const suffix = params.toString() ? `?${params}` : "";
    return scrapeArtistPage(`${BASE}/artist/${slug}/${suffix}`, opts);
  }

  if (path === "/artist/discography") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const type = q.get("type");
    const sort = q.get("sort");
    const page = getPage(q);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (sort) params.set("s", sort);
    if (page > 1) params.set("p", String(page));
    const suffix = params.toString() ? `?${params}` : "";
    return {
      slug,
      type: type ?? null,
      sort: sort ?? null,
      page,
      sections: await scrapeArtistDiscography(`${BASE}/artist/${slug}/${suffix}`, opts),
    };
  }

  if (path === "/artist/similar") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    return { slug, page, artists: await scrapeSimilarArtists(slug, opts, page) };
  }

  if (path === "/artist/songs" || path === "/artist/top-songs") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    const aotyPath = page > 1 ? `${BASE}/artist/${slug}/best-songs/${page}/` : `${BASE}/artist/${slug}/best-songs/`;
    return { slug, page, songs: await scrapeArtistTopSongs(aotyPath, opts) };
  }

  if (path === "/artist/news") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const type = q.get("type") ?? "newsworthy";
    if (type !== "newsworthy" && type !== "new") throw new ApiError("Invalid type: must be newsworthy or new", 400);
    return scrapeArtistNews(slug, opts, getPage(q), type);
  }

  if (path === "/artist/credits") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const role = q.get("role");
    if (!role) return listArtistCreditRoles(slug, opts);
    const sort = q.get("sort") ?? "";
    try {
      return await scrapeArtistCredits(slug, role, sort, opts);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Unknown credit role")) throw new ApiError(err.message, 400);
      throw err;
    }
  }

  if (path === "/artist/corrections") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeEntityCorrections("artist", slug, opts);
  }

  if (path === "/artist/aka") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeArtistAka(slug, opts);
  }

  if (path === "/artist/comments/replies") {
    const rawArtistId = q.get("artistId") ?? q.get("slug");
    if (!rawArtistId) throw new ApiError("Missing required parameter: artistId or slug", 400);
    const commentId = getRequiredParam(q, "commentId");
    return scrapeArtistCommentReplies(rawArtistId, commentId, opts);
  }

  if (path === "/artist/tags/autocomplete" || path === "/artists/tags/autocomplete") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, tags: await scrapeArtistTagAutocomplete(queryStr, opts) };
  }

  if (path === "/random/artist") {
    return scrapeRandomArtist(opts);
  }

  if (path === "/random/genre") {
    const genres = await scrapeGenresIndex(opts);
    const genre = genres[Math.floor(Math.random() * genres.length)];
    if (!genre) throw new ApiError("No genres found", 404);
    return { genre };
  }

  if (path === "/random/song") {
    const period = q.get("period") ?? q.get("year") ?? "all";
    const page = Math.floor(Math.random() * 3) + 1;
    const { songs } = await scrapeTopSongs(period, page, opts);
    const song = songs[Math.floor(Math.random() * songs.length)];
    if (!song) throw new ApiError("No songs found", 404);
    return { period, song };
  }

  if (path === "/random/must-hear") {
    const rawYear = q.get("year");
    const rawDecade = q.get("decade");
    let aotyPath = "/must-hear/";
    if (rawYear) {
      if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
      aotyPath = `/must-hear/${rawYear.trim()}/`;
    } else if (rawDecade) {
      if (!/^\d{4}s$/.test(rawDecade.trim())) throw new ApiError("Invalid decade format", 400);
      aotyPath = `/must-hear/${rawDecade.trim()}/`;
    }
    const albums = await fetchAlbumBlocks(aotyPath, opts);
    const album = albums[Math.floor(Math.random() * albums.length)];
    if (!album) throw new ApiError("No must-hear albums found", 404);
    return { album };
  }

  if (path === "/random/filters") {
    return scrapeRandomFilters(opts);
  }

  if (path === "/random/album" || path === "/random/release") {
    const filter: RandomAlbumFilter = {
      type: q.get("type") ?? undefined,
      yearFrom: q.get("yearFrom") ?? undefined,
      yearTo: q.get("yearTo") ?? undefined,
      genre: q.get("genre") ?? undefined,
      genreSecondary: q.get("genreSecondary") ?? undefined,
      criticScoreMin: q.get("criticScoreMin") ?? undefined,
      criticScoreMax: q.get("criticScoreMax") ?? undefined,
      userScoreMin: q.get("userScoreMin") ?? undefined,
      userScoreMax: q.get("userScoreMax") ?? undefined,
      criticReviewsMin: q.get("criticReviewsMin") ?? undefined,
      criticReviewsMax: q.get("criticReviewsMax") ?? undefined,
      userReviewsMin: q.get("userReviewsMin") ?? undefined,
      userReviewsMax: q.get("userReviewsMax") ?? undefined,
    };
    return scrapeRandomAlbum(opts, filter);
  }

  if (path === "/album/tags/autocomplete") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, tags: await scrapeAlbumTagAutocomplete(queryStr, opts) };
  }

  let rawLabelSlug = q.get("slug");
  if (!rawLabelSlug) {
    const m = path.match(/^\/label\/([^/]+)$/);
    if (m?.[1] && m[1] !== "autocomplete" && m[1] !== "singles") {
      rawLabelSlug = m[1];
    }
  }

  if (path === "/label" || (() => { const m = path.match(/^\/label\/([^/]+)$/); return !!m?.[1] && m[1] !== "autocomplete" && m[1] !== "singles"; })()) {
    if (!rawLabelSlug) rawLabelSlug = getRequiredParam(q, "slug");
    const slug = normSlug(rawLabelSlug);
    const page = getPage(q);
    const sort = q.get("sort");
    if (sort && !LABEL_SORTS.has(sort)) throw new ApiError(`Invalid sort: must be one of ${[...LABEL_SORTS].join(", ")}`, 400);
    const sortQs = sort ? `?sort=${encodeURIComponent(sort)}` : "";
    const aotyPath = page > 1 ? `${BASE}/label/${slug}/${page}/${sortQs}` : `${BASE}/label/${slug}/${sortQs}`;
    return scrapeLabelPage(aotyPath, opts, page);
  }

  if (path === "/label/singles") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    const sort = q.get("sort");
    if (sort && !LABEL_SORTS.has(sort)) throw new ApiError(`Invalid sort: must be one of ${[...LABEL_SORTS].join(", ")}`, 400);
    const sortQs = sort ? `?sort=${encodeURIComponent(sort)}` : "";
    const aotyPath = page > 1 ? `${BASE}/label/${slug}/singles/${page}/${sortQs}` : `${BASE}/label/${slug}/singles/${sortQs}`;
    return scrapeLabelPage(aotyPath, opts, page);
  }

  if (path === "/genres/autocomplete" || path === "/genre/autocomplete") {
    const queryStr = getRequiredParam(q, "q");
    return { query: queryStr, suggestions: await scrapeGenreAutocomplete(queryStr, opts) };
  }

  if (path === "/genres") {
    return { genres: await scrapeGenresIndex(opts) };
  }

  if (path === "/subgenres") {
    const genreId = getRequiredParam(q, "genreId");
    const rawBread = q.get("breadIds");
    const breadIds = rawBread ? rawBread.split(",").map((s) => s.trim()).filter(Boolean) : null;
    return scrapeSubGenres(genreId, breadIds, opts);
  }

  if (path === "/genre/name") {
    const genreId = getRequiredParam(q, "id");
    return scrapeGenreName(genreId, opts);
  }

  let rawGenreSlug = q.get("slug");
  if (!rawGenreSlug) {
    const m = path.match(/^\/genre\/([^/]+)$/);
    if (m?.[1] && !RESERVED_GENRE_SUBPATHS.has(m[1])) {
      rawGenreSlug = m[1];
    }
  }

  if (path === "/genre" || (() => { const m = path.match(/^\/genre\/([^/]+)$/); return !!m?.[1] && !RESERVED_GENRE_SUBPATHS.has(m[1]); })()) {
    if (!rawGenreSlug) rawGenreSlug = getRequiredParam(q, "slug");
    const slug = normSlug(rawGenreSlug);
    const period = (q.get("period") ?? "").trim();
    const page = getPage(q);
    const sort = q.get("sort");
    const minReviews = q.get("minReviews");
    const params = new URLSearchParams();
    if (sort === "standard") params.set("sort", "standard");
    if (minReviews) params.set("r", minReviews);
    const qs = params.toString() ? `?${params}` : "";
    let aotyPath: string;
    if (!period) aotyPath = `/genre/${slug}/`;
    else if (period === "recent") aotyPath = page > 1 ? `/genre/${slug}/recent/${page}/${qs}` : `/genre/${slug}/recent/${qs}`;
    else aotyPath = page > 1 ? `/genre/${slug}/${period}/${page}/${qs}` : `/genre/${slug}/${period}/${qs}`;
    return scrapeGenrePage(`${BASE}${aotyPath}`, slug, opts, page);
  }

  if (path === "/tag") {
    const tag = getRequiredParam(q, "tag");
    const type = q.get("type") ?? "albums";
    const year = q.get("year");
    if (type !== "albums" && type !== "media" && type !== "singles" && type !== "artists") throw new ApiError("Invalid type: must be albums, media, singles or artists", 400);
    const sort = q.get("sort") ?? "popularity";
    if (!isTagSort(sort)) throw new ApiError("Invalid sort: must be popularity, newest-first, critic-score or user-score", 400);
    return { ...(await scrapeTagPage(tag, type, year, opts, getPage(q), sort)), page: getPage(q) };
  }

  if (path === "/publication") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapePublicationPage(`${BASE}/publication/${slug}/`, slug, opts);
  }

  if (path === "/publication/reviews") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    const aotyPath = page > 1 ? `${BASE}/publication/${slug}/reviews/${page}/` : `${BASE}/publication/${slug}/reviews/`;
    return { slug, page, reviews: await scrapePublicationReviewsPage(aotyPath, opts) };
  }

  if (path === "/publication/lists") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    return { slug, page, lists: await scrapePublicationListsPage(`${BASE}/publication/${slug}/lists/`, opts, page) };
  }

  if (path === "/publication/perfect") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapePublicationPerfect(slug, opts);
  }

  if (path === "/artists") {
    return { sections: await scrapeArtistsOverview(opts) };
  }

  if (path === "/faq") {
    const section = q.get("section");
    return { items: await scrapeFaq(section, opts) };
  }

  if (path === "/changelog") {
    return { entries: await scrapeChangelog(opts) };
  }

  if (path === "/critic" || path === "/critic/reviews") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    const aotyPath = page > 1 ? `${BASE}/critic/${slug}/${page}/` : `${BASE}/critic/${slug}/`;
    return scrapeCriticPage(aotyPath, slug, opts, page);
  }

  if (path === "/song") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeSongPage(`${BASE}/song/${slug}/`, opts);
  }

  if (path === "/song/ratings") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeSongRatingsPage(slug, getPage(q), opts);
  }

  if (path === "/song/critic-lists") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeSongCriticLists(slug, opts);
  }

  if (path === "/song/corrections") {
    const id = q.get("songId") ?? q.get("slug");
    if (!id) throw new ApiError("Missing required parameter: songId or slug", 400);
    return scrapeEntityCorrections("song", id, opts);
  }

  if (path === "/songs/top") {
    const period = q.get("period") ?? q.get("year") ?? String(new Date().getFullYear());
    return scrapeTopSongsPage(period, getPage(q), opts);
  }

  if (path === "/songs/best") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear() - 1);
    if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
    const year = parseInt(rawYear.trim(), 10);
    const sort = q.get("sort") ?? "points";
    if (sort !== "points" && sort !== "lists") throw new ApiError("Invalid sort: must be points or lists", 400);
    const [result, meta] = await Promise.all([
      scrapeBestSongsYearEnd(year, sort, opts),
      scrapeBestSongsMeta(year, sort, opts).catch(() => null),
    ]);
    return { ...result, playlistUrl: meta?.playlistUrl ?? null, banner: meta?.banner ?? null, availableYears: meta?.availableYears ?? [] };
  }

  if (path === "/songs/best/lists") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear() - 1);
    if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
    const year = parseInt(rawYear.trim(), 10);
    const sort = q.get("sort") ?? "points";
    if (sort !== "points" && sort !== "lists") throw new ApiError("Invalid sort: must be points or lists", 400);
    return scrapeBestSongsLists(year, sort, opts);
  }

  let rawUserSlug = q.get("username");
  if (!rawUserSlug) {
    const m = path.match(/^\/user\/([^/]+)$/);
    if (m?.[1] && !RESERVED_USER_SUBPATHS.has(m[1])) {
      rawUserSlug = m[1];
    }
  }

  if (path === "/user" || (() => { const m = path.match(/^\/user\/([^/]+)$/); return !!m?.[1] && !RESERVED_USER_SUBPATHS.has(m[1]); })()) {
    const username = rawUserSlug ?? getRequiredParam(q, "username");
    return scrapeUserProfile(username, opts);
  }

  if (path === "/user/ratings") {
    const username = getRequiredParam(q, "username");
    return scrapeUserRatings(username, opts, {
      page: getPage(q),
      type: q.get("type"),
      decade: q.get("decade"),
      sort: q.get("sort"),
      year: q.get("year") ?? q.get("y"),
      genreId: q.get("genre") ?? q.get("genreId") ?? q.get("genreID"),
    });
  }

  if (path === "/user/perfect") {
    const username = getRequiredParam(q, "username");
    return scrapeUserRatings(username, opts, {
      page: getPage(q),
      sort: "perfect",
    });
  }

  if (path === "/user/reviews") {
    const username = getRequiredParam(q, "username");
    return scrapeUserReviewsPage(username, getPage(q), "recent", opts);
  }

  if (path === "/user/listened") {
    const username = getRequiredParam(q, "username");
    return scrapeUserListened(username, getPage(q), opts);
  }

  if (path === "/user/library") {
    const username = getRequiredParam(q, "username");
    return scrapeUserLibrary(username, opts, { show: q.get("t"), sort: q.get("s"), page: getPage(q) });
  }

  if (path === "/user/liked-albums") {
    const username = getRequiredParam(q, "username");
    return scrapeUserLikedAlbums(username, getPage(q), opts);
  }

  if (path === "/user/tags") {
    const username = getRequiredParam(q, "username");
    const scope = q.get("scope") ?? "albums";
    if (scope !== "albums" && scope !== "artists") throw new ApiError("Invalid scope: must be albums or artists", 400);
    const sort = q.get("sort");
    if (sort && sort !== "popularity" && sort !== "name") throw new ApiError("Invalid sort: must be popularity or name", 400);
    return scrapeUserTags(username, scope, sort, opts);
  }

  if (path === "/user/tag") {
    const username = getRequiredParam(q, "username");
    const tag = getRequiredParam(q, "tag");
    return scrapeUserTagDetail(username, tag, q.get("sort"), opts, getPage(q));
  }

  if (path === "/user/lists") {
    return scrapeUserLists(getRequiredParam(q, "username"), opts, getPage(q));
  }

  if (path === "/user/list") {
    const username = getRequiredParam(q, "username");
    const slug = normSlug(getRequiredParam(q, "slug"), true);
    return scrapeUserListDetail(username, slug, opts, { sort: q.get("sort"), page: getPage(q) });
  }

  if (path === "/user/followers") {
    const username = getRequiredParam(q, "username");
    return scrapeFollowList(username, "followers", getPage(q), opts);
  }

  if (path === "/user/following") {
    const username = getRequiredParam(q, "username");
    return scrapeFollowList(username, "following", getPage(q), opts);
  }

  if (path === "/user/following-artists") {
    const username = getRequiredParam(q, "username");
    return scrapeFollowArtists(username, getPage(q), opts);
  }

  if (path === "/user/spin-list") {
    const username = getRequiredParam(q, "username");
    return scrapeUserSpinList(username, getPage(q), opts);
  }

  if (path === "/user/review") {
    const username = getRequiredParam(q, "username");
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeUserReviewDetail(username, slug, opts);
  }

  if (path === "/user/genres") {
    const username = getRequiredParam(q, "username");
    return scrapeUserGenres(username, opts);
  }

  if (path === "/user/badges") {
    const username = getRequiredParam(q, "username");
    return scrapeUserBadges(username, opts);
  }

  if (path === "/user/stats") {
    const username = getRequiredParam(q, "username");
    const profile = await scrapeUserProfile(username, opts);
    return {
      username: profile.username,
      displayName: profile.displayName ?? profile.username,
      memberSince: profile.memberSince ?? null,
      subscriber: profile.subscriber,
      stats: profile.stats,
      ratingDistribution: profile.ratingDistribution,
    };
  }

  if (path === "/user/stats/popup" || path === "/user/stats-popup") {
    const userOrId = q.get("username") ?? q.get("userId") ?? q.get("id");
    if (!userOrId) throw new ApiError("Missing required parameter: username or userId", 400);
    return scrapeUserPopup(userOrId, "stats", opts);
  }

  if (path === "/user/contributions") {
    const userOrId = q.get("username") ?? q.get("userId") ?? q.get("id");
    if (!userOrId) throw new ApiError("Missing required parameter: username or userId", 400);
    return scrapeUserPopup(userOrId, "contributions", opts);
  }

  if (path === "/user/favorites") {
    const username = getRequiredParam(q, "username");
    const profile = await scrapeUserProfile(username, opts);
    return {
      username: profile.username,
      favorites: profile.favorites,
      favoriteArtists: profile.favoriteArtists,
    };
  }

  if (path === "/user/year-end") {
    const username = getRequiredParam(q, "username");
    const rawYear = getRequiredParam(q, "year");
    if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
    const year = parseInt(rawYear.trim(), 10);
    return scrapeUserYearEnd(username, year, opts);
  }

  if (path === "/user/distribution") {
    const username = getRequiredParam(q, "username");
    const format = q.get("format") ?? "albums";
    const validFormats = ["albums", "singles", "videos", "tracks"];
    if (!validFormats.includes(format)) throw new ApiError("Invalid format: must be albums, singles, videos or tracks", 400);
    return scrapeUserDistribution(username, format, opts);
  }

  if (path === "/user/artist-ratings") {
    const username = getRequiredParam(q, "username");
    const artistId = getRequiredParam(q, "artistId");
    return scrapeUserArtistRatings(username, artistId, opts);
  }

  if (path === "/user/track-ratings") {
    const username = getRequiredParam(q, "username");
    const albumIdOrSlug = q.get("albumId") ?? q.get("slug");
    if (!albumIdOrSlug) throw new ApiError("Missing required parameter: albumId or slug", 400);
    return scrapeUserAlbumTrackRatings(username, albumIdOrSlug, opts);
  }

  if (path === "/users") {
    return scrapeUsersCommunity(opts);
  }

  if (path === "/user-reviews") {
    const period = q.get("period") ?? "all";
    const valid: Record<string, string> = {
      all: "/user-reviews/",
      popular: "/user-reviews/popular/",
      month: "/user-reviews/popular/this-month/",
      year: "/user-reviews/popular/this-year/",
    };
    if (!(period in valid)) throw new ApiError("Invalid period: must be all, popular, month or year", 400);
    const page = getPage(q);
    if (page > 1 && period !== "all") throw new ApiError("Pagination is only available with period=all", 400);
    const base = valid[period];
    const url = page > 1 ? `${base}${page}/` : base;
    const res = await fetch(`${BASE}${url}`, opts);
    if (!res.ok) throw new Error(`User reviews fetch failed: ${res.status}`);
    return { period, page, reviews: await scrapeUserReviewBlocks(res) };
  }

  if (path === "/ratings/sources") {
    const year = q.get("year") ?? String(new Date().getFullYear());
    return scrapeRatingSources(year, opts);
  }

  if (path === "/ratings/genres") {
    const year = q.get("year") ?? String(new Date().getFullYear());
    const type = q.get("type") ?? "criticHighestRated";
    return scrapeRatingGenres(year, type, opts);
  }

  if (path === "/ratings") {
    const source = q.get("source") ?? "6-highest-rated";
    const period = q.get("period") ?? String(new Date().getFullYear());
    const page = getPage(q);
    const sort = q.get("sort");
    const minReviews = q.get("minReviews");
    const genre = q.get("genre");
    if (genre && source !== "user-highest-rated")
      throw new ApiError("Genre filtering is only available with source=user-highest-rated", 400);
    let aotyPath = `/ratings/${source}/${period}/${page}`;
    if (genre) aotyPath = `/ratings/${source}/${period}/${genre}/${page}`;
    const params = new URLSearchParams();
    if (sort === "standard") params.set("sort", "standard");
    if (minReviews) params.set("r", minReviews);
    const qs = params.toString();
    const { items, totalPages } = await scrapeRatingsChartPage(qs ? `${aotyPath}?${qs}` : aotyPath, opts);
    return { source, period, page, totalPages, items };
  }

  if (path === "/top-artists") {
    const genre = q.get("genre");
    const scope = q.get("scope") ?? "critics";
    const page = getPage(q);
    if (scope !== "critics" && scope !== "users") throw new ApiError("Invalid scope: must be critics or users", 400);
    return { genre: genre ?? null, scope, page, artists: await scrapeTopArtists(genre, scope, opts, page) };
  }

  if (path === "/releases/this-week/singles") {
    const page = getPage(q);
    return { page, albums: await fetchAlbumBlocks(page > 1 ? `/releases/this-week/singles/${page}/` : "/releases/this-week/singles/", opts) };
  }

  if (path === "/releases/this-week") {
    const page = getPage(q);
    return { page, albums: await fetchAlbumBlocks(page > 1 ? `/releases/this-week/${page}/` : "/releases/this-week/", opts) };
  }

  if (path === "/releases/year") {
    const rawYear = getRequiredParam(q, "year");
    if (!/^\d{4}$/.test(rawYear.trim())) throw new ApiError("Invalid year format", 400);
    const year = parseInt(rawYear.trim(), 10);
    const genre = q.get("genre");
    const page = getPage(q);
    const pageSuffix = page > 1 ? `${page}/` : "";
    let aotyPath = `/${year}/releases/${pageSuffix}`;
    if (genre) aotyPath += `?genre=${encodeURIComponent(genre)}`;
    return { year, genre: genre ?? null, page, albums: await fetchAlbumBlocks(aotyPath, opts) };
  }

  if (path === "/releases/decade") {
    const decade = getRequiredParam(q, "decade");
    const genre = q.get("genre");
    const page = getPage(q);
    const pageSuffix = page > 1 ? `${page}/` : "";
    let aotyPath = `/decade/${decade}/releases/${pageSuffix}`;
    if (genre) aotyPath += `?genre=${encodeURIComponent(genre)}`;
    return { decade, page, albums: await fetchAlbumBlocks(aotyPath, opts) };
  }

  if (path === "/releases/month") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear());
    const year = parseInt(rawYear, 10);
    const month = getRequiredParam(q, "month");
    const genre = q.get("genre");
    const page = getPage(q);
    const pageSuffix = page > 1 ? `${page}/` : "";
    let aotyPath = `/${year}/releases/${month}/${pageSuffix}`;
    if (genre) aotyPath += `?genre=${encodeURIComponent(genre)}`;
    return { year, month, page, albums: await fetchAlbumBlocks(aotyPath, opts) };
  }

  if (path === "/releases/week") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear());
    const year = parseInt(rawYear, 10);
    const rawWeek = getRequiredParam(q, "week");
    const week = parseInt(rawWeek, 10);
    const genre = q.get("genre");
    const page = getPage(q);
    const pageSuffix = page > 1 ? `${page}/` : "";
    let aotyPath = `/week/${year}/${rawWeek}/releases/${pageSuffix}`;
    if (genre) aotyPath += `?genre=${encodeURIComponent(genre)}`;
    return { year, week, page, albums: await fetchAlbumBlocks(aotyPath, opts) };
  }

  if (path === "/releases/by-date") {
    const rawYear = q.get("year") ?? String(new Date().getFullYear());
    const year = parseInt(rawYear, 10);
    const month = q.get("month");
    const rawWeek = q.get("week");
    const week = rawWeek ? parseInt(rawWeek, 10) : null;
    const decade = q.get("decade");
    const genre = q.get("genre");
    const page = getPage(q);
    const pageSuffix = page > 1 ? `${page}/` : "";
    let aotyPath: string;
    if (rawWeek) aotyPath = `/week/${year}/${rawWeek}/releases/${pageSuffix}`;
    else if (decade) aotyPath = `/decade/${decade}/releases/${pageSuffix}`;
    else if (month) aotyPath = `/${year}/releases/${month}/${pageSuffix}`;
    else aotyPath = `/${year}/releases/${pageSuffix}`;
    if (genre) aotyPath += `?genre=${encodeURIComponent(genre)}`;
    return { year, month: month ?? null, week, decade: decade ?? null, page, albums: await fetchAlbumBlocks(aotyPath, opts) };
  }

  if (path === "/releases/vibe") {
    const vibe = normSlug(getRequiredParam(q, "vibe"));
    const year = q.get("year");
    const sort = q.get("sort");
    const type = q.get("type");
    const page = getPage(q);

    if (sort && sort !== "release" && sort !== "critic" && sort !== "user" && sort !== "likes") {
      throw new ApiError("Invalid sort: must be release, critic, user or likes", 400);
    }

    const yearPrefix = year ? `/${year}` : "/all";
    const pageSuffix = page > 1 ? `${page}/` : "";
    let aotyPath = `${yearPrefix}/releases/vibe/${vibe}/${pageSuffix}`;
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (type) params.set("type", type);
    const qs = params.toString();
    if (qs) aotyPath += `?${qs}`;

    return {
      vibe,
      year: year ?? "all",
      sort: sort ?? "release",
      type: type ?? null,
      page,
      albums: await fetchAlbumBlocks(aotyPath, opts),
    };
  }

  if (path === "/recently-added") {
    const page = getPage(q);
    return { page, albums: await fetchAlbumBlocks(page > 1 ? `/recently-added/${page}/` : "/recently-added/", opts) };
  }

  if (path === "/on-this-day") {
    return { albums: await fetchAlbumBlocks("/on-this-day/", opts) };
  }

  if (path === "/discover/top-rated") {
    return { albums: await fetchAlbumBlocks("/discover/top-rated/", opts) };
  }

  if (path === "/discover/people") {
    return { albums: await fetchAlbumBlocks("/discover/people/", opts) };
  }

  if (path === "/news-item") {
    return scrapeNewsDetail(normSlug(getRequiredParam(q, "slug")), opts);
  }

  if (path === "/news-item/embed") {
    const id = getRequiredParam(q, "id");
    return scrapeNewsEmbed(id, opts);
  }

  if (path === "/album/similar") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    return scrapeAlbumSubAlbums(slug, "similar", opts, page);
  }

  if (path === "/album/user-reviews") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const sort = q.get("sort") ?? "popular";
    if (sort !== "popular" && sort !== "recent" && sort !== "worst") throw new ApiError("Invalid sort: must be popular, recent or worst", 400);
    const type = q.get("type") ?? "reviews";
    if (type !== "reviews" && type !== "ratings") throw new ApiError("Invalid type: must be reviews or ratings", 400);
    return scrapeAlbumUserReviews(slug, sort, getPage(q), opts, type);
  }

  if (path === "/album/critic-lists") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeAlbumCriticLists(slug, opts, getPage(q));
  }

  if (path === "/album/critic-reviews") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const sort = q.get("sort") ?? "highest";
    if (sort !== "highest" && sort !== "lowest" && sort !== "newest" && sort !== "oldest")
      throw new ApiError("Invalid sort: must be highest, lowest, newest or oldest", 400);
    return scrapeAlbumCriticReviews(slug, sort, opts);
  }

  if (path === "/album/reviews") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const reviewType = q.get("type") ?? "critic";
    if (reviewType !== "critic" && reviewType !== "user")
      throw new ApiError("Invalid type: must be critic or user", 400);
    if (reviewType === "user") {
      const sort = q.get("sort") ?? "popular";
      if (sort !== "popular" && sort !== "recent" && sort !== "worst")
        throw new ApiError("Invalid sort: must be popular, recent or worst", 400);
      return scrapeAlbumUserReviews(slug, sort, getPage(q), opts, "reviews");
    }
    const sort = q.get("sort") ?? "highest";
    if (sort !== "highest" && sort !== "lowest" && sort !== "newest" && sort !== "oldest")
      throw new ApiError("Invalid sort: must be highest, lowest, newest or oldest", 400);
    return scrapeAlbumCriticReviews(slug, sort, opts);
  }

  if (path === "/album/tags") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    return scrapeAlbumTags(slug, opts);
  }

  if (path === "/album/rating-history") {
    const slug = q.get("slug");
    const albumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!albumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    return scrapeAlbumRatingHistory(albumId);
  }

  if (path === "/album/distribution") {
    const slug = q.get("slug");
    const albumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!albumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    const format = q.get("format") ?? "all";
    if (format !== "all" && format !== "following") {
      throw new ApiError("Invalid format: must be all or following", 400);
    }
    return scrapeAlbumDistribution(albumId, format);
  }

  if (path === "/album/credits") {
    const slug = q.get("slug");
    const rawAlbumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!rawAlbumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    const albumId = parseId(rawAlbumId) ?? parseInt(rawAlbumId, 10);
    const credits = await scrapeAlbumCredits(albumId);
    return { albumId, credits };
  }

  if (path === "/album/stats") {
    const slug = q.get("slug");
    const rawAlbumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!rawAlbumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    const albumId = parseId(rawAlbumId) ?? parseInt(rawAlbumId, 10);
    const stats = await scrapeAlbumStats(albumId);
    return { albumId, stats };
  }

  if (path === "/album/tracklist") {
    const rawSlug = q.get("slug");
    const artist = q.get("artist");
    const name = q.get("name");
    let albumUrl: string | null;
    let norm: string | null = null;
    if (rawSlug) {
      norm = normSlug(rawSlug);
      albumUrl = `${BASE}/album/${norm}/`;
    } else if (artist && name) {
      albumUrl = await findAlbumUrl(artist, name, opts);
      if (!albumUrl) throw new ApiError("Album not found", 404);
    } else {
      throw new ApiError("Provide either slug (ID or full slug) or both artist and name", 400);
    }
    const detail = await scrapeAlbumPage(albumUrl, opts);
    return {
      slug: norm ?? (detail.url.match(/\/album\/([^/]+)/)?.[1] ?? null),
      artist: detail.artist,
      artistUrl: detail.artistUrl,
      artistImage: detail.artistImage,
      title: detail.title,
      url: detail.url,
      tracklist: detail.tracklist,
    };
  }

  if (path === "/album/streaming" || path === "/album/streaming-links") {
    const rawSlug = q.get("slug");
    const artist = q.get("artist");
    const name = q.get("name");
    let albumUrl: string | null;
    let norm: string | null = null;
    if (rawSlug) {
      norm = normSlug(rawSlug);
      albumUrl = `${BASE}/album/${norm}/`;
    } else if (artist && name) {
      albumUrl = await findAlbumUrl(artist, name, opts);
      if (!albumUrl) throw new ApiError("Album not found", 404);
    } else {
      throw new ApiError("Provide either slug (ID or full slug) or both artist and name", 400);
    }
    const detail = await scrapeAlbumPage(albumUrl, opts);
    return {
      slug: norm ?? (detail.url.match(/\/album\/([^/]+)/)?.[1] ?? null),
      artist: detail.artist,
      artistUrl: detail.artistUrl,
      artistImage: detail.artistImage,
      title: detail.title,
      url: detail.url,
      streamingLinks: detail.streamingLinks,
    };
  }

  if (path === "/album/likes") {
    const slug = q.get("slug");
    const albumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!albumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    const start = parseInt(q.get("start") ?? "0", 10) || 0;
    return scrapeAlbumUsers("albumLikes", albumId, start, opts);
  }

  if (path === "/album/in-library" || path === "/album/library") {
    const slug = q.get("slug");
    const albumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!albumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    const start = parseInt(q.get("start") ?? "0", 10) || 0;
    return scrapeAlbumUsers("albumLibrary", albumId, start, opts);
  }

  if (path === "/album/images") {
    const slug = q.get("slug");
    const albumId = q.get("albumId") ?? (slug ? slug.match(/^(\d+)/)?.[1] : null);
    if (!albumId) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    return scrapeAlbumImages(albumId, opts);
  }

  if (path === "/album/corrections") {
    const id = q.get("albumId") ?? q.get("slug");
    if (!id) throw new ApiError("Missing required parameter: albumId or slug with ID", 400);
    return scrapeEntityCorrections("album", id, opts);
  }

  if (path === "/corrections") {
    const type = getRequiredParam(q, "type");
    if (type !== "album" && type !== "artist" && type !== "song") {
      throw new ApiError("Invalid type: must be album, artist, or song", 400);
    }
    const id = q.get("id") ?? q.get("slug") ?? q.get("albumId") ?? q.get("songId");
    if (!id) throw new ApiError("Missing required parameter: id or slug", 400);
    return scrapeEntityCorrections(type, id, opts);
  }

  if (path === "/album/comments/replies") {
    const albumId = getRequiredParam(q, "albumId");
    const commentId = getRequiredParam(q, "commentId");
    return scrapeAlbumCommentReplies(albumId, commentId, opts);
  }

  if (path === "/list/comments/replies") {
    const listId = getRequiredParam(q, "listId");
    const commentId = getRequiredParam(q, "commentId");
    return scrapeListCommentReplies(listId, commentId, opts);
  }

  if (path === "/album/comments") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    const aotyPath = page > 1 ? `/album/${slug}/comments/${page}/` : `/album/${slug}/comments/`;
    const { comments, moreDiscussion } = await scrapeCommentsPage(aotyPath, opts);
    return { slug, page, comments, moreDiscussion };
  }

  if (path === "/comments" || path === "/comments/all") {
    const type = getRequiredParam(q, "type");
    const itemId = getRequiredParam(q, "itemId");
    const albumId = q.get("albumId");
    return scrapeAllComments(type, itemId, albumId, opts);
  }

  if (path === "/review/comments") {
    const id = q.get("id") ?? q.get("reviewId");
    if (!id) throw new ApiError("Missing required parameter: id or reviewId", 400);
    const albumId = q.get("albumId");
    return scrapeAllComments("user_review", id, albumId, opts);
  }

  if (path === "/list/comments") {
    const id = q.get("id") ?? q.get("listId");
    if (!id) throw new ApiError("Missing required parameter: id or listId", 400);
    return scrapeAllComments("user_list", id, null, opts);
  }

  if (path === "/news-item/comments") {
    const id = q.get("id") ?? q.get("linkId") ?? q.get("newsId");
    if (!id) throw new ApiError("Missing required parameter: id or newsId", 400);
    return scrapeAllComments("news", id, null, opts);
  }

  if (path === "/album/user-lists") {
    const slug = normSlug(getRequiredParam(q, "slug"));
    const page = getPage(q);
    return { slug, page, lists: await scrapeAlbumUserLists(slug, opts, page) };
  }

  if (path === "/lists/users") {
    const page = getPage(q);
    return { page, lists: await scrapeUserListsIndex(opts, page) };
  }

  if (path === "/updates") {
    return scrapeSiteUpdates(opts, q.get("filter"), getPage(q));
  }

  if (path === "/home") {
    return scrapeHomepage(opts);
  }

  if (path === "/stats") {
    return scrapeSiteStats(opts);
  }

  if (path === "/stats/refresh") {
    const key = getRequiredParam(q, "key");
    return scrapeStatsRefresh(key, opts);
  }

  if (path === "/album/summary") {
    const artist = q.get("artist");
    const name = q.get("name");
    const minimal = q.get("minimal") === "true";

    let albumUrl: string | null;
    if (rawAlbumSlug) {
      const slug = normSlug(rawAlbumSlug);
      albumUrl = `${BASE}/album/${slug}/`;
    } else if (artist && name) {
      albumUrl = await findAlbumUrl(artist, name, opts);
      if (!albumUrl) throw new ApiError("Album not found", 404);
    } else {
      throw new ApiError("Provide either slug (ID or full slug) or both artist and name", 400);
    }

    const detail: AlbumDetail = await scrapeAlbumPage(albumUrl, opts);
    const stats = !minimal && detail.id ? await scrapeAlbumStats(detail.id) : null;
    return {
      url: detail.url,
      id: detail.id,
      title: detail.title,
      artist: detail.artist,
      artistUrl: detail.artistUrl,
      cover: detail.cover,
      datePublished: detail.datePublished,
      datePublishedTimestamp: detail.datePublishedTimestamp ?? null,
      format: detail.format,
      label: detail.label,
      labelUrl: detail.labelUrl,
      labels: detail.labels,
      genres: detail.genres,
      genreLinks: detail.genreLinks,
      secondaryGenres: detail.secondaryGenres ?? [],
      tags: detail.tags,
      vibes: detail.vibes,
      totalLength: detail.totalLength,
      totalLengthSeconds: detail.totalLengthSeconds ?? null,
      trackCount: detail.tracklist.length,
      mustHear: detail.mustHear,
      commentCount: detail.commentCount,
      criticScore: detail.criticScore,
      criticScoreExact: detail.criticScoreExact,
      criticCount: detail.criticCount,
      criticRanking: detail.criticRanking ?? null,
      criticRankingAllTime: detail.criticRankingAllTime ?? null,
      userScore: detail.userScore,
      userScoreExact: detail.userScoreExact,
      userCount: detail.userCount,
      userRanking: detail.userRanking ?? null,
      userRankingAllTime: detail.userRankingAllTime ?? null,
      streamingLinks: detail.streamingLinks,
      stats,
    };
  }

  if (path === "/batch") {
    return executeBatchPaths(parseBatchPaths(getRequiredParam(q, "paths")), opts);
  }

  if (path === "/status") {
    return {
      name: "aoty-api",
      version: "1.0.0",
      openapi: "3.1.0",
      endpoints: Object.keys(openApiSpec.paths).length,
      timestamp: new Date().toISOString(),
    };
  }

  if (path === "/guidelines") {
    const type = q.get("type") ?? "review";
    if (type !== "review" && type !== "comment") {
      throw new ApiError("Invalid type: must be review or comment", 400);
    }
    return scrapeGuidelines(type, opts);
  }

  throw new ApiError("Not found", 404);
}

function computeEtag(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `W/"${text.length.toString(16)}-${(h >>> 0).toString(16)}"`;
}

export function sanitizeImageUrls<T>(val: T): T {
  if (typeof val === "string") {
    if (val.includes("albumoftheyear.org") && (/\/\d+x\d+\//.test(val) || val.includes("/cdn-cgi/image/") || val.includes("/sq/"))) {
      return cleanImageUrl(val) as unknown as T;
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeImageUrls) as unknown as T;
  }
  if (val !== null && typeof val === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeImageUrls(v);
    }
    return res as unknown as T;
  }
  return val;
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
        headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400", ...CORS_HEADERS },
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
        headers: { "Content-Type": "application/yaml", "Cache-Control": "public, max-age=3600", ...CORS_HEADERS },
      });
    }
    if (path === "/postman.json") {
      return new Response(POSTMAN_BODY, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/humans.txt") {
      return new Response(HUMANS_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400", ...CORS_HEADERS } });
    }
    if (path === "/.well-known/security.txt") {
      const canonical = `${url.origin}/.well-known/security.txt`;
      return new Response(
        `Contact: mailto:eduard@prigoana.com\nExpires: 2027-01-01T00:00:00Z\nPreferred-Languages: en\nCanonical: ${canonical}\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400", ...CORS_HEADERS } },
      );
    }
    if (path === "/.well-known/ai-plugin.json") {
      return new Response(AI_PLUGIN, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/sitemap.xml") {
      return new Response(SITEMAP_XML, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", ...CORS_HEADERS } });
    }
    if (path === "/feed/news.xml" || (path === "/feed/news" && q.get("format") === "xml")) {
      const xml = await scrapeNewsFeedXml(FETCH_OPTS);
      return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", ...CORS_HEADERS } });
    }
    if (path === "/ping") {
      return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", ...CORS_HEADERS } });
    }
    if (path === "/favicon.ico") {
      return Response.redirect("https://Prigoana.com/favicon.png", 302);
    }
    if (path === "/version.json") {
      return new Response(VERSION_JSON, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }
    if (path === "/manifest.json") {
      return new Response(MANIFEST_JSON, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600", ...CORS_HEADERS } });
    }
    if (path === "/opensearch.xml") {
      return new Response(buildOpenSearch(url.origin), { headers: { "Content-Type": "application/opensearchdescription+xml", "Cache-Control": "public, max-age=86400", ...CORS_HEADERS } });
    }
    if (path === "/.well-known/api-catalog") {
      return new Response(API_CATALOG, { headers: { ...RES_HEADERS, "Cache-Control": "public, max-age=3600" } });
    }

    const skipCache = q.get("cache") === "false";
    const noStore = (path.startsWith("/random/") && path !== "/random/filters") || path === "/batch" || path === "/status" || path === "/stats/refresh";
    const baseOpts = skipCache || noStore ? FETCH_OPTS_FRESH : FETCH_OPTS;
    const fetchOpts: FetchOpts = {
      ...baseOpts,
      signal: AbortSignal.timeout(15_000),
    };
    const cacheKey = buildCacheKey(url);

    if (!skipCache && !noStore) {
      let cached = await env.aoty_cache.get(cacheKey);
      if (cached !== null) {
        if (cached.includes("&")) {
          try {
            const parsed = JSON.parse(cached);
            cached = JSON.stringify(deepDecodeEntities(parsed));
          } catch {
            // keep raw cached if parse fails
          }
        }
        const ttl = computeTtl(path, q, null);
        const cc = ttl ? `public, max-age=${ttl}` : "public";
        const etag = computeEtag(cached);
        return new Response(cached, { headers: { ...RES_HEADERS, "X-Cache": "HIT", "Cache-Control": cc, "ETag": etag, "Server-Timing": `kv;desc="HIT"`, "Link": `</openapi.json>; rel="service-desc"` } });
      }
    }

    try {
      const t0 = Date.now();
      const rawData = await route(path, q, fetchOpts);
      const data = deepDecodeEntities(sanitizeImageUrls(rawData));
      const dur = Date.now() - t0;
      const body = JSON.stringify(data);
      const ttl = computeTtl(path, q, data);
      if (!noStore) {
        await env.aoty_cache.put(cacheKey, body, ttl ? { expirationTtl: ttl } : undefined);
      }
      const cc = noStore ? "no-store" : ttl ? `public, max-age=${ttl}` : "public";
      const etag = computeEtag(body);
      return new Response(body, { headers: { ...RES_HEADERS, "X-Cache": "MISS", "Cache-Control": cc, "ETag": etag, "Server-Timing": `kv;desc="MISS",fetch;dur=${dur}`, "Link": `</openapi.json>; rel="service-desc"` } });
    } catch (err) {
      if (err instanceof ApiError) return problem(err.message, err.status);
      if (err instanceof URIError) return problem(err.message, 400);
      return problem(err instanceof Error ? err.message : "Unknown error", 500);
    }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const method = request.method;
    if (method === "OPTIONS") {
      return corsOptions();
    }
    if (method === "POST") {
      let batchUrl: URL;
      try {
        batchUrl = new URL(request.url);
      } catch {
        return withCors(problem("Invalid request URL", 400));
      }
      if (batchUrl.pathname !== "/batch") {
        return withCors(new Response(null, { status: 405, headers: { "Allow": "GET, HEAD, OPTIONS" } }));
      }
      let parsed: unknown;
      try {
        const text = await request.text();
        if (text.length > 8192) return withCors(problem("Request body too large (max 8KB)", 400));
        parsed = text ? JSON.parse(text) : null;
      } catch {
        return withCors(problem("Invalid JSON body", 400));
      }
      try {
        const items = parseBatchPaths((parsed as Record<string, unknown> | null)?.["paths"]);
        const fetchOpts: FetchOpts = { ...FETCH_OPTS_FRESH, signal: AbortSignal.timeout(15_000) };
        const rawData = await executeBatchPaths(items, fetchOpts);
        const data = deepDecodeEntities(sanitizeImageUrls(rawData));
        const body = JSON.stringify(data);
        return withCors(new Response(body, {
          headers: { ...RES_HEADERS, "X-Cache": "MISS", "Cache-Control": "no-store", "Link": `</openapi.json>; rel="service-desc"` },
        }));
      } catch (err) {
        if (err instanceof ApiError) return withCors(problem(err.message, err.status));
        return withCors(problem(err instanceof Error ? err.message : "Unknown error", 500));
      }
    }
    if (method !== "GET" && method !== "HEAD") {
      return withCors(new Response(null, { status: 405, headers: { "Allow": "GET, HEAD, OPTIONS" } }));
    }
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return withCors(problem("Invalid request URL", 400));
    }
    const res = await handle(url, env);
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && res.status === 200) {
      const etag = res.headers.get("etag");
      if (etag && etag === ifNoneMatch) {
        return withCors(new Response(null, {
          status: 304,
          headers: {
            "ETag": etag,
            "Cache-Control": res.headers.get("cache-control") ?? "public",
          },
        }));
      }
    }
    return withCors(method === "HEAD" ? new Response(null, { status: res.status, headers: res.headers }) : res);
  },
};
