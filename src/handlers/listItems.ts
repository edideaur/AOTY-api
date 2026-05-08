import { json, stripHtml, extractMeta, extractOgMeta, extractTwMeta, splitArtistAlbum, fetchAoty } from "../utils";
import type { AlbumItem, ListMetadata, ParsedAlbumItem, JSONResponse } from "../types";

const URL_A_REGEX = /<a[^>]*href="([^"]+)"[^>]*itemprop="url"[^>]*>([^<]+)<\/a>/;

const parseAlbum = (rank: number, rowHtml: string): AlbumItem => {
  const urlMatch = rowHtml.match(URL_A_REGEX);
  const artistAlbum = urlMatch ? urlMatch[2] : "";
  const albumUrl = urlMatch ? `https://www.albumoftheyear.org${urlMatch[1]}` : "";

  const imgMatch = rowHtml.match(/<img[^>]*src="([^"]+)"[^>]*\/?>/);
  const image = imgMatch ? imgMatch[1].split("/").pop() || "" : "";

  const dateMatch = rowHtml.match(/<div class="albumListDate"[^>]*>([^<]+)<\/div>/);
  const releaseDate = dateMatch ? dateMatch[1].trim() : "";

  const genreMatch = rowHtml.match(/<div class="albumListGenre"[^>]*>([\s\S]*?)<div class="secondary-genres"/);
  const genre = genreMatch ? genreMatch[1].replace(/<[^>]+>/g, "").replace(/, $/, "").trim() : "";

  const scoreMatch = rowHtml.match(/<div class="scoreValue"[^>]*>(\d+)<\/div>/);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

  const otherListsMatch = rowHtml.match(/<div class="otherLists"[^>]*>In <strong>(\d+)<\/strong> Lists<\/div>/);
  const otherListsCount = otherListsMatch ? parseInt(otherListsMatch[1], 10) : null;

  const mustHearMatch = rowHtml.match(/class="[^"]*mustHear[^"]*"/);
  const mustHear = !!mustHearMatch;

  const blurbMatch = rowHtml.match(/<div class="albumListBlurb"[^>]*>([\s\S]*?)<div class="albumListBlurbLink"/);
  const blurb = blurbMatch ? stripHtml(blurbMatch[1]).trim() : "";

  const secondaryGenres: string[] = [];
  let secMatch;
  const secRegex = /<span class="secondary"[^>]*><a[^>]*>([^<]+)<\/a><\/span>/g;
  while ((secMatch = secRegex.exec(rowHtml)) !== null) {
    secondaryGenres.push(secMatch[1].trim());
  }

  return {
    rank,
    artistAlbum,
    image,
    score,
    genre,
    otherListsCount,
    blurb,
    releaseDate,
    url: albumUrl,
    secondaryGenres,
    mustHear,
  };
};

const parseMetadata = (html: string): ListMetadata => {
  const title = extractMeta(html, "Description")
    ? extractOgMeta(html, "og:title") || extractMeta(html, "Description")
    : html.match(/<h1 class="headline"[^>]*>([^<]+)<\/h1>/)?.[1] || "";

  return {
    title: title.trim(),
    description: extractMeta(html, "Description"),
    siteName: extractOgMeta(html, "og:site_name") || "Album of The Year",
    type: extractOgMeta(html, "og:type") || "article",
    image: extractOgMeta(html, "og:image"),
    twitterCard: extractTwMeta(html, "card") || "summary_large_image",
    twitterSite: extractTwMeta(html, "site") || "@aoty",
    twitterTitle: extractTwMeta(html, "title") || title.trim(),
    twitterDescription: extractTwMeta(html, "description") || extractMeta(html, "Description"),
    twitterImage: extractTwMeta(html, "image") || extractOgMeta(html, "og:image"),
    twitterUrl: extractTwMeta(html, "url") || "",
    fbAppId: extractOgMeta(html, "fb:app_id") || "387133090556",
    listImage: html.match(/<div class="listHeader"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*\/?>/)?.[1] || "",
    sourceUrl: html.match(/<div class="listHeader"[^>]*>[\s\S]*?<a class="gray"[^>]*href="([^"]+)"[^>]*>/)?.[1] || "",
  };
};

export const handleListItems = async (slug: string): Promise<JSONResponse> => {
  try {
    const res = await fetchAoty(`/list/${slug}/`);
    const html = new TextDecoder().decode(await res.arrayBuffer());
  const metadata = parseMetadata(html);

  const items: AlbumItem[] = [];

  let match;
  const rowRegex = /<div id="rank-(\d+)" class="albumListRow">([\s\S]*?)<div class="clear"><\/div>/g;
  while ((match = rowRegex.exec(html)) !== null) {
    const rank = parseInt(match[1], 10);
    const rowHtml = match[2];
    const album = parseAlbum(rank, rowHtml);
    items.push(album);
  }

  const sorted = items
    .filter((i): i is AlbumItem => i.rank !== null && !!i.artistAlbum.trim())
    .sort((a, b) => a.rank! - b.rank!)
    .map((item) => {
      const { artist, album } = splitArtistAlbum(item.artistAlbum);
      return {
        rank: item.rank!,
        artist,
        album,
        image: item.image,
        score: item.score,
        genre: item.genre,
        secondaryGenres: item.secondaryGenres,
        otherListsCount: item.otherListsCount,
        blurb: item.blurb,
        releaseDate: item.releaseDate,
        url: item.url,
        mustHear: item.mustHear,
      } as ParsedAlbumItem;
    });

  return json({ metadata, items: sorted });
  } catch {
    return json({ error: "Failed to fetch list" }, 500);
  }
};