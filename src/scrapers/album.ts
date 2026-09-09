import { BASE, FETCH_OPTS, REQ_HEADERS, decodeEntities, cleanImageUrl, parseCount, parseScore, parseExactScore, parseId, parseRank, parseTrackNumber, type FetchOpts } from "../constants.js";
import type {
  AlbumBlock,
  AlbumDetail,
  AlbumAllTimeRanking,
  AlbumRankingInfo,
  AlbumUserListPreview,
  AotyComment,
  ArtistLink,
  CriticListRank,
  CriticReview,
  NamedLink,
  RandomAlbumFilter,
  RandomFiltersMeta,
  StreamingLink,
  Track,
  UserReview,
} from "../types.js";
import { scrapeAlbumBlocks } from "./albumBlock.js";
import { fetchArtistImage } from "./artist.js";

export async function findAlbumUrl(artist: string, name: string, opts: FetchOpts = FETCH_OPTS): Promise<string | null> {
  const q = encodeURIComponent(`${artist} - ${name}`);
  const res = await fetch(`${BASE}/search/albums/?q=${q}`, opts);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);

  const found = { url: null as string | null };
  await new HTMLRewriter()
    .on(".albumBlock .image a", {
      element(el) {
        if (!found.url) {
          const href = el.getAttribute("href");
          if (href) found.url = BASE + href;
        }
      },
    })
    .transform(res)
    .arrayBuffer();

  return found.url;
}

export async function scrapeAlbumPage(pageUrl: string, opts: FetchOpts = FETCH_OPTS, includeArtistImage = true): Promise<AlbumDetail> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Album fetch failed: ${res.status}`);
  const htmlPromise = res.clone().text();

  const s = {
    jsonLdText: "",
    criticScoreDisplay: "",
    criticScoreExact: "",
    userScoreDisplay: "",
    userScoreExact: "",
    criticCountRaw: "",
    userCountRaw: "",
    albumId: "",
    detailRowIndex: -1,
    detailRowTexts: [] as string[],
    labels: [] as Array<{ name: string; url: string }>,
    genreLinks: [] as Array<{ name: string; url: string }>,
    tags: [] as string[],
    vibes: [] as string[],
    totalLength: null as string | null,
    mustHear: false,
    streamingLinks: [] as StreamingLink[],
    tracks: [] as Array<{ number: string; title: string; url: string; length: string; rating: string | null; ratingCount: number | null; notes: string | null; features: string[]; featureLinks: ArtistLink[] }>,
    track: null as { number: string; title: string; url: string; length: string; rating: string | null; ratingCount: number | null; notes: string | null; features: string[]; featureLinks: ArtistLink[] } | null,
    trackTitleBuf: "",
    inTrackTitle: false,
    featureLink: null as ArtistLink | null,
    reviews: [] as Array<Record<string, string>>,
    review: null as Record<string, string> | null,
    reviewTextBuf: "",
    reviewActionCount: 0,
  };

  await new HTMLRewriter()
    .on('script[type="application/ld+json"]', {
      text(t) { s.jsonLdText += t.text; },
    })
    .on(".albumCriticScore a", {
      element(el) { s.criticScoreExact = el.getAttribute("title") ?? ""; },
      text(t) { s.criticScoreDisplay += t.text; },
    })
    .on(".albumUserScore a", {
      element(el) { s.userScoreExact = el.getAttribute("title") ?? ""; },
      text(t) { s.userScoreDisplay += t.text; },
    })
    .on(".albumCriticScoreBox .text.numReviews", {
      text(t) { s.criticCountRaw += t.text; },
    })
    .on(".albumUserScoreBox .text.numReviews", {
      text(t) { s.userCountRaw += t.text; },
    })
    .on("button.showImage", {
      element(el) { if (!s.albumId) s.albumId = el.getAttribute("data-id") ?? ""; },
    })
    .on(".albumTopBox.info .detailRow", {
      element() { s.detailRowIndex++; s.detailRowTexts.push(""); },
      text(t) { if (s.detailRowIndex >= 0) s.detailRowTexts[s.detailRowIndex] += t.text; },
    })
    .on(".albumTopBox.info .detailRow a[href*='/label/']", {
      element(el) {
        const href = el.getAttribute("href");
        if (href) s.labels.push({ name: "", url: BASE + href });
      },
      text(t) {
        const last = s.labels[s.labels.length - 1];
        if (last) last.name += t.text;
      },
    })
    .on(".albumTopBox.info .detailRow a[href*='/tag/']", {
      text(t) { const v = t.text.trim(); if (v) s.tags.push(v); },
    })
    .on(".albumTopBox.info .detailRow a[href*='/genre/']", {
      element(el) {
        const href = el.getAttribute("href");
        if (href) s.genreLinks.push({ name: "", url: BASE + href });
      },
      text(t) {
        const last = s.genreLinks[s.genreLinks.length - 1];
        if (last) last.name += t.text;
      },
    })
    // Bottom "Tags" section (the info box has no tag row on live pages)
    .on("div.tag a[href*='/tag/']", {
      text(t) { const v = t.text.trim(); if (v) s.tags.push(v); },
    })
    .on(".mustHearButton", {
      element() { s.mustHear = true; },
    })
    .on(".detailRow.vibes .vibe a", {
      text(t) { const v = t.text.trim(); if (v) s.vibes.push(v); },
    })
    .on(".totalLength", {
      text(t) {
        const text = t.text.trim();
        if (text) s.totalLength = (s.totalLength ?? "") + text;
      },
    })
    .on(".albumLinksFlex a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        const title = el.getAttribute("title") ?? "";
        const rel = el.getAttribute("rel") ?? "";
        if (rel.includes("nofollow") && href.startsWith("http")) {
          s.streamingLinks.push({ platform: title, url: href });
        }
      },
    })
    .on(".trackListTable tr", {
      element() {
        if (s.track && !s.track.title && s.trackTitleBuf) {
          s.track.title = s.trackTitleBuf.trim();
        }
        s.track = { number: "", title: "", url: "", length: "", rating: null, ratingCount: null, notes: null, features: [], featureLinks: [] };
        s.tracks.push(s.track);
        s.trackTitleBuf = "";
        s.inTrackTitle = false;
        s.featureLink = null;
      },
    })
    .on(".trackNumber", {
      text(t) { if (s.track) s.track.number = (s.track.number ?? "") + t.text; },
    })
    .on(".trackTitle a", {
      element(el) {
        if (s.track && !s.track.url) {
          const href = el.getAttribute("href");
          if (href) s.track.url = BASE + href;
          s.inTrackTitle = true;
          s.trackTitleBuf = "";
        }
      },
      text(t) { if (s.inTrackTitle) s.trackTitleBuf += t.text; },
    })
    .on(".trackTitle .length", {
      element() {
        s.inTrackTitle = false;
        if (s.track) s.track.title = s.trackTitleBuf.trim();
      },
      text(t) { if (s.track) s.track.length = (s.track.length ?? "") + t.text; },
    })
    .on(".trackTitle .trackNotes", {
      text(t) { if (s.track) s.track.notes = (s.track.notes ?? "") + t.text; },
    })
    .on(".trackTitle .featuredArtists a", {
      element(el) {
        // Featured-artist links are artist links; keep name-only behavior for anything else.
        const href = el.getAttribute("href") ?? "";
        if (s.track && href.includes("/artist/")) {
          s.featureLink = {
            name: "",
            url: href.startsWith("http") ? href : BASE + href,
            image: null,
          };
          s.track.featureLinks.push(s.featureLink);
        } else {
          s.featureLink = null;
        }
      },
      text(t) {
        const name = t.text.trim();
        if (s.track && name) s.track.features?.push(name);
        if (s.featureLink) s.featureLink.name += t.text;
      },
    })
    .on(".trackRating span", {
      element(el) {
        if (s.track) {
          const m = (el.getAttribute("title") ?? "").match(/[\d,]+/);
          s.track.ratingCount = m ? parseInt(m[0].replace(/,/g, ""), 10) : null;
        }
      },
      text(t) { if (s.track) s.track.rating = (s.track.rating ?? "") + t.text; },
    })
    .on(".albumReviewRow", {
      element(el) {
        if (s.review) s.review["text"] = s.reviewTextBuf.trim();
        s.review = { id: el.getAttribute("id") ?? "", score: "", publication: "", publicationUrl: "", author: "", criticUrl: "", text: "", image: "", url: "", extLinkText: "", date: "" };
        s.reviews.push(s.review);
        s.reviewTextBuf = "";
        s.reviewActionCount = 0;
      },
    })
    .on(".albumReviewRating", {
      text(t) { if (s.review) s.review["score"] += t.text; },
    })
    .on(".albumReviewImage img", {
      element(el) { if (s.review) s.review["image"] = el.getAttribute("src") ?? ""; },
    })
    .on(".albumReviewHeader .publication a", {
      element(el) { if (s.review && !s.review["publicationUrl"]) s.review["publicationUrl"] = el.getAttribute("href") ?? ""; },
      text(t) { if (s.review) s.review["publication"] += t.text; },
    })
    .on(".albumReviewHeader .author a", {
      element(el) { if (s.review && !s.review["criticUrl"]) s.review["criticUrl"] = el.getAttribute("href") ?? ""; },
      text(t) { if (s.review) s.review["author"] += t.text; },
    })
    .on(".albumReviewText", {
      text(t) { s.reviewTextBuf += t.text; },
    })
    .on(".albumReviewLinks .extLink", {
      text(t) { if (s.review) s.review["extLinkText"] += t.text; },
    })
    .on(".albumReviewLinks .extLink a", {
      element(el) { if (s.review) s.review["url"] = el.getAttribute("href") ?? ""; },
    })
    .on(".albumReviewLinks .actionContainer", {
      element(el) {
        s.reviewActionCount++;
        if (s.reviewActionCount === 2 && s.review) {
          s.review["date"] = el.getAttribute("title") ?? "";
        }
      },
    })
    .transform(res)
    .arrayBuffer();

  if (s.review) s.review["text"] = s.reviewTextBuf.trim();
  if (s.track && !s.track.title && s.trackTitleBuf) s.track.title = s.trackTitleBuf.trim();

  let jsonLd: Record<string, unknown> = {};
  try { jsonLd = JSON.parse(s.jsonLdText); } catch { /* ignore */ }

  const byArtist = jsonLd["byArtist"] as Record<string, string> | undefined;

  const row = (s.detailRowTexts[1] ?? "").replace(/&nbsp;/g, " ").replace(/ /g, " ");
  const format = row.split(/\/\s*Format/i)[0]?.trim().replace(/\s+/g, " ") ?? "";

  const firstLabel = s.labels[0];
  const primaryLabel = firstLabel
    ? { name: decodeEntities(firstLabel.name.trim()), url: firstLabel.url }
    : null;

  const cleanedTracks: Track[] = s.tracks
    .filter((t) => (t.number ?? "").trim())
    .map((t, idx) => {
      const num = parseTrackNumber(t.number ?? "");
      const songIdM = (t.url ?? "").match(/\/song\/(\d+)/);
      return {
        number: num ?? idx + 1,
        title: decodeEntities((t.title ?? "").trim()),
        url: t.url ?? "",
        songId: songIdM?.[1] ? parseInt(songIdM[1], 10) : null,
        length: (t.length ?? "").trim(),
        rating: parseScore(t.rating ? t.rating.trim() : null),
        ratingCount: t.ratingCount ?? null,
        notes: t.notes ? decodeEntities(t.notes.trim()) : null,
        features: (t.features ?? []).map(decodeEntities),
        featureLinks: (t.featureLinks ?? [])
          .map((f) => ({ name: decodeEntities((f.name ?? "").trim()), url: f.url ?? "", image: null as string | null }))
          .filter((f) => f.name && f.url),
      };
    });
  const cleanedReviews = cleanCriticReviews(s.reviews);
  const rawGenre = jsonLd["genre"];
  const genres = Array.isArray(rawGenre) ? (rawGenre as string[]) : typeof rawGenre === "string" ? [rawGenre] : [];

  const html = await htmlPromise;
  const dateCreated = jsonLd["dateCreated"] ? String(jsonLd["dateCreated"]) : null;
  const dateModified = jsonLd["dateModified"] ? String(jsonLd["dateModified"]) : null;

  const secondaryGenres: string[] = [];
  for (const m of html.matchAll(/<a href="[^"]*\/genre\/[^"]*">\s*<div class="secondary">([^<]+)<\/div>\s*<\/a>/g)) {
    if (m[1]) secondaryGenres.push(decodeEntities(m[1].trim()));
  }

  const parseRankings = (boxSelector: string): { year: AlbumRankingInfo | null; allTime: AlbumAllTimeRanking | null } => {
    const none = { year: null as AlbumRankingInfo | null, allTime: null as AlbumAllTimeRanking | null };
    const boxIdx = html.indexOf(boxSelector);
    if (boxIdx === -1) return none;
    const chunk = html.slice(boxIdx, boxIdx + 2000);
    const m = chunk.match(/(\d{4})\s*Ratings:\s*<strong>\s*<a href="([^"]+)">#(\d+)<\/a>\s*<\/strong>(?:\s*\/\s*(\d+))?/i);
    const year = m?.[1] && m[2] && m[3]
      ? {
        year: parseInt(m[1], 10),
        rank: parseInt(m[3], 10),
        total: m[4] ? parseInt(m[4], 10) : null,
        url: m[2].startsWith("http") ? m[2] : BASE + m[2],
      }
      : null;
    const a = chunk.match(/All Time:\s*<strong>\s*<a href="([^"]+)">#(\d+)<\/a>\s*<\/strong>(?:\s*\/\s*(\d+))?/i);
    const allTime = a?.[1] && a[2]
      ? {
        rank: parseInt(a[2], 10),
        total: a[3] ? parseInt(a[3], 10) : null,
        url: a[1].startsWith("http") ? a[1] : BASE + a[1],
      }
      : null;
    return { year, allTime };
  };

  const criticRankings = parseRankings("albumCriticScoreBox");
  const userRankings = parseRankings("albumUserScoreBox");
  const criticRanking = criticRankings.year;
  const userRanking = userRankings.year;

  const producers: ArtistLink[] = [];
  const writers: ArtistLink[] = [];
  for (const m of html.matchAll(/<div class="detailRow">([\s\S]*?)<\/div>/g)) {
    const rowContent = m[1];
    if (!rowContent) continue;
    if (rowContent.includes("Producer")) {
      for (const link of rowContent.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)) {
        const u = link[1];
        const n = link[2];
        if (u?.includes("/artist/") && n !== undefined) {
          producers.push({
            name: decodeEntities(n.trim()),
            url: u.startsWith("http") ? u : BASE + u,
            image: null,
          });
        }
      }
    } else if (rowContent.includes("Writer")) {
      for (const link of rowContent.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)) {
        const u = link[1];
        const n = link[2];
        if (u?.includes("/artist/") && n !== undefined) {
          writers.push({
            name: decodeEntities(n.trim()),
            url: u.startsWith("http") ? u : BASE + u,
            image: null,
          });
        }
      }
    }
  }

  // Contributions By
  const contributionsBy: NamedLink[] = [];
  const contribIdx = html.indexOf("Contributions By");
  if (contribIdx !== -1) {
    const contribChunk = html.slice(contribIdx, contribIdx + 3000);
    // Find the end of this detail block / section (either next sectionHeading or end of detailRow)
    const nextSection = contribChunk.search(/<\/div>\s*<\/div>|<div class="sectionHeading"|<div class="albumReviewRow"/);
    const endChunk = nextSection !== -1 ? contribChunk.slice(0, nextSection) : (contribChunk.split("</div>")[0] ?? "");
    for (const link of endChunk.matchAll(/<a href="([^"]*\/user\/[^"]*)"[^>]*>([^<]*)<\/a>/g)) {
      const u = link[1];
      const n = link[2];
      if (u && n !== undefined) {
        contributionsBy.push({
          name: decodeEntities(n.trim()),
          url: u.startsWith("http") ? u : BASE + u,
        });
      }
    }
  }

  // Popular User Reviews & Recent User Reviews
  const popIdx = html.indexOf("Popular User Reviews");
  const recIdx = html.indexOf("Recent User Reviews");
  const moreIdx = html.indexOf("More Albums");
  const likeIdx = html.indexOf("You May Also Like");

  let popularUserReviews: UserReview[] = [];
  if (popIdx !== -1) {
    const endPop = recIdx !== -1 ? recIdx : popIdx + 15000;
    popularUserReviews = parseAlbumUserReviewRows(html.slice(popIdx, endPop));
  }

  let recentUserReviews: UserReview[] = [];
  if (recIdx !== -1) {
    const endRec = moreIdx !== -1 ? moreIdx : recIdx + 15000;
    recentUserReviews = parseAlbumUserReviewRows(html.slice(recIdx, endRec));
  }

  // More Albums & Similar Albums
  let moreAlbums: AlbumBlock[] = [];
  if (moreIdx !== -1) {
    const endMore = likeIdx !== -1 ? likeIdx : moreIdx + 15000;
    moreAlbums = await scrapeAlbumBlocks(new Response(html.slice(moreIdx, endMore)));
  }

  let similarAlbums: AlbumBlock[] = [];
  if (likeIdx !== -1) {
    const tagsIdx = html.indexOf("Tags</div>", likeIdx);
    const endLike = tagsIdx !== -1 ? tagsIdx : likeIdx + 15000;
    similarAlbums = await scrapeAlbumBlocks(new Response(html.slice(likeIdx, endLike)));
  }

  // Right sidebar modules (Year End Lists, User Lists, Comments)
  const rightBoxes = html.split("class=\"rightBox\"");
  const yearEndLists: CriticListRank[] = [];
  const userLists: AlbumUserListPreview[] = [];
  const comments: AotyComment[] = [];

  for (let i = 1; i < rightBoxes.length; i++) {
    const box = rightBoxes[i];
    if (!box) continue;
    if (box.includes("Year End Lists")) {
      for (const m of box.matchAll(/<tr>\s*<td class="rank">(?:#<strong>(\d+)<\/strong>)?<\/td>\s*<td class="divider">\/<\/td>\s*<td><a href="([^"]+)">([^<]+)<\/a><\/td>\s*<\/tr>/g)) {
        const r = m[1];
        const u = m[2];
        const t = m[3];
        if (u && t) {
          yearEndLists.push({
            rank: r ? parseRank(r) ?? null : null,
            url: u.startsWith("http") ? u : BASE + u,
            publication: decodeEntities(t.trim()),
            title: decodeEntities(t.trim()),
            publicationUrl: null,
            cover: null,
          });
        }
      }
    } else if (box.includes("User Lists")) {
      for (const item of box.matchAll(/<div class="commentRow">([\s\S]*?)<\/div>\s*<\/div>/g)) {
        const itemContent = item[1];
        if (!itemContent) continue;
        const listLink = itemContent.match(/<a href="([^"]*\/list\/[^"]*)">([^<]*)<\/a>/);
        const userLink = itemContent.match(/By <a href="([^"]*\/user\/[^"]*)"[^>]*>([^<]*)<\/a>/);
        const img = itemContent.match(/<img src="([^"]+)"/);
        if (listLink?.[1] && listLink[2] !== undefined) {
          userLists.push({
            url: listLink[1].startsWith("http") ? listLink[1] : BASE + listLink[1],
            title: decodeEntities(listLink[2].trim()),
            userUrl: userLink?.[1] ? (userLink[1].startsWith("http") ? userLink[1] : BASE + userLink[1]) : "",
            username: userLink?.[2] ? decodeEntities(userLink[2].trim()) : "",
            avatar: cleanImageUrl(img?.[1] ?? null),
          });
        }
      }
    } else if (box.includes("Comments (") || box.includes("commentList")) {
      for (const m of box.matchAll(/<div class="commentRow" id="comment_(\d+)">([\s\S]*?)(?=<div class="commentRow" id="comment_|$)/g)) {
        const id = m[1];
        const c = m[2];
        if (!id || !c) continue;
        const userM = c.match(/<div class="commentUserName[^"]*"><a href="([^"]*)"[^>]*>([^<]*)<\/a>/);
        const avatarM = c.match(/<div class="commentImage[^"]*"><a[^>]*><img src="([^"]*)"/);
        const dateM = c.match(/<div class="commentDate"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/div>/);
        const textM = c.match(/<div class="commentText[^"]*">([\s\S]*?)<\/div>/);
        const repliesM = c.match(/<button class="showReplies"[^>]*>[\s\S]*?<span>(\d+)<\/span>/);
        comments.push({
          id: parseId(id) ?? 0,
          username: userM?.[2] ? decodeEntities(userM[2].trim()) : "",
          usernameColor: null,
          userUrl: userM?.[1] ? (userM[1].startsWith("http") ? userM[1] : BASE + userM[1]) : "",
          avatar: cleanImageUrl(avatarM?.[1] ?? null),
          subscriber: /class="donor[\s"]/.test(c),
          date: dateM?.[2] ? dateM[2].trim() : "",
          dateExact: dateM?.[1] ? dateM[1].trim() : "",
          text: textM?.[1] ? decodeEntities(textM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "",
          replies: parseCount(repliesM?.[1]) ?? 0,
        });
      }
    }
  }

  const artistUrl = byArtist?.["url"] ? (byArtist["url"].startsWith("http") ? byArtist["url"] : `${BASE}${byArtist["url"]}`) : "";
  const artistImage = includeArtistImage ? await fetchArtistImage(artistUrl, opts) : null;

  // Total comment count from the tab/section heading ("Comments (192)").
  const commentCountM = html.match(/Comments \((\d[\d,]*)\)/);
  const commentCount = commentCountM?.[1] ? parseInt(commentCountM[1].replace(/,/g, ""), 10) : null;

  // Hidden producers/writers behind "+N more..." credit buttons (data-type 2 = Producer, 6 = Writer).
  let producersMore = 0;
  let writersMore = 0;
  for (const m of html.matchAll(/<span[^>]*showAlbumCredits[^>]*>([^<]*)<\/span>/g)) {
    const tag = m[0] ?? "";
    const text = (m[1] ?? "").replace(/&nbsp;|&#160;/g, " ");
    const typeM = tag.match(/data-type="(\d+)"/);
    const countM = text.match(/\+(\d+)\s*more/i);
    if (!typeM?.[1] || !countM?.[1]) continue;
    const n = parseInt(countM[1], 10);
    if (!Number.isFinite(n)) continue;
    if (typeM[1] === "2") producersMore += n;
    else if (typeM[1] === "6") writersMore += n;
  }

  return {
    url: pageUrl,
    id: parseId(s.albumId),
    title: decodeEntities(String(jsonLd["name"] ?? "")),
    artist: decodeEntities(byArtist?.["name"] ?? ""),
    artistUrl,
    artistImage,
    cover: cleanImageUrl(String(jsonLd["image"] ?? "")),
    datePublished: String(jsonLd["datePublished"] ?? ""),
    dateCreated,
    dateModified,
    format,
    label: primaryLabel?.name ?? null,
    labelUrl: primaryLabel?.url ?? null,
    labels: s.labels.map((l) => ({ name: decodeEntities(l.name.trim()), url: l.url })),
    genres,
    genreLinks: s.genreLinks
      .map((l) => ({ name: decodeEntities(l.name.trim()), url: l.url }))
      .filter((l) => l.name && l.url),
    secondaryGenres: [...new Set(secondaryGenres)],
    tags: [...new Set(s.tags.map((t) => decodeEntities(t.trim())).filter(Boolean))],
    vibes: [...new Set(s.vibes.map((v) => decodeEntities(v.trim())).filter(Boolean))],
    producers,
    writers,
    producersMore,
    writersMore,
    totalLength: s.totalLength ? s.totalLength.replace(/^Total Length:\s*/i, "").trim() : null,
    mustHear: s.mustHear,
    commentCount,
    criticScore: parseScore(s.criticScoreDisplay.trim()),
    criticScoreExact: parseExactScore(s.criticScoreExact),
    criticCount: parseCount(s.criticCountRaw),
    criticRanking,
    criticRankingAllTime: criticRankings.allTime,
    userScore: parseScore(s.userScoreDisplay.trim()),
    userScoreExact: parseExactScore(s.userScoreExact),
    userCount: parseCount(s.userCountRaw),
    userRanking,
    userRankingAllTime: userRankings.allTime,
    tracklist: cleanedTracks,
    streamingLinks: s.streamingLinks,
    reviews: cleanedReviews,
    popularUserReviews,
    recentUserReviews,
    moreAlbums,
    similarAlbums,
    contributionsBy,
    yearEndLists,
    userLists,
    comments,
    stats: null,
    credits: null,
  };
}

export function parseAlbumUserReviewRows(htmlChunk: string): UserReview[] {
  const reviews: UserReview[] = [];
  const rows = [...htmlChunk.matchAll(/<div class="albumReviewRow[^"]*" id="review_(\d+)">([\s\S]*?)(?=<div class="albumReviewRow|<div style="text-align:center;"|$)/g)];
  for (const r of rows) {
    const reviewId = r[1] ? parseInt(r[1], 10) : null;
    const content = r[2];
    if (!content) continue;
    const userM = content.match(/class="userReviewName"[^>]*><a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/);
    const avatarM = content.match(/class="userReviewImage"[^>]*><a[^>]*href="([^"]*)"[^>]*><img\s+src="([^"]*)"/);
    const avatarHref = avatarM?.[1] ?? "";
    const avatarSrc = avatarM?.[2] ?? null;
    // On profile/list pages the userReviewImage links to the review (/user/x/album/y)
    // and holds the album cover; on album pages it links to the user (avatar).
    const isCover = avatarHref.includes("/album/");
    const ratingM = content.match(/class="rating"[^>]*>([^<]*)<\/div>/);
    const textM = content.match(/class="albumReviewText\s+user"[^>]*><p>([\s\S]*?)<\/div>/);
    const rawText = textM?.[1] ?? "";
    const isTruncated = /read more/i.test(rawText);
    const likesM = content.match(/class="review_likes"[^>]*>([^<]*)<\/div>/);
    const commentsLinkM = content.match(/<a[^>]*href="([^"]*)"[^>]*>\s*<div class="comment_count"[^>]*>([^<]*)<\/div>\s*<\/a>/)
      ?? content.match(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<div class="comment_count"[^>]*>([^<]*)<\/div>/);
    const commentsM = content.match(/class="comment_count"[^>]*>([^<]*)<\/div>/);
    const dateM = content.match(/class="review_date"[^>]*>([^<]*)<\/div>/);
    const dateExactM = content.match(/class="actionContainer"[^>]*title="([^"]*)"/);
    const artistM = content.match(/class="artistTitle"[^>]*><a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/);
    const albumM = content.match(/class="albumTitle"[^>]*><a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/);
    const subscriber = /class="donor[\s"]/.test(content);
    const dateRaw = (dateM?.[1] ?? dateExactM?.[1] ?? "").trim();
    const edited = /\*$/.test(dateRaw);
    const userUrl = userM?.[1] ? (userM[1].startsWith("http") ? userM[1] : BASE + userM[1]) : "";
    const revUrlMatch = content.match(/href="([^"]*\/user\/[^"]*\/album\/[^"]*)"/);
    const revUrl = revUrlMatch?.[1] ? (revUrlMatch[1].startsWith("http") ? revUrlMatch[1] : BASE + revUrlMatch[1]) : "";
    const abs = (u: string | undefined): string => {
      if (!u) return "";
      return u.startsWith("http") ? u : BASE + u;
    };
    const commentsHref = commentsLinkM?.[1] ?? null;
    reviews.push({
      reviewId,
      url: revUrl,
      artist: artistM?.[2] ? decodeEntities(artistM[2].trim()) : "",
      artistUrl: abs(artistM?.[1]),
      artistImage: null,
      album: albumM?.[2] ? decodeEntities(albumM[2].trim()) : "",
      albumUrl: abs(albumM?.[1]),
      cover: isCover ? cleanImageUrl(avatarSrc) : null,
      username: userM?.[2] ? decodeEntities(userM[2].trim()) : "",
      userUrl,
      avatar: !isCover ? cleanImageUrl(avatarSrc) : null,
      subscriber,
      rating: parseScore(ratingM?.[1] ? ratingM[1].trim() : null),
      text: textM?.[1] ? decodeEntities(textM[1].replace(/<[^>]+>/g, " ").replace(/read more\s*$/i, "").replace(/\s+/g, " ").trim()) : "",
      isTruncated,
      likes: parseCount(likesM?.[1]) ?? 0,
      comments: parseCount(commentsM?.[1]) ?? 0,
      commentsUrl: commentsHref ? (commentsHref.startsWith("http") ? commentsHref : BASE + commentsHref) : null,
      date: dateRaw.replace(/\*$/, "").trim() || null,
      dateExact: dateExactM?.[1] ? dateExactM[1].trim() : null,
      edited,
    });
  }
  return reviews;
}

function cleanCriticReviews(reviews: Array<Record<string, unknown>>): CriticReview[] {
  return reviews
    .filter((r) => String((r["publication"] as string) ?? "").trim())
    .map((r) => {
      const url = String((r["url"] as string) ?? "");
      const extLinkText = String((r["extLinkText"] as string) ?? "").trim();
      const idRaw = String((r["id"] as string) ?? "");
      const idM = idRaw.match(/(\d+)/);
      const publicationUrl = String((r["publicationUrl"] as string) ?? "");
      const criticUrl = String((r["criticUrl"] as string) ?? "");
      const toAbs = (u: string): string | null => {
        if (!u) return null;
        return u.startsWith("http") ? u : `${BASE}${u.startsWith("/") ? "" : "/"}${u}`;
      };
      return {
        id: idM?.[1] ? parseInt(idM[1], 10) : null,
        score: parseScore(String((r["score"] as string) ?? "").trim()),
        publication: decodeEntities(String((r["publication"] as string) ?? "").trim()),
        publicationUrl: toAbs(publicationUrl),
        author: decodeEntities(String((r["author"] as string) ?? "").trim()),
        criticUrl: toAbs(criticUrl),
        text: decodeEntities(String((r["text"] as string) ?? "").trim()),
        image: cleanImageUrl(String((r["image"] as string) ?? "")),
        url,
        isPrintOnly: !url && /^print only$/i.test(extLinkText),
        date: String((r["date"] as string) ?? ""),
      };
    });
}

export async function scrapeAlbumCriticReviews(
  slug: string,
  sort: string,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ slug: string; sort: string; reviews: CriticReview[] }> {
  const idM = slug.match(/^(\d+)/);
  if (!idM?.[1]) throw new Error("Album slug must start with the numeric album ID");
  const albumId = idM[1];
  const body = new URLSearchParams({ sort, id: albumId, year: "" }).toString();
  const res = await fetch(`${BASE}/scripts/criticSort.php`, {
    ...opts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/album/${slug}/` },
    body,
  });
  if (!res.ok) throw new Error(`Critic reviews fetch failed: ${res.status}`);
  const reviews: Array<Record<string, string>> = [];
  const st: { review: Record<string, string> | null; textBuf: string; actionCount: number } = { review: null, textBuf: "", actionCount: 0 };
  await new HTMLRewriter()
    .on(".albumReviewRow", {
      element(el) {
        if (st.review) st.review["text"] = st.textBuf.trim();
        st.review = { id: el.getAttribute("id") ?? "", score: "", publication: "", publicationUrl: "", author: "", criticUrl: "", text: "", image: "", url: "", extLinkText: "", date: "" };
        reviews.push(st.review);
        st.textBuf = "";
        st.actionCount = 0;
      },
    })
    .on(".albumReviewRating", {
      text(t) { if (st.review) st.review["score"] = (st.review["score"] ?? "") + t.text; },
    })
    .on(".albumReviewImage img", {
      element(el) { if (st.review) st.review["image"] = el.getAttribute("src") ?? ""; },
    })
    .on(".albumReviewHeader .publication a", {
      element(el) { if (st.review && !st.review["publicationUrl"]) st.review["publicationUrl"] = el.getAttribute("href") ?? ""; },
      text(t) { if (st.review) st.review["publication"] = (st.review["publication"] ?? "") + t.text; },
    })
    .on(".albumReviewHeader .author a", {
      element(el) { if (st.review && !st.review["criticUrl"]) st.review["criticUrl"] = el.getAttribute("href") ?? ""; },
      text(t) { if (st.review) st.review["author"] = (st.review["author"] ?? "") + t.text; },
    })
    .on(".albumReviewText", {
      text(t) { st.textBuf += t.text; },
    })
    .on(".albumReviewLinks .extLink", {
      text(t) { if (st.review) st.review["extLinkText"] = (st.review["extLinkText"] ?? "") + t.text; },
    })
    .on(".albumReviewLinks .extLink a", {
      element(el) { if (st.review) st.review["url"] = el.getAttribute("href") ?? ""; },
    })
    .on(".albumReviewLinks .actionContainer", {
      element(el) {
        st.actionCount++;
        if (st.actionCount === 2 && st.review) {
          st.review["date"] = el.getAttribute("title") ?? "";
        }
      },
    })
    .transform(res)
    .arrayBuffer();
  if (st.review) st.review["text"] = st.textBuf.trim();
  return { slug, sort, reviews: cleanCriticReviews(reviews) };
}

