import { BASE, FETCH_OPTS } from "../constants.js";
import type { AlbumDetail, CriticReview, StreamingLink, Track } from "../types.js";

export async function findAlbumUrl(artist: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`${artist} - ${name}`);
  const res = await fetch(`${BASE}/search/albums/?q=${q}`, FETCH_OPTS);
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

export async function scrapeAlbumPage(pageUrl: string): Promise<AlbumDetail> {
  const res = await fetch(pageUrl, FETCH_OPTS);
  if (!res.ok) throw new Error(`Album fetch failed: ${res.status}`);

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
    tags: [] as string[],
    streamingLinks: [] as StreamingLink[],
    tracks: [] as Array<Partial<Track>>,
    track: null as Partial<Track> | null,
    trackTitleBuf: "",
    inTrackTitle: false,
    reviews: [] as Array<Partial<CriticReview>>,
    review: null as Partial<CriticReview> | null,
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
        s.track = { number: "", title: "", url: "", length: "", rating: null, ratingCount: null, notes: null, features: [] };
        s.tracks.push(s.track);
        s.trackTitleBuf = "";
        s.inTrackTitle = false;
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
      text(t) {
        const name = t.text.trim();
        if (s.track && name) (s.track.features as string[]).push(name);
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
      element() {
        if (s.review) s.review.text = s.reviewTextBuf.trim();
        s.review = { score: "", publication: "", author: "", text: "", image: "", url: "", date: "" };
        s.reviews.push(s.review);
        s.reviewTextBuf = "";
        s.reviewActionCount = 0;
      },
    })
    .on(".albumReviewRating", {
      text(t) { if (s.review) s.review.score += t.text; },
    })
    .on(".albumReviewImage img", {
      element(el) { if (s.review) s.review.image = el.getAttribute("src") ?? ""; },
    })
    .on(".albumReviewHeader .publication a", {
      text(t) { if (s.review) s.review.publication += t.text; },
    })
    .on(".albumReviewHeader .author a", {
      text(t) { if (s.review) s.review.author += t.text; },
    })
    .on(".albumReviewText *", {
      text(t) { s.reviewTextBuf += t.text; },
    })
    .on(".albumReviewLinks .extLink a", {
      element(el) { if (s.review) s.review.url = el.getAttribute("href") ?? ""; },
    })
    .on(".albumReviewLinks .actionContainer", {
      element(el) {
        s.reviewActionCount++;
        if (s.reviewActionCount === 2 && s.review) {
          s.review.date = el.getAttribute("title") ?? "";
        }
      },
    })
    .transform(res)
    .arrayBuffer();

  if (s.review) s.review.text = s.reviewTextBuf.trim();
  if (s.track && !s.track.title && s.trackTitleBuf) s.track.title = s.trackTitleBuf.trim();

  let jsonLd: Record<string, unknown> = {};
  try { jsonLd = JSON.parse(s.jsonLdText); } catch { /* ignore */ }

  const byArtist = jsonLd["byArtist"] as Record<string, string> | undefined;
  const extractNum = (raw: string): string => (raw.match(/[\d,]+/) ?? [""])[0];

  const format = (() => {
    const row = (s.detailRowTexts[1] ?? "").replace(/&nbsp;/g, " ").replace(/ /g, " ");
    return row.split(/\/\s*Format/i)[0].trim().replace(/\s+/g, " ");
  })();

  const primaryLabel = s.labels.length > 0
    ? { name: s.labels[0].name.trim(), url: s.labels[0].url }
    : null;

  const cleanedTracks: Track[] = s.tracks
    .filter((t) => (t.number ?? "").trim())
    .map((t) => ({
      number: (t.number ?? "").trim(),
      title: (t.title ?? "").trim(),
      url: t.url ?? "",
      length: (t.length ?? "").trim(),
      rating: t.rating ? t.rating.trim() : null,
      ratingCount: t.ratingCount ?? null,
      notes: t.notes ? t.notes.trim() : null,
      features: (t.features as string[] | undefined ?? []).filter(Boolean),
    }));

  const cleanedReviews: CriticReview[] = s.reviews
    .filter((r) => (r.publication ?? "").trim())
    .map((r) => ({
      score: (r.score ?? "").trim(),
      publication: (r.publication ?? "").trim(),
      author: (r.author ?? "").trim(),
      text: (r.text ?? "").trim(),
      image: r.image ?? "",
      url: r.url ?? "",
      date: r.date ?? "",
    }));

  return {
    url: pageUrl,
    id: s.albumId,
    title: String(jsonLd["name"] ?? ""),
    artist: byArtist?.name ?? "",
    artistUrl: byArtist?.url ? (byArtist.url.startsWith("http") ? byArtist.url : `${BASE}${byArtist.url}`) : "",
    cover: String(jsonLd["image"] ?? ""),
    datePublished: String(jsonLd["datePublished"] ?? ""),
    format,
    label: primaryLabel?.name ?? null,
    labelUrl: primaryLabel?.url ?? null,
    genres: (jsonLd["genre"] as string[] | undefined) ?? [],
    tags: [...new Set(s.tags.map((t) => t.trim()).filter(Boolean))],
    criticScore: s.criticScoreDisplay.trim() || null,
    criticScoreExact: s.criticScoreExact || null,
    criticCount: extractNum(s.criticCountRaw) || null,
    userScore: s.userScoreDisplay.trim() || null,
    userScoreExact: s.userScoreExact || null,
    userCount: extractNum(s.userCountRaw) || null,
    tracklist: cleanedTracks,
    streamingLinks: s.streamingLinks,
    reviews: cleanedReviews,
    stats: null,
    credits: null,
  };
}
