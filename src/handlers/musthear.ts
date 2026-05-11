import { fetchAoty, json, parseCount } from "../utils";
import type { MustHearAlbum, JSONResponse } from "../types";

const parseAlbumBlock = (blockHtml: string): MustHearAlbum | null => {
  const linkMatch = blockHtml.match(/<a[^>]*href="(\/album\/[^"]+)"[^>]*>/);
  const url = linkMatch ? `https://www.albumoftheyear.org${linkMatch[1]}` : "";

  const imageMatch = blockHtml.match(/<img[^>]*src="([^"]+)"[^>]*\/?>/);
  const image = imageMatch ? imageMatch[1].split("/").pop() || "" : "";

  const artistMatch = blockHtml.match(/<div class="artistTitle"[^>]*>([^<]+)<\/div>/);
  const artist = artistMatch ? artistMatch[1].trim() : "";

  const albumMatch = blockHtml.match(/<div class="albumTitle"[^>]*>([^<]+)<\/div>/);
  const album = albumMatch ? albumMatch[1].trim() : "";

  const yearMatch = blockHtml.match(/<div class="type"[^>]*>\s*(\d{4})\s*<\/div>/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let criticScore: number | null = null;
  let criticCount: number | null = null;
  let userScore: number | null = null;
  let userCount: number | null = null;

  // Split on ratingRow openings — each segment after index 0 is the content of one row.
  // This avoids trying to balance nested divs (ratingBlock > ratingBar > green) with regex.
  const ratingRowParts = blockHtml.split('<div class="ratingRow">');
  for (let i = 1; i < ratingRowParts.length; i++) {
    const rowPart = ratingRowParts[i];
    const scoreMatch = rowPart.match(/<div class="rating">\s*(\d+)\s*<\/div>/);
    const typeMatch = rowPart.match(/<div class="ratingText">\s*(critic|user) score\s*<\/div>/);
    const countMatch = rowPart.match(/<div class="ratingText">\s*\(([\d,.]+K?)\)\s*<\/div>/);

    if (scoreMatch && typeMatch) {
      const score = parseInt(scoreMatch[1], 10);
      const type = typeMatch[1];
      const count = countMatch ? parseCount(countMatch[1]) : null;

      if (type === "critic") {
        criticScore = score;
        criticCount = count;
      } else {
        userScore = score;
        userCount = count;
      }
    }
  }

  if (!artist || !album) return null;

  return { artist, album, image, year, url, criticScore, criticCount, userScore, userCount };
};

const parseDecade = (decade: string | null): number | null => {
  if (!decade) return null;
  const cleaned = decade.replace(/s$/, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return null;
  if (cleaned.length !== 4) return null;
  if (num < 1950) return null;
  return num - (num % 10);
};

const parseYear = (year: string | null): number | null => {
  if (!year) return null;
  const cleaned = year.replace(/s$/, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return null;
  if (cleaned.length !== 4) return null;
  if (num < 1950 || num > 2030) return null;
  return num;
};

export const handleMustHear = async (page = "1", decade: string | null = null, year: string | null = null): Promise<JSONResponse> => {
  try {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return json({ error: `Invalid page "${page}", must be a positive integer` }, 400);
    }

    const decadeNum = parseDecade(decade);
    if (decade !== null && decadeNum === null) {
      return json({ error: `Invalid decade "${decade}", use a format like 1990 or 1990s` }, 400);
    }

    const yearNum = parseYear(year);
    if (year !== null && yearNum === null) {
      return json({ error: `Invalid year "${year}", use a 4-digit year between 1950 and 2030` }, 400);
    }
    let path: string;
    if (yearNum) {
      path = page === "1" ? `/must-hear/${yearNum}/` : `/must-hear/${yearNum}/page/${page}/`;
    } else if (decadeNum) {
      path = page === "1" ? `/must-hear/${decadeNum}s/` : `/must-hear/${decadeNum}s/page/${page}/`;
    } else {
      path = page === "1" ? "/must-hear/" : `/must-hear/page/${page}/`;
    }
    const res = await fetchAoty(path);
    const html = new TextDecoder().decode(await res.arrayBuffer());

    const albums: MustHearAlbum[] = [];

    // Split HTML into per-album blocks by finding each block's start position,
    // then slicing from one start to the next. This ensures each block includes
    // all its ratingRow divs (the old regex stopped at the first </div></div>).
    const blockStarts: number[] = [];
    const blockStartRegex = /<div class="albumBlock"[^>]*>/g;
    let bm: RegExpExecArray | null;
    while ((bm = blockStartRegex.exec(html)) !== null) {
      blockStarts.push(bm.index);
    }
    for (let i = 0; i < blockStarts.length; i++) {
      const blockHtml = html.slice(blockStarts[i], blockStarts[i + 1] ?? html.length);
      const album = parseAlbumBlock(blockHtml);
      if (album) albums.push(album);
    }

    const currentPage = parseInt(page, 10);

    let pageLinkPattern: RegExp;
    if (yearNum) {
      pageLinkPattern = new RegExp(`href="/must-hear/${yearNum}/page/(\\d+)/"`, "g");
    } else if (decadeNum) {
      pageLinkPattern = new RegExp(`href="/must-hear/${decadeNum}s/page/(\\d+)/"`, "g");
    } else {
      pageLinkPattern = /href="\/must-hear\/page\/(\d+)\/"/g;
    }
    const pageNums = Array.from(html.matchAll(pageLinkPattern), m => parseInt(m[1], 10));
    const totalPages = pageNums.length > 0 ? Math.max(...pageNums) : currentPage;
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;

    return json({
      page: currentPage,
      totalPages,
      nextPage,
      decade: decadeNum,
      year: yearNum,
      albums: albums.filter(Boolean),
    });
  } catch (e) {
    console.error("MustHear error:", e);
    return json({ error: "Failed to fetch must hear albums" }, 500);
  }
};