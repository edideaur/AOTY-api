import type { JSONResponse } from "./types";

const CORSHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const metaNameRegex = (name: string) => new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]*)"`, "i");
const metaPropertyRegex = (property: string) => new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, "i");
const metaTwitterRegex = (name: string) => new RegExp(`<meta[^>]*name="twitter:${name}"[^>]*content="([^"]*)"`, "i");

const json = (data: unknown, status = 200): JSONResponse => {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORSHeaders,
  });
};

const error = (message: string, status = 500): JSONResponse => {
  return json({ error: message }, status);
};

const fetchAoty = async (path: string): Promise<Response> => {
  const url = path.startsWith("http") ? path : `https://www.albumoftheyear.org${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
  return res;
};

const extractNumbers = (str: string): string => {
  const match = str.match(/[\d,]+/);
  return match ? match[0] : "N/A";
};

const splitArtistAlbum = (artistAlbum: string): { artist: string; album: string } => {
  const sep = artistAlbum.indexOf(" - ");
  if (sep === -1) return { artist: artistAlbum.trim(), album: "" };
  return {
    artist: artistAlbum.slice(0, sep).trim(),
    album: artistAlbum.slice(sep + 3).trim(),
  };
};

const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .trim();
};

const extractMeta = (html: string, name: string): string => {
  const match = html.match(metaNameRegex(name));
  return match ? match[1] : "";
};

const extractOgMeta = (html: string, property: string): string => {
  const match = html.match(metaPropertyRegex(property));
  return match ? match[1] : "";
};

const extractTwMeta = (html: string, name: string): string => {
  const match = html.match(metaTwitterRegex(name));
  return match ? match[1] : "";
};

export {
  CORSHeaders,
  USER_AGENT,
  json,
  error,
  fetchAoty,
  extractNumbers,
  splitArtistAlbum,
  stripHtml,
  extractMeta,
  extractOgMeta,
  extractTwMeta,
};