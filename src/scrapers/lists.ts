import { BASE, FETCH_OPTS, cleanImageUrl, decodeEntities, parseCount, parseScore, parseExactScore, parseRank, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type {
  ListDetailItem,
  ListEntry,
  ListIndexSection,
  ListSummaryResult,
  CommunityYearEndResult,
  YearEndAggregateItem,
  YearEndAggregateBreakdown,
  StreamingLink,
} from "../types.js";

export async function scrapeListsIndex(url: string, opts: FetchOpts = FETCH_OPTS): Promise<{ lists: ListEntry[]; sections: ListIndexSection[] }> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Lists fetch failed: ${res.status}`);

  const entries: Array<ListEntry & { section: string }> = [];
  let current: (ListEntry & { section: string }) | null = null;
  let sectionTitle = "";

  await new HTMLRewriter()
    .on("h2.subHeadline, h2.sectionHeading, .sectionHeading h2", {
      element() {
        sectionTitle = "";
      },
      text(t) {
        const v = t.text.trim();
        if (v) sectionTitle = (sectionTitle ? `${sectionTitle} ` : "") + v;
      },
    })
    .on(".listColumn .listPub", {
      element() {
        current = { url: "", title: "", publication: "", cover: null, section: sectionTitle.trim() };
        entries.push(current);
      },
    })
    .on(".listColumn .listPub > a", {
      element(el) {
        if (current && !current.url) {
          const href = el.getAttribute("href");
          if (href) current.url = href.startsWith("http") ? href : BASE + href;
        }
      },
    })
    .on(".listColumn .listLogo img", {
      element(el) {
        if (current) {
          current.cover = cleanImageUrl(el.getAttribute("src") ?? null);
          current.title = el.getAttribute("alt") ?? "";
        }
      },
    })
    .on(".listColumn .listText a", {
      text(t) { if (current) current.publication += t.text; },
    })
    .transform(res)
    .arrayBuffer();

  const lists = entries.map((e) => ({
    url: e.url ?? "",
    title: decodeEntities((e.title ?? "").trim()),
    publication: decodeEntities((e.publication ?? "").trim()),
    cover: cleanImageUrl(e.cover ?? null),
  }));
  // Group entries under their headings (e.g. Featured vs Other); drop empties.
  const bySection = new Map<string, ListEntry[]>();
  for (const e of entries) {
    const title = (e.section ?? "").trim();
    if (!title) continue;
    const group = bySection.get(title) ?? [];
    group.push({
      url: e.url ?? "",
      title: decodeEntities((e.title ?? "").trim()),
      publication: decodeEntities((e.publication ?? "").trim()),
      cover: cleanImageUrl(e.cover ?? null),
    });
    bySection.set(title, group);
  }
  return {
    lists,
    sections: [...bySection].map(([title, sectionLists]) => ({ title, lists: sectionLists })),
  };
}

import { mustHearScopeFromClass } from "./albumBlock.js";

type RawListDetailItem = {
  rank: string;
  title: string;
  url: string;
  cover: string;
  date: string;
  genres: string[];
  secondaryGenres: string[];
  score: string | null;
  scoreExact: string | null;
  ratingCount: string | null;
  mustHear: boolean;
  mustHearScope: "both" | "user" | "critic" | null;
  streamingLinks: StreamingLink[];
  blurb: string | null;
  otherLists: number | null;
};

export async function scrapeListDetail(url: string, opts: FetchOpts = FETCH_OPTS): Promise<{ title: string; sourceUrl: string; items: ListDetailItem[] }> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`List detail fetch failed: ${res.status}`);

  let listTitle = "";
  let sourceUrl = "";
  const items: RawListDetailItem[] = [];
  let current: RawListDetailItem | null = null;
  let inSecondary = false;

  await new HTMLRewriter()
    .on(".listHeader h1.headline", {
      text(t) { listTitle += t.text; },
    })
    .on(".listHeader a[href*='http']", {
      element(el) { if (!sourceUrl) sourceUrl = el.getAttribute("href") ?? ""; },
    })
    .on(".albumListRow", {
      element() {
        current = {
          rank: "",
          title: "",
          url: "",
          cover: "",
          date: "",
          genres: [],
          secondaryGenres: [],
          score: null,
          scoreExact: null,
          ratingCount: null,
          mustHear: false,
          mustHearScope: null,
          streamingLinks: [],
          blurb: null,
          otherLists: null,
        };
        items.push(current);
        inSecondary = false;
      },
    })
    .on(".albumListRank span[itemprop='position']", {
      text(t) { if (current) current.rank += t.text; },
    })
    .on(".albumListRow .mustHear", {
      element() {
        if (current) {
          current.mustHear = true;
          if (current.mustHearScope === null) current.mustHearScope = "critic";
        }
      },
    })
    .on(".albumListRow .albumListCover", {
      element(el) {
        if (!current) return;
        const scope = mustHearScopeFromClass(el.getAttribute("class"));
        if (scope) {
          current.mustHear = true;
          current.mustHearScope = scope;
        }
      },
    })
    .on(".albumListTitle a[itemprop='url']", {
      element(el) {
        if (current) {
          const href = el.getAttribute("href");
          if (href) current.url = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) { if (current) current.title += t.text; },
    })
    .on(".albumListCover img", {
      element(el) { if (current) current.cover = cleanImageUrl(el.getAttribute("src") ?? ""); },
    })
    .on(".albumListCover .otherLists", {
      text(t) {
        if (current) {
          const m = t.text.match(/(\d+)/);
          if (m?.[1]) current.otherLists = parseInt(m[1], 10);
        }
      },
    })
    .on(".albumListDate", {
      text(t) { if (current) current.date += t.text; },
    })
    .on(".albumListGenre a[href*='/genre/']", {
      text(t) {
        const name = t.text.trim();
        if (current && name) {
          if (inSecondary) current.secondaryGenres?.push(name);
          else current.genres?.push(name);
        }
      },
    })
    .on(".albumListGenre .secondary-genres", {
      element() {
        inSecondary = true;
      },
    })
    .on(".albumListRow .albumListLinks a", {
      element(el) {
        if (!current) return;
        const href = el.getAttribute("href") ?? "";
        if (!href.startsWith("http")) return;
        const platform = (el.getAttribute("data-track-action") ?? "").trim();
        current.streamingLinks.push({ platform, url: href });
      },
      text(t) {
        if (!current) return;
        const last = current.streamingLinks[current.streamingLinks.length - 1];
        if (last && !last.platform) {
          const v = t.text.trim();
          if (v) last.platform = v;
        }
      },
    })
    .on(".albumListScoreContainer .scoreValue", {
      text(t) {
        if (current) current.score = (current.score ?? "") + t.text;
      },
    })
    .on(".albumListScoreContainer .scoreValueContainer", {
      element(el) {
        if (current) current.scoreExact = el.getAttribute("title") ?? null;
      },
    })
    .on(".albumListScoreContainer .scoreText", {
      text(t) {
        if (current) current.ratingCount = (current.ratingCount ?? "") + t.text;
      },
    })
    .on(".albumListBlurb p", {
      text(t) {
        if (current) current.blurb = (current.blurb ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    title: decodeEntities(listTitle.trim()),
    sourceUrl,
    items: items.map((item, idx) => {
      const rawTitle = decodeEntities((item.title ?? "").trim());
      const dashIdx = rawTitle.indexOf(" - ");
      const artist = dashIdx > -1 ? rawTitle.slice(0, dashIdx).trim() : "";
      const album = dashIdx > -1 ? rawTitle.slice(dashIdx + 3).trim() : rawTitle;
      const hasRank = (item.rank ?? "").trim().length > 0;
      const cleanGenres = [...new Set((item.genres ?? []).map((g) => g.trim()).filter(Boolean))];
      const cleanSecondary = [...new Set((item.secondaryGenres ?? []).map((g) => decodeEntities(g.trim())).filter(Boolean))].filter((g) => !cleanGenres.includes(g));
      const lDate = (item.date ?? "").trim();
      return {
        // Unranked publication orderings carry no position node: keep rank null
        // instead of inventing one from the row index.
        rank: hasRank ? (parseRank((item.rank ?? "").trim()) ?? idx + 1) : null,
        artist,
        album,
        title: rawTitle,
        url: item.url ?? "",
        cover: cleanImageUrl(item.cover ?? ""),
        date: lDate,
        dateTimestamp: parseDateToTimestamp(lDate),
        genres: cleanGenres,
        secondaryGenres: cleanSecondary,
        score: parseScore((item.score ?? "").trim()),
        scoreExact: parseExactScore(item.scoreExact),
        ratingCount: parseCount((item.ratingCount ?? "").replace(/reviews?|ratings?/gi, "").trim()),
        mustHear: item.mustHear ?? false,
        mustHearScope: item.mustHearScope ?? null,
        streamingLinks: (item.streamingLinks ?? []).map((l) => ({ platform: decodeEntities(l.platform || "Link"), url: l.url })),
        blurb: item.blurb ? decodeEntities(item.blurb.trim()) : null,
        otherLists: item.otherLists ?? null,
      };
    }),
  };
}

export function parseListSummaryRows(html: string): { totalLists: number | null; items: YearEndAggregateItem[] } {
  const m_total = html.match(/(?:obtained from the|based on)\s*<strong>([\d,]+)<\/strong>\s*lists/i);
  const totalLists = m_total?.[1] ? parseInt(m_total[1].replace(/,/g, ""), 10) : null;

  const items: YearEndAggregateItem[] = [];
  const rows = [...html.matchAll(/<div class="listSummaryRow">([\s\S]*?)(?=<div class="listSummaryRow"|<div id="comments"|<div class="footer"|$)/g)];

  for (const match of rows) {
    const r = match[1];
    if (!r) continue;

    const rankM = r.match(/<div class="listSummaryRank[^"]*">(\d+)<\/div>/);
    const rank = rankM?.[1] ? parseInt(rankM[1], 10) : 0;

    const coverM = r.match(/<div class="listSummaryCover[^"]*">[\s\S]*?<img [^>]*src="([^"]+)"/);
    const cover = coverM?.[1] ?? null;

    const albumM = r.match(/<h2 class="albumTitle[^"]*"><a [^>]*href="([^"]+)">([^<]+)<\/a><\/h2>/);
    const albumUrl = albumM?.[1] ? (albumM[1].startsWith("http") ? albumM[1] : BASE + albumM[1]) : "";
    const album = albumM?.[2] ? decodeEntities(albumM[2].trim()) : "";

    const artistM = r.match(/<h3 class="artistTitle[^"]*"><a [^>]*href="([^"]+)">([^<]+)<\/a><\/h3>/);
    const artistUrl = artistM?.[1] ? (artistM[1].startsWith("http") ? artistM[1] : BASE + artistM[1]) : "";
    const artist = artistM?.[2] ? decodeEntities(artistM[2].trim()) : "";

    const pointsM = r.match(/<div class="summaryPoints[^"]*">[\s\S]*?([\d,]+)\s*Points/i);
    const points = pointsM?.[1] ? parseInt(pointsM[1].replace(/,/g, ""), 10) : 0;

    const getCount = (head: string): number => {
      const escaped = head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = r.match(new RegExp(`<div class="head">${escaped}<\\/div>\\s*<div class="count">([\\d,]+)<\\/div>`));
      return m?.[1] ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
    };

    const breakdown: YearEndAggregateBreakdown = {
      firstPlace: getCount("1st Place"),
      secondPlace: getCount("2nd Place"),
      thirdPlace: getCount("3rd Place"),
      top10: getCount("Top 10"),
      top25: getCount("Top 25"),
      other: getCount("Other"),
    };

    const streamingLinks: StreamingLink[] = [];
    const linksIdx = r.indexOf('class="albumListLinks');
    if (linksIdx !== -1) {
      const linksChunk = r.slice(linksIdx);
      for (const link of linksChunk.matchAll(/<a [^>]*href="([^"]+)"[^>]*>\s*<div>([^<]+)<\/div>\s*<\/a>/g)) {
        if (link[1] && link[2]) {
          streamingLinks.push({
            platform: decodeEntities(link[2].trim()),
            url: link[1],
          });
        }
      }
    }

    // Drill-down links: points total + per-placement breakdown (critic-lists/?f=).
    let criticListsUrl: string | null = null;
    const breakdownUrls: { firstPlace: string | null; secondPlace: string | null; thirdPlace: string | null; top10: string | null; top25: string | null; other: string | null; all: string | null } = {
      firstPlace: null,
      secondPlace: null,
      thirdPlace: null,
      top10: null,
      top25: null,
      other: null,
      all: null,
    };
    for (const m of r.matchAll(/<a[^>]*href="([^"]*\/critic-lists\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const href = m[1] ?? "";
      const inner = m[2] ?? "";
      if (!href) continue;
      const abs = href.startsWith("http") ? href : BASE + href;
      const innerText = inner.replace(/<[^>]+>/g, " ").trim();
      if (/Points/i.test(innerText)) {
        criticListsUrl = abs;
        if (/[?&]f=all\b/.test(href)) breakdownUrls.all = abs;
        continue;
      }
      const headM = inner.match(/<div class="head">([^<]*)<\/div>/);
      const head = (headM?.[1] ?? "").trim();
      if (/^1st Place$/i.test(head)) breakdownUrls.firstPlace = abs;
      else if (/^2nd Place$/i.test(head)) breakdownUrls.secondPlace = abs;
      else if (/^3rd Place$/i.test(head)) breakdownUrls.thirdPlace = abs;
      else if (/^Top 10$/i.test(head)) breakdownUrls.top10 = abs;
      else if (/^Top 25$/i.test(head)) breakdownUrls.top25 = abs;
      else if (/^Other$/i.test(head)) breakdownUrls.other = abs;
    }

    if (album || artist) {
      items.push({
        rank,
        artist,
        artistUrl,
        artistImage: null,
        album,
        albumUrl,
        cover: cleanImageUrl(cover),
        points,
        breakdown,
        breakdownUrls,
        criticListsUrl,
        streamingLinks,
      });
    }
  }

  return { totalLists, items };
}

export async function scrapeYearEndSummary(
  year: number,
  genre: string | null = null,
  opts: FetchOpts = FETCH_OPTS,
): Promise<ListSummaryResult> {
  const url = genre ? `${BASE}/list/summary/${year}/${encodeURIComponent(genre)}/` : `${BASE}/list/summary/${year}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`List summary fetch failed: ${res.status}`);
  const html = await res.text();
  const { totalLists, items } = parseListSummaryRows(html);
  return { year, genre, totalLists, items };
}

export async function scrapeCommunityYearEnd(
  year: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<CommunityYearEndResult> {
  const url = `${BASE}/year-end/${year}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Community year-end fetch failed: ${res.status}`);
  const html = await res.text();
  const { totalLists, items } = parseListSummaryRows(html);
  return { year, totalLists, items };
}

