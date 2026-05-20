export const BASE = "https://www.albumoftheyear.org";

export const REQ_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export type FetchOpts = { headers: HeadersInit; cf: { cacheTtl: number; cacheEverything?: boolean } };

export const FETCH_OPTS: FetchOpts = {
  headers: REQ_HEADERS,
  cf: { cacheTtl: 3600, cacheEverything: true },
};

export const FETCH_OPTS_FRESH: FetchOpts = {
  headers: REQ_HEADERS,
  cf: { cacheTtl: 0 },
};

export function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export const RES_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