export async function scrapeAlbumTags(slug: string, opts: FetchOpts = FETCH_OPTS): Promise<{ slug: string; tags: NamedLink[] }> {
  const idM = slug.match(/^(\d+)/);
  if (!idM) throw new Error("Album slug must start with the numeric album ID");
  const res = await fetch(`${BASE}/scripts/moreTags.php`, {
    ...opts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/album/${slug}/` },
    body: `albumID=${idM[1]}`,
  });
  if (!res.ok) throw new Error(`Album tags fetch failed: ${res.status}`);
  const tags: NamedLink[] = [];
  let cur: NamedLink | null = null;
  await new HTMLRewriter()
    .on(".tag a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href.includes("/tag/")) {
          cur = { name: "", url: href.startsWith("http") ? href : BASE + href };
          tags.push(cur);
        }
      },
      text(t) {
        if (cur) cur.name += t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return { slug, tags: tags.map((t) => ({ name: decodeEntities(t.name.trim()), url: t.url })) };
}

export async function scrapeRandomAlbum(
  opts: FetchOpts = FETCH_OPTS,
  filter?: RandomAlbumFilter,
): Promise<AlbumDetail> {
  const params = new URLSearchParams();
  if (filter) {
    if (filter.type) params.set("type", filter.type);
    if (filter.yearFrom) params.set("yearFrom", filter.yearFrom);
    if (filter.yearTo) params.set("yearTo", filter.yearTo);
    if (filter.genre) params.set("genre", filter.genre);
    if (filter.genreSecondary) params.set("genreSecondary", filter.genreSecondary);
    if (filter.criticScoreMin) params.set("criticScoreMin", filter.criticScoreMin);
    if (filter.criticScoreMax) params.set("criticScoreMax", filter.criticScoreMax);
    if (filter.userScoreMin) params.set("userScoreMin", filter.userScoreMin);
    if (filter.userScoreMax) params.set("userScoreMax", filter.userScoreMax);
    if (filter.criticReviewsMin) params.set("criticReviewsMin", filter.criticReviewsMin);
    if (filter.criticReviewsMax) params.set("criticReviewsMax", filter.criticReviewsMax);
    if (filter.userReviewsMin) params.set("userReviewsMin", filter.userReviewsMin);
    if (filter.userReviewsMax) params.set("userReviewsMax", filter.userReviewsMax);
  }
  const qs = params.toString();
  const url = qs ? `${BASE}/random/?${qs}` : `${BASE}/random/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Random album fetch failed: ${res.status}`);
  const html = await res.text();
  const refreshM = html.match(/content="0;\s*url=([^"?]+)/i);
  if (!refreshM?.[1]) throw new Error("Could not find redirect URL on random album page");
  const targetUrl = refreshM[1].trim();
  return scrapeAlbumPage(targetUrl, opts);
}

export async function scrapeAlbumTagAutocomplete(query: string, opts: FetchOpts = FETCH_OPTS): Promise<string[]> {
  const res = await fetch(`${BASE}/scripts/albumTagAutocomplete.php?q=${encodeURIComponent(query)}`, {
    ...opts,
    headers: { ...REQ_HEADERS, "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/` },
  });
  if (!res.ok) throw new Error(`Tag autocomplete fetch failed: ${res.status}`);
  const data = (await res.json()) as Array<{ value: string }>;
  return data.map((item) => decodeEntities(item.value.trim())).filter(Boolean);
}

