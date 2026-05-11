import { fetchAoty, json, parseCount } from "../utils";
import type { AnticipatedAlbum, JSONResponse } from "../types";

export const handleDiscover = async (): Promise<JSONResponse> => {
  return handleDiscoverCategory("albums");
};

export const handleDiscoverCategory = async (category: string): Promise<JSONResponse> => {
  try {
    const path = category === "singles" ? "/discover/singles/" : category === "top-rated" ? "/discover/top-rated/" : category === "under-radar" ? "/discover/under-radar/" : category === "anticipated" ? "/discover/anticipated/" : "/discover/";
    const res = await fetchAoty(path);
    const html = new TextDecoder().decode(await res.arrayBuffer());

    const albums: AnticipatedAlbum[] = [];

    const albumBlockRegex = /<div class="albumBlock"[^>]*>([\s\S]*?)(?=<div class="albumBlock"[^>]*>|<div class="adTag|<div class="section")/g;
    let match;

    while ((match = albumBlockRegex.exec(html)) !== null) {
      const blockHtml = match[1];

      const imageMatch = blockHtml.match(/<img[^>]*src="([^"]+)"[^>]*\/?>/);
      const image = imageMatch ? imageMatch[1].split("/").pop() || "" : "";

      const artistMatch = blockHtml.match(/<div class="artistTitle"[^>]*>([^<]+)<\/div>/);
      const artist = artistMatch ? artistMatch[1].trim() : "";

      const albumMatch = blockHtml.match(/<div class="albumTitle"[^>]*>([^<]+)<\/div>/);
      const album = albumMatch ? albumMatch[1].trim() : "";

      const typeMatch = blockHtml.match(/<div class="type"[^>]*>([^<]+)<\/div>/);
      const releaseDate = typeMatch ? typeMatch[1].trim() : "";

      const linkMatch = blockHtml.match(/<div class="image"><a href="([^"]+)"[^>]*>/);
      const url = linkMatch ? `https://www.albumoftheyear.org${linkMatch[1]}` : "";

      let criticScore: number | null = null;
      let criticReviewCount: number | null = null;
      let userScore: number | null = null;
      let userReviewCount: number | null = null;

      const ratingRowParts = blockHtml.split('<div class="ratingRow">');
      for (let i = 1; i < ratingRowParts.length; i++) {
        const rowPart = ratingRowParts[i];
        const scoreMatch = rowPart.match(/<div class="rating">\s*(\d+)\s*<\/div>/);
        const typeMatch = rowPart.match(/<div class="ratingText">\s*(critic|user) score\s*<\/div>/);
        const countMatch = rowPart.match(/<div class="ratingText">\s*\(([\d,.]+K?)\)\s*<\/div>/);
        if (scoreMatch && typeMatch) {
          const s = parseInt(scoreMatch[1], 10);
          const count = countMatch ? parseCount(countMatch[1]) : null;
          if (typeMatch[1] === "critic") { criticScore = s; criticReviewCount = count; }
          else { userScore = s; userReviewCount = count; }
        }
      }

      const wantMatch = blockHtml.matchAll(/<div class="comment_count"[^>]*>([\d,]+)<\/div>/g);
      const wantCounts = Array.from(wantMatch, m => parseInt(m[1].replace(/,/g, ""), 10) || 0);
      const wantCount = wantCounts[0] || 0;

      if (artist && album) {
        albums.push({
          artist,
          album,
          image,
          releaseDate,
          url,
          criticScore,
          criticReviewCount,
          userScore,
          userReviewCount,
          wantCount,
        });
      }
    }

    return json({ albums });
  } catch {
    return json({ error: "Failed to fetch discover" }, 500);
  }
};