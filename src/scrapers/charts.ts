import { BASE, FETCH_OPTS, cleanImageUrl, decodeEntities, parseCount, parseId, parseRank, parseScore, parseExactScore, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type { ChartItem, RatingGenresResult, RatingSourcesResult, StreamingLink, TopArtistEntry } from "../types.js";
import { mustHearScopeFromClass } from "./albumBlock.js";

type RawChartItem = {
  rank: string;
  title: string;
  url: string;
  cover: string | null;
  date: string | null;
  genres: string[];
  secondaryGenres: string[];
  score: string | null;
  scoreExact: string | null;
  ratingCount: string | null;
  mustHear: boolean;
  mustHearScope: "both" | "user" | "critic" | null;
  streamingLinks: StreamingLink[];
};

export async function scrapeRatingsChart(aotyPath: string, opts: FetchOpts = FETCH_OPTS): Promise<ChartItem[]> {
  const res = await fetch(`${BASE}${aotyPath}`, opts);
  if (!res.ok) throw new Error(`Ratings fetch failed: ${res.status}`);
  return parseRatingsChartItems(res);
}

/** Same chart rows plus the last page number parsed from the page selector. */
export async function scrapeRatingsChartPage(aotyPath: string, opts: FetchOpts = FETCH_OPTS): Promise<{ items: ChartItem[]; totalPages: number | null }> {
  const res = await fetch(`${BASE}${aotyPath}`, opts);
  if (!res.ok) throw new Error(`Ratings fetch failed: ${res.status}`);
  const html = await res.text();
  const items = await parseRatingsChartItems(new Response(html));
  let totalPages: number | null = null;
  for (const m of html.matchAll(/<a href="([^"]+)"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const href = m[1] ?? "";
    if (!href.includes("/ratings/")) continue;
    const segs = href.split("/").filter(Boolean);
    const last = segs[segs.length - 1] ?? "";
    const n = parseInt(last, 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  return { items, totalPages };
}

async function parseRatingsChartItems(res: Response): Promise<ChartItem[]> {
  const items: RawChartItem[] = [];
  let cur: RawChartItem | null = null;
  let inGenre = false;
  let inSecondary = false;
  await new HTMLRewriter()
    .on(".albumListRow", {
      element(el) {
        const id = el.getAttribute("id") ?? "";
        cur = { rank: id.replace("rank-", ""), title: "", url: "", cover: null, date: null, genres: [], secondaryGenres: [], score: null, scoreExact: null, ratingCount: null, mustHear: false, mustHearScope: null, streamingLinks: [] };
        items.push(cur);
        inGenre = false;
        inSecondary = false;
      },
    })
    .on(".albumListRow .mustHear", {
      element() {
        if (cur) {
          cur.mustHear = true;
          if (cur.mustHearScope === null) cur.mustHearScope = "critic";
        }
      },
    })
    .on(".albumListRow .albumListCover", {
      element(el) {
        if (!cur) return;
        const scope = mustHearScopeFromClass(el.getAttribute("class"));
        if (scope) {
          cur.mustHear = true;
          cur.mustHearScope = scope;
        }
      },
    })
    .on(".albumListTitle a[itemprop='url']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (cur && !cur.url && href) cur.url = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (cur) cur.title = (cur.title ?? "") + t.text;
      },
    })
    .on(".albumListCover img", {
      element(el) {
        if (cur) cur.cover = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".albumListDate", {
      text(t) {
        if (cur) cur.date = ((cur.date ?? "") as string) + t.text;
      },
    })
    .on(".albumListGenre", {
      element() {
        inGenre = true;
      },
      text(t) {
        void t;
      },
    })
    .on(".albumListGenre .secondary-genres", {
      element() {
        inSecondary = true;
      },
    })
    .on(".albumListGenre a", {
      text(t) {
        const v = t.text.trim().replace(/,$/, "");
        if (cur && inGenre && v) {
          if (inSecondary) (cur.secondaryGenres as string[]).push(v);
          else (cur.genres as string[]).push(v);
        }
      },
    })
    .on(".albumListRow .albumListLinks a", {
      element(el) {
        if (!cur) return;
        const href = el.getAttribute("href") ?? "";
        if (!href.startsWith("http")) return;
        const platform = (el.getAttribute("data-track-action") ?? "").trim();
        cur.streamingLinks.push({ platform, url: href });
      },
      text(t) {
        if (!cur) return;
        const last = cur.streamingLinks[cur.streamingLinks.length - 1];
        if (last && !last.platform) {
          const v = t.text.trim();
          if (v) last.platform = v;
        }
      },
    })
    .on(".albumListScoreContainer", {
      element() {
        inGenre = false;
        inSecondary = false;
      },
    })
    .on(".scoreValue", {
      text(t) {
        if (cur) cur.score = ((cur.score ?? "") as string) + t.text;
      },
    })
    .on(".scoreValueContainer", {
      element(el) {
        if (cur) cur.scoreExact = el.getAttribute("title") ?? null;
      },
    })
    .on(".scoreText", {
      text(t) {
        if (cur) cur.ratingCount = ((cur.ratingCount ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  return items.map((i, idx) => {
    const rawTitle = decodeEntities((i.title ?? "").trim());
    const dashIdx = rawTitle.indexOf(" - ");
    const artist = dashIdx > -1 ? rawTitle.slice(0, dashIdx).trim() : "";
    const album = dashIdx > -1 ? rawTitle.slice(dashIdx + 3).trim() : rawTitle;
    const cleanGenres = [...new Set((i.genres ?? []).map((g) => decodeEntities(g.trim())).filter(Boolean))];
    const cleanSecondary = [...new Set((i.secondaryGenres ?? []).map((g) => decodeEntities(g.trim())).filter(Boolean))].filter((g) => !cleanGenres.includes(g));
    const cDate = (i.date ?? "").trim() || null;
    return {
      rank: parseRank((i.rank ?? "").trim()) ?? idx + 1,
      artist,
      album,
      title: rawTitle,
      url: i.url ?? "",
      cover: i.cover ?? null,
      date: cDate,
      dateTimestamp: parseDateToTimestamp(cDate),
      genres: cleanGenres,
      secondaryGenres: cleanSecondary,
      score: parseScore((i.score ?? "").trim()),
      scoreExact: parseExactScore(i.scoreExact),
      ratingCount: parseCount((i.ratingCount ?? "").replace(/ratings?/i, "").trim()),
      mustHear: i.mustHear ?? false,
      mustHearScope: i.mustHearScope ?? null,
      streamingLinks: (i.streamingLinks ?? []).map((l) => ({ platform: decodeEntities(l.platform || "Link"), url: l.url })),
    };
  });
}

export async function scrapeTopArtists(genre: string | null, scope: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<TopArtistEntry[]> {
  let path = "/bands/top-artists/";
  if (genre) path += `${encodeURIComponent(genre)}/`;
  if (scope === "users") path += "users/";
  if (page > 1) path += `${page}/`;
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`Top artists fetch failed: ${res.status}`);
  const artists: Array<{ url: string; name: string; image: string | null; score: string | null }> = [];
  let cur: { url: string; name: string; image: string | null; score: string | null } | null = null;
  await new HTMLRewriter()
    .on(".artistBlock", {
      element() {
        cur = { url: "", name: "", image: null, score: null };
        artists.push(cur);
      },
    })
    .on(".artistBlock a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (cur && !cur.url && href.includes("/artist/")) cur.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".artistBlock img", {
      element(el) {
        if (cur) cur.image = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".artistBlock .name", {
      text(t) {
        if (cur) cur.name = (cur.name ?? "") + t.text;
      },
    })
    .on(".artistBlock .ratingRow .rating", {
      text(t) {
        if (cur && !(cur.score ?? "").trim()) cur.score = ((cur.score ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return artists.map((a) => ({ url: a.url ?? "", name: decodeEntities((a.name ?? "").trim()), image: cleanImageUrl(a.image ?? null), score: parseScore((a.score ?? "").trim()) }));
}

export async function scrapeRatingSources(
  year: string | number = new Date().getFullYear(),
  opts: FetchOpts = FETCH_OPTS,
): Promise<RatingSourcesResult> {
  const res = await fetch(`${BASE}/scripts/sourceSelect.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ year: String(year), sourceID: "6" }).toString(),
  });
  if (!res.ok) throw new Error(`Rating sources fetch failed: ${res.status}`);
  const html = await res.text();
  const sources: Array<{ slug: string; name: string; url: string }> = [];
  for (const m of html.matchAll(/<a href="(\/ratings\/([^/]+)\/[^"]*)">([^<]+)<\/a>/g)) {
    const url = m[1];
    const slug = m[2];
    const name = m[3];
    if (url && slug && name) {
      sources.push({
        slug,
        name: decodeEntities(name.trim()),
        url: BASE + url,
      });
    }
  }
  return { year: parseId(year) ?? new Date().getFullYear(), sources };
}

export async function scrapeRatingGenres(
  year: string | number = new Date().getFullYear(),
  type = "criticHighestRated",
  opts: FetchOpts = FETCH_OPTS,
): Promise<RatingGenresResult> {
  const res = await fetch(`${BASE}/scripts/genreSelect.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ type, year: String(year), sourceID: "6", sort: "weighted" }).toString(),
  });
  if (!res.ok) throw new Error(`Rating genres fetch failed: ${res.status}`);
  const html = await res.text();
  const genres: Array<{ id: number; slug: string; name: string; url: string }> = [];
  for (const m of html.matchAll(/<a href="(\/genre\/([^/]+)\/[^"]*)">([^<]+)<\/a>/g)) {
    const url = m[1];
    const slug = m[2];
    const name = m[3];
    if (url && slug && name) {
      const idM = slug.match(/^(\d+)/);
      genres.push({
        id: parseId(idM?.[1]) ?? 0,
        slug,
        name: decodeEntities(name.trim()),
        url: BASE + url,
      });
    }
  }
  return { year: parseId(year) ?? new Date().getFullYear(), type, genres };
}