/**
 * Available filter options and bounds for random album generation
 * (verified source: GET /scripts/randomFilters.php).
 */
export async function scrapeRandomFilters(opts: FetchOpts = FETCH_OPTS): Promise<RandomFiltersMeta> {
  const res = await fetch(`${BASE}/scripts/randomFilters.php`, opts);
  if (!res.ok) throw new Error(`Random filters fetch failed: ${res.status}`);
  const html = await res.text();

  const types: string[] = [];
  const typeSelectM = html.match(/<select[^>]*id="randomType"[^>]*>([\s\S]*?)<\/select>/i);
  if (typeSelectM?.[1]) {
    for (const m of typeSelectM[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/g)) {
      const val = m[1]?.trim();
      if (val && val !== "") types.push(val);
    }
  }

  const parseMinMax = (id: string, defMin: number, defMax: number): { min: number; max: number } => {
    const inputM = html.match(new RegExp(`id="${id}"[^>]*`, "i"));
    const minM = inputM?.[0]?.match(/min="(\d+)"/);
    const maxM = inputM?.[0]?.match(/max="(\d+)"/);
    return {
      min: minM?.[1] ? parseInt(minM[1], 10) : defMin,
      max: maxM?.[1] ? parseInt(maxM[1], 10) : defMax,
    };
  };

  const yearRange = parseMinMax("randomYearFrom", 1900, new Date().getFullYear());
  const criticScoreRange = parseMinMax("randomCriticScoreMin", 0, 100);
  const userScoreRange = parseMinMax("randomUserScoreMin", 0, 100);

  const criticReviewsInput = html.match(/id="randomCriticReviewsMin"[^>]*/i);
  const userReviewsInput = html.match(/id="randomUserReviewsMin"[^>]*/i);
  const criticRevMinM = criticReviewsInput?.[0]?.match(/min="(\d+)"/);
  const userRevMinM = userReviewsInput?.[0]?.match(/min="(\d+)"/);

  return {
    types: types.length > 0 ? types : [
      "Audiobook", "Box Set", "Compilation", "Demo", "DJ Mix", "EP", "Holiday",
      "Instrumental", "Live", "LP", "Miscellaneous", "Mixtape", "Music Video",
      "Reissue", "Remix", "Single", "Soundtrack", "Unofficial", "Video",
    ],
    year: yearRange,
    criticScore: criticScoreRange,
    criticReviews: { min: criticRevMinM?.[1] ? parseInt(criticRevMinM[1], 10) : 0, max: null },
    userScore: userScoreRange,
    userReviews: { min: userRevMinM?.[1] ? parseInt(userRevMinM[1], 10) : 0, max: null },
  };
}

