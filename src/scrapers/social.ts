import { BASE, FETCH_OPTS, REQ_HEADERS, cleanImageUrl, decodeEntities, parseCount, parseId, parseRank, parseScore, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type {
  AllCommentsResult,
  AotyComment,
  ChangelogEntry,
  CorrectionChangeLogEntry,
  CorrectionItem,
  CriticListRank,
  EntityCorrectionsResult,
  FaqItem,
  NamedLink,
  NewsDetail,
  NewsSearchItem,
  SiteUpdate,
  SiteStats,
  LeaderboardModule,
  GuidelinesSection,
  TagItem,
  UserListEntry,
} from "../types.js";
import { scrapeAlbumBlocks } from "./albumBlock.js";
import { scrapeNewsPage } from "./news.js";
import { scrapeCommentRows } from "./commentRow.js";
import { scrapeUserListRows } from "./userListRow.js";
export { scrapeCommentRows };

export async function scrapeAlbumCriticLists(albumSlug: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<{ slug: string; page: number; lists: CriticListRank[] }> {
  const url = page > 1 ? `${BASE}/album/${albumSlug}/critic-lists/${page}/` : `${BASE}/album/${albumSlug}/critic-lists/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Album critic lists fetch failed: ${res.status}`);
  const lists: Array<{ url: string; title: string; publication: string; publicationUrl: string | null; cover: string | null; rank: string | null }> = [];
  const st: { cur: { url: string; title: string; publication: string; publicationUrl: string | null; cover: string | null; rank: string | null } | null } = { cur: null };
  await new HTMLRewriter()
    .on(".listPub", {
      element() {
        st.cur = { url: "", title: "", publication: "", publicationUrl: null, cover: null, rank: null };
        lists.push(st.cur);
      },
    })
    .on(".listPub > a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.url && href.includes("/list/")) st.cur.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".listPub .listLogo img", {
      element(el) {
        if (st.cur) {
          st.cur.cover = cleanImageUrl(el.getAttribute("src") ?? null);
          const alt = el.getAttribute("alt") ?? "";
          if (alt) st.cur.title = alt;
        }
      },
    })
    .on(".listPub .listText a", {
      element(el) {
        const href = el.getAttribute("href");
        if (st.cur && href) st.cur.publicationUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (st.cur) st.cur.publication = (st.cur.publication ?? "") + t.text;
      },
    })
    .on(".listPub .criticListRank", {
      text(t) {
        if (st.cur) st.cur.rank = ((st.cur.rank ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return {
    slug: albumSlug,
    page,
    lists: lists.map((l) => ({
      url: l.url ?? "",
      title: decodeEntities((l.title ?? "").trim()),
      publication: decodeEntities((l.publication ?? "").trim()),
      publicationUrl: l.publicationUrl ?? null,
      cover: l.cover ?? null,
      rank: parseRank((l.rank ?? "").replace("#", "").trim()),
    })),
  };
}

function parseFaqHtml(html: string, defaultSection: string): FaqItem[] {
  const out: FaqItem[] = [];
  const titleM = html.match(/<div class="faqPageTitle">([^<]+)<\/div>/i);
  const sectionTitle = titleM?.[1] ? decodeEntities(titleM[1].trim()) : defaultSection;
  for (const m of html.matchAll(/<div class="faqQuestion">(.*?)<\/div>\s*<div class="faqAnswer">(.*?)<\/div>/gs)) {
    const q = m[1];
    const a = m[2];
    if (q && a) {
      out.push({
        question: decodeEntities(q.replace(/<[^>]+>/g, "").trim()),
        answer: decodeEntities(a.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
        section: sectionTitle,
      });
    }
  }
  return out;
}

export async function scrapeFaq(
  sectionOrOpts?: string | FetchOpts | null,
  opts: FetchOpts = FETCH_OPTS,
): Promise<FaqItem[]> {
  const section = typeof sectionOrOpts === "string" ? sectionOrOpts.trim().toLowerCase() : null;
  const effectiveOpts = typeof sectionOrOpts === "object" && sectionOrOpts !== null ? sectionOrOpts : opts;

  if (section === "community" || section === "rules") {
    const res = await fetch(`${BASE}/faq/community.php`, effectiveOpts);
    if (!res.ok) throw new Error(`FAQ fetch failed: ${res.status}`);
    const html = await res.text();
    return parseFaqHtml(html, "Community Rules");
  }

  if (section === "all") {
    const [genRes, comRes] = await Promise.all([
      fetch(`${BASE}/faq/`, effectiveOpts),
      fetch(`${BASE}/faq/community.php`, effectiveOpts),
    ]);
    if (!genRes.ok) throw new Error(`FAQ fetch failed: ${genRes.status}`);
    const [genHtml, comHtml] = await Promise.all([
      genRes.text(),
      comRes.ok ? comRes.text() : "",
    ]);
    const genItems = parseFaqHtml(genHtml, "Frequently Asked Questions");
    const comItems = comHtml ? parseFaqHtml(comHtml, "Community Rules") : [];
    return [...genItems, ...comItems];
  }

  const res = await fetch(`${BASE}/faq/`, effectiveOpts);
  if (!res.ok) throw new Error(`FAQ fetch failed: ${res.status}`);
  const html = await res.text();
  return parseFaqHtml(html, "Frequently Asked Questions");
}

export async function scrapeGuidelines(type: "review" | "comment", opts: FetchOpts = FETCH_OPTS): Promise<GuidelinesSection> {
  const res = await fetch(`${BASE}/scripts/guidelines.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...REQ_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE}/`,
    },
    body: `type=${encodeURIComponent(type)}`,
  });
  if (!res.ok) throw new Error(`Guidelines fetch failed: ${res.status}`);
  const html = await res.text();

  const headingMatch = html.match(/<div class="heading">(.*?)<\/div>/);
  const title = headingMatch?.[1] ? decodeEntities(headingMatch[1].replace(/<[^>]+>/g, "").trim()) : `${type} Guidelines`;

  if (type === "review") {
    const bestPractices: string[] = [];
    const whatToAvoid: string[] = [];

    const bpMatch = html.match(/<div class="sectionTitle">Best Practices<\/div>\s*<ul>(.*?)<\/ul>/s);
    if (bpMatch?.[1]) {
      for (const m of bpMatch[1].matchAll(/<li>(.*?)<\/li>/gs)) {
        if (m[1]) bestPractices.push(decodeEntities(m[1].replace(/<[^>]+>/g, "").trim()));
      }
    }

    const waMatch = html.match(/<div class="sectionTitle">What to Avoid<\/div>\s*<ul>(.*?)<\/ul>/s);
    if (waMatch?.[1]) {
      for (const m of waMatch[1].matchAll(/<li>(.*?)<\/li>/gs)) {
        if (m[1]) whatToAvoid.push(decodeEntities(m[1].replace(/<[^>]+>/g, "").trim()));
      }
    }

    const footnoteMatch = html.match(/<div class="footnote">(.*?)<\/div>/);
    const footnote = footnoteMatch?.[1] ? decodeEntities(footnoteMatch[1].replace(/<[^>]+>/g, "").trim()) : null;

    return {
      type,
      title,
      bestPractices,
      whatToAvoid,
      footnote,
    };
  } else {
    const sections: { title: string; text: string }[] = [];
    for (const m of html.matchAll(/<p>(?:<strong>(.*?):?<\/strong>)?\s*(.*?)<\/p>/gs)) {
      const titleChunk = m[1];
      const textChunk = m[2];
      const secTitle = titleChunk ? decodeEntities(titleChunk.replace(/<[^>]+>/g, "").replace(/:$/, "").trim()) : "General";
      const text = textChunk ? decodeEntities(textChunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "";
      if (text) sections.push({ title: secTitle, text });
    }

    return {
      type,
      title,
      sections,
    };
  }
}

export async function scrapeChangelog(opts: FetchOpts = FETCH_OPTS): Promise<ChangelogEntry[]> {
  const res = await fetch(`${BASE}/changelog/`, opts);
  if (!res.ok) throw new Error(`Changelog fetch failed: ${res.status}`);
  const html = await res.text();
  const entries: ChangelogEntry[] = [];
  // One .changeSection can hold several type/title/text triples (one entry each).
  for (const sec of html.matchAll(/<section class="changeSection">([\s\S]*?)<\/section>/g)) {
    const body = sec[1] ?? "";
    const dateM = body.match(/<div class="changeDate">([^<]*)<\/div>/);
    const date = (dateM?.[1] ?? "").trim();
    const parts = body.split(/(?=<div class="changeType)/g).filter((p) => p.includes("changeTitle"));
    if (parts.length === 0) continue;
    for (const part of parts) {
      const typeM = part.match(/<div class="changeType[^"]*">([^<]*)<\/div>/);
      const titleM = part.match(/<h2 class="changeTitle">([\s\S]*?)<\/h2>/);
      const textM = part.match(/<div class="changeText">([\s\S]*?)<\/div>/);
      const textHtml = textM?.[1] ?? "";
      const links: import("../types.js").NamedLink[] = [];
      for (const m of textHtml.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)) {
        const href = m[1] ?? "";
        const name = m[2] ?? "";
        if (href && name.trim()) {
          links.push({
            name: decodeEntities(name.trim()),
            url: href.startsWith("http") ? href : href.startsWith("/") ? BASE + href : `${BASE}/${href}`,
          });
        }
      }
      entries.push({
        date,
        dateTimestamp: parseDateToTimestamp(date),
        type: (typeM?.[1] ?? "").trim(),
        title: decodeEntities((titleM?.[1] ?? "").replace(/<[^>]+>/g, "").trim()),
        text: decodeEntities(textHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
        links,
      });
    }
  }
  return entries;
}

export async function scrapeSiteStats(opts: FetchOpts = FETCH_OPTS): Promise<SiteStats> {
  const res = await fetch(`${BASE}/stats/`, opts);
  if (!res.ok) throw new Error(`Site stats fetch failed: ${res.status}`);

  const totals: Array<{ name: string; value: string; key: string | null; timestamp: string | null }> = [];
  const leaderboards: LeaderboardModule[] = [];

  let currentSingle: { name: string; value: string; key: string | null; timestamp: string | null } | null = null;
  let currentLeaderboard: LeaderboardModule | null = null;
  let currentCells: string[] = [];

  await new HTMLRewriter()
    .on(".module.singleStat", {
      element() {
        currentSingle = { name: "", value: "", key: null, timestamp: null };
        totals.push(currentSingle);
      },
    })
    .on(".module.singleStat .heading", {
      text(t) {
        if (currentSingle) currentSingle.name = (currentSingle.name ?? "") + t.text;
      },
    })
    .on(".module.singleStat .statValue", {
      text(t) {
        if (currentSingle) currentSingle.value = (currentSingle.value ?? "") + t.text;
      },
    })
    .on(".module.singleStat .refreshStats", {
      element(el) {
        if (currentSingle) currentSingle.key = el.getAttribute("data-key") ?? null;
      },
    })
    .on(".module.singleStat .timestamp", {
      text(t) {
        if (currentSingle) currentSingle.timestamp = ((currentSingle.timestamp ?? "") as string) + t.text;
      },
    })
    .on(".module:not(.singleStat)", {
      element() {
        currentLeaderboard = { title: "", key: null, timestamp: null, items: [] };
        leaderboards.push(currentLeaderboard);
      },
    })
    .on(".module:not(.singleStat) .heading", {
      text(t) {
        if (currentLeaderboard) currentLeaderboard.title = (currentLeaderboard.title ?? "") + t.text;
      },
    })
    .on(".module:not(.singleStat) tr", {
      element() {
        currentCells = [];
      },
    })
    .on(".module:not(.singleStat) td", {
      element() {
        currentCells.push("");
      },
      text(t) {
        if (currentCells.length > 0) {
          const lastIndex = currentCells.length - 1;
          const currentCell = currentCells[lastIndex];
          if (currentCell !== undefined) {
            currentCells[lastIndex] = currentCell + t.text;
          }
          const c0 = currentCells[0];
          const c1 = currentCells[1];
          if (currentCells.length === 2 && currentLeaderboard && currentLeaderboard.items && c0 !== undefined && c1 !== undefined) {
            const existing = currentLeaderboard.items[currentLeaderboard.items.length - 1];
            const parsedVal = parseCount(c1.trim()) ?? 0;
            if (!existing || existing.name !== decodeEntities(c0.trim())) {
              currentLeaderboard.items.push({
                name: decodeEntities(c0.trim()),
                value: parsedVal,
              });
            } else {
              existing.value = parsedVal;
            }
          }
        }
      },
    })
    .on(".module:not(.singleStat) .refreshStats", {
      element(el) {
        if (currentLeaderboard) currentLeaderboard.key = el.getAttribute("data-key") ?? null;
      },
    })
    .on(".module:not(.singleStat) .stats-footer .timestamp", {
      text(t) {
        if (currentLeaderboard) currentLeaderboard.timestamp = ((currentLeaderboard.timestamp ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    totals: totals.map((t) => ({
      name: decodeEntities((t.name ?? "").trim()),
      value: parseCount((t.value ?? "").trim()) ?? 0,
      key: t.key ?? null,
      timestamp: t.timestamp ? (t.timestamp as string).trim() : null,
    })),
    leaderboards: leaderboards.map((l) => ({
      title: decodeEntities((l.title ?? "").trim()),
      key: l.key ?? null,
      timestamp: l.timestamp ? (l.timestamp as string).trim() : null,
      items: l.items ?? [],
    })),
  };
}

/** Live-refresh a stats module. Verified shape: {"html":"1,973,103<\/div>","timestamp":"0s ago"}. */
export async function scrapeStatsRefresh(key: string, opts: FetchOpts = FETCH_OPTS): Promise<{ key: string; html: string; timestamp: string | null }> {
  const res = await fetch(`${BASE}/stats/stats-refresh.php?key=${encodeURIComponent(key)}`, opts);
  if (!res.ok) throw new Error(`Stats refresh failed: ${res.status}`);
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { html?: unknown; timestamp?: unknown };
    return {
      key,
      html: typeof data.html === "string" ? data.html : text,
      timestamp: typeof data.timestamp === "string" ? data.timestamp : null,
    };
  } catch {
    return { key, html: text, timestamp: null };
  }
}

export async function scrapeCommentsPage(aotyPath: string, opts: FetchOpts = FETCH_OPTS): Promise<{ comments: AotyComment[]; moreDiscussion: import("../types.js").DiscussionEntry[] }> {
  const res = await fetch(`${BASE}${aotyPath}`, opts);
  if (!res.ok) throw new Error(`Comments fetch failed: ${res.status}`);
  const html = await res.text();
  const comments = await scrapeCommentRows(new Response(html));
  return { comments, moreDiscussion: parseDiscussionTable(html) };
}

/** "More Discussion" album table (album/user-reviews + comments pages, /users/). */
export function parseDiscussionTable(html: string): import("../types.js").DiscussionEntry[] {
  const discussions: import("../types.js").DiscussionEntry[] = [];
  const tableM = html.match(/<table class="discussion">([\s\S]*?)<\/table>/i);
  if (!tableM?.[1]) return discussions;
  for (const tr of tableM[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const row = tr[1] ?? "";
    if (!row || row.includes("<th")) continue;
    const coverM = row.match(/class="coverart"[^>]*>[\s\S]*?<a href="([^"]+)">[\s\S]*?<img[^>]*src="([^"]+)"/i);
    const titleM = row.match(/<td class="title">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>/i);
    const commentsM = row.match(/<td class="comments">([^<]*)<\/td>/i);
    const lastUserM = row.match(/class="lastPost"[^>]*>[\s\S]*?<a href="([^"]*\/user\/[^"]*)">([^<]*)<\/a>/i);
    const lastDateM = row.match(/<div class="date"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/div>/i);
    if (!titleM?.[1]) continue;
    const titleHtml = titleM[2] ?? "";
    const divs = [...titleHtml.matchAll(/<div>([^<]*)<\/div>/g)].map((d) => decodeEntities((d[1] ?? "").trim())).filter(Boolean);
    const lPostExact = lastDateM?.[1] ? lastDateM[1].trim() : null;
    discussions.push({
      artist: divs[0] ?? "",
      album: divs[1] ?? divs[0] ?? "",
      albumUrl: titleM[1].startsWith("http") ? titleM[1] : BASE + titleM[1],
      cover: coverM?.[2] ? cleanImageUrl(coverM[2]) : null,
      commentCount: commentsM?.[1] ? parseInt(commentsM[1].replace(/,/g, "").trim(), 10) || 0 : 0,
      lastUser: lastUserM?.[2] ? decodeEntities(lastUserM[2].trim()) : "",
      lastUserUrl: lastUserM?.[1] ? (lastUserM[1].startsWith("http") ? lastUserM[1] : BASE + lastUserM[1]) : "",
      lastPostAgo: lastDateM?.[2] ? lastDateM[2].trim() : null,
      lastPostExact: lPostExact,
      lastPostExactTimestamp: parseDateToTimestamp(lPostExact),
    });
  }
  return discussions;
}

export async function scrapeNewsDetail(slug: string, opts: FetchOpts = FETCH_OPTS): Promise<NewsDetail> {
  const url = `${BASE}/l/${slug}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`News item fetch failed: ${res.status}`);
  const html = await res.text();
  const s = {
    title: "",
    source: "",
    sourceUrl: "",
    date: "",
    image: null as string | null,
    text: "",
    likes: "",
    embedUrl: null as string | null,
    related: [] as Array<{ name: string; url: string }>,
    streamingLinks: [] as Array<{ platform: string; url: string }>,
  };
  await new HTMLRewriter()
    .on(".mediaHeader h1 a, h1.headline a", {
      element(el) {
        if (!s.sourceUrl) s.sourceUrl = el.getAttribute("href") ?? "";
      },
      text(t) {
        s.title += t.text;
      },
    })
    .on(".mediaHeader .image img", {
      element(el) {
        if (!s.image) s.image = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".mediaByline .mediaDate", {
      text(t) {
        s.date += t.text;
      },
    })
    .on(".mediaByline a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href.startsWith("http") && !s.sourceUrl) s.sourceUrl = href;
      },
      text(t) {
        s.source += t.text;
      },
    })
    .on(".mediaText", {
      text(t) {
        s.text += t.text;
      },
    })
    .on(".media_like, .points", {
      text(t) {
        s.likes += t.text;
      },
    })
    .on(".mediaEmbed iframe", {
      element(el) {
        if (!s.embedUrl) s.embedUrl = el.getAttribute("src") ?? null;
      },
    })
    .on(".inlineRelated a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href) s.related.push({ name: "", url: href.startsWith("http") ? href : BASE + href });
      },
      text(t) {
        const last = s.related[s.related.length - 1];
        if (last) last.name += t.text;
      },
    })
    .on(".listenOn a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href.startsWith("http")) {
          const host = href.replace(/^https?:\/\//, "").split("/")[0] ?? "";
          const platform = host.includes("spotify") ? "Spotify" : host.includes("apple") ? "Apple Music" : host.includes("amazon") ? "Amazon" : host.includes("bandcamp") ? "Bandcamp" : host.includes("soundcloud") ? "SoundCloud" : host;
          s.streamingLinks.push({ platform, url: href });
        }
      },
    })
    .transform(new Response(html))
    .arrayBuffer();
  const comments = await scrapeCommentRows(new Response(html));
  const idM = slug.match(/^(\d+)/);
  // Structured entity block: Artist / Album / Label rows + tags.
  let newsArtist: NamedLink | null = null;
  let newsAlbum: NamedLink | null = null;
  let newsLabel: string | null = null;
  for (const m of html.matchAll(/<div class="mediaDetailsRow">[\s\S]*?<span>([^<]*)<\/span>([\s\S]*?)<\/div>/g)) {
    const kind = (m[1] ?? "").replace("/", "").trim().toLowerCase();
    const body = m[2] ?? "";
    const linkM = body.match(/<a href="([^"]+)">([^<]+)<\/a>/);
    if (linkM?.[1] && linkM[2]) {
      const link = {
        name: decodeEntities(linkM[2].trim()),
        url: linkM[1].startsWith("http") ? linkM[1] : BASE + linkM[1],
      };
      if (kind.includes("artist") && !newsArtist) newsArtist = link;
      else if (kind.includes("album") && !newsAlbum) newsAlbum = link;
    } else if (kind.includes("label")) {
      const plain = decodeEntities(body.replace(/<[^>]+>/g, "").trim());
      if (plain) newsLabel = plain;
    }
  }
  const newsTags: NamedLink[] = [];
  for (const m of html.matchAll(/<div class="tag[^"]*">\s*<a href="([^"]*\/tag\/[^"]*)">([^<]*)<\/a>/g)) {
    const href = m[1] ?? "";
    const name = m[2] ?? "";
    if (href && name) {
      newsTags.push({
        name: decodeEntities(name.trim()),
        url: href.startsWith("http") ? href : BASE + href,
      });
    }
  }
    const nDate = s.date.trim();
    return {
      url,
      id: parseId(idM?.[1]) ?? 0,
      title: decodeEntities(s.title.trim()),
      source: decodeEntities(s.source.trim()),
      sourceUrl: s.sourceUrl,
      date: nDate,
      dateTimestamp: parseDateToTimestamp(nDate),
      image: cleanImageUrl(s.image),
      text: decodeEntities(s.text.trim()),
      likes: parseCount(s.likes.trim()) ?? 0,
      embedUrl: s.embedUrl,
      artist: newsArtist,
      album: newsAlbum,
      label: newsLabel,
      tags: newsTags,
      related: s.related.map((r) => ({ name: decodeEntities(r.name.trim()), url: r.url })),
      streamingLinks: s.streamingLinks,
      comments,
    };
}

export async function scrapeSearchNews(query: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<{ query: string; page: number; news: NewsSearchItem[] }> {
  const p = page > 1 ? `&p=${page}` : "";
  const res = await fetch(`${BASE}/search/news/?q=${encodeURIComponent(query)}${p}`, opts);
  if (!res.ok) throw new Error(`News search failed: ${res.status}`);
  const items: NewsSearchItem[] = [];
  let cur: NewsSearchItem | null = null;
  await new HTMLRewriter()
    .on(".newsBlockLarge", {
      element() {
        cur = { title: "", url: "", source: null, image: null };
        items.push(cur);
      },
    })
    .on(".newsBlockLarge a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (cur && href.includes("/l/") && !cur.url) cur.url = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (cur) cur.title = (cur.title ?? "") + t.text;
      },
    })
    .on(".newsBlockLarge img", {
      element(el) {
        if (cur) cur.image = cleanImageUrl(el.getAttribute("data-src") || el.getAttribute("src") || null);
      },
    })
    .on(".newsBlockLarge .domain", {
      text(t) {
        if (cur) cur.source = ((cur.source ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return {
    query,
    page,
    news: items
      .filter((i) => (i.title ?? "").trim())
      .map((i) => ({
        title: decodeEntities((i.title ?? "").trim()),
        url: i.url ?? "",
        source: (i.source ?? "").trim() || null,
        image: cleanImageUrl(i.image && !i.image.includes("white.gif") ? i.image : null),
      })),
  };
}

export async function scrapeSearchTags(query: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<{ query: string; page: number; tags: TagItem[] }> {
  const p = page > 1 ? `&p=${page}` : "";
  const res = await fetch(`${BASE}/search/tags/?q=${encodeURIComponent(query)}${p}`, opts);
  if (!res.ok) throw new Error(`Tag search failed: ${res.status}`);
  const tags: TagItem[] = [];
  let cur: TagItem | null = null;
  await new HTMLRewriter()
    .on(".tagRow", {
      element() {
        cur = { name: "", url: "" };
        tags.push(cur);
      },
    })
    .on(".tagRow a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (cur && !cur.url && href.includes("/tag/")) cur.url = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (cur) cur.name = (cur.name ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return { query, page, tags: tags.map((t) => ({ name: decodeEntities(t.name.trim()), url: t.url })) };
}

export async function scrapeSiteUpdates(opts: FetchOpts = FETCH_OPTS, filter: string | null = null, page = 1): Promise<{ filter: string | null; page: number; updates: SiteUpdate[] }> {
  let url = filter ? `${BASE}/updates/?f=${encodeURIComponent(filter)}` : `${BASE}/updates/`;
  if (page > 1) {
    url = filter ? `${BASE}/updates/${page}/?f=${encodeURIComponent(filter)}` : `${BASE}/updates/${page}/`;
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Updates fetch failed: ${res.status}`);
  const updates: SiteUpdate[] = [];
  let cur: SiteUpdate | null = null;
  let linkKind: "title" | "artist" | null = null;
  await new HTMLRewriter()
    .on(".upd", {
      element() {
        cur = { kind: "", title: "", url: "", artist: null, artistUrl: null, image: null, publication: null, publicationLogo: null, excerpt: null, sourceUrl: null, meta: null, timeAgo: null };
        updates.push(cur);
        linkKind = null;
      },
    })
    .on(".upd .updHead", {
      text(t) {
        if (cur) cur.kind = (cur.kind ?? "") + t.text;
      },
    })
    .on(".upd .updText a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (!cur) return;
        if (href.includes("/album/") || href.includes("/song/") || href.includes("/list/") || href.includes("/l/")) {
          if (!cur.url) {
            linkKind = "title";
            cur.url = href.startsWith("http") ? href : BASE + href;
          } else linkKind = null;
        } else if (href.includes("/artist/")) {
          linkKind = "artist";
          if (!cur.artistUrl) cur.artistUrl = href.startsWith("http") ? href : BASE + href;
        } else {
          // External "Source" link on review updates.
          if (href.startsWith("http") && !cur.sourceUrl) cur.sourceUrl = href;
          linkKind = null;
        }
      },
      text(t) {
        if (!cur || !linkKind) return;
        if (linkKind === "title") cur.title = (cur.title ?? "") + t.text;
        else if (linkKind === "artist") cur.artist = ((cur.artist ?? "") as string) + t.text;
      },
    })
    // Publication logo + name on review updates.
    .on(".upd .updText img", {
      element(el) {
        if (!cur) return;
        const src = el.getAttribute("src") ?? "";
        if (src.includes("/publication/") && !cur.publicationLogo) {
          cur.publicationLogo = cleanImageUrl(src);
        }
      },
    })
    .on(".upd .updText span", {
      text(t) {
        if (cur?.publicationLogo && !(cur.publication ?? "").trim()) {
          const v = t.text.trim();
          if (v && v.length < 80) cur.publication = (cur.publication ?? "") + t.text;
        }
      },
    })
    // Review excerpt paragraph.
    .on(".upd .updText div[style*='margin']", {
      text(t) {
        if (cur && !(cur.excerpt ?? "").trim()) cur.excerpt = ((cur.excerpt ?? "") as string) + t.text;
      },
    })
    .on(".upd .updImage img", {
      element(el) {
        if (cur) cur.image = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".upd .updText p", {
      text(t) {
        if (cur) cur.meta = ((cur.meta ?? "") as string) + t.text;
      },
    })
    .on(".upd .small-font", {
      text(t) {
        if (cur) cur.timeAgo = ((cur.timeAgo ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return {
    filter,
    page,
    updates: updates.map((u) => ({
      kind: (u.kind ?? "").trim(),
      title: decodeEntities((u.title ?? "").trim()),
      url: u.url ?? "",
      artist: u.artist ? decodeEntities((u.artist as string).trim()) : null,
      artistUrl: u.artistUrl ?? null,
      image: cleanImageUrl(u.image ?? null),
      publication: u.publication ? decodeEntities((u.publication as string).trim()) : null,
      publicationLogo: cleanImageUrl(u.publicationLogo ?? null),
      excerpt: u.excerpt ? decodeEntities((u.excerpt as string).replace(/\s+/g, " ").trim()) : null,
      sourceUrl: u.sourceUrl ?? null,
      meta: (u.meta ?? "").trim() || null,
      timeAgo: (u.timeAgo ?? "").trim() || null,
    })),
  };
}

export async function scrapeAlbumCommentReplies(albumId: string | number, commentId: string | number, opts: FetchOpts = FETCH_OPTS): Promise<{ albumId: number; commentId: number; replies: AotyComment[] }> {
  const res = await fetch(`${BASE}/scripts/showAlbumCommentReplies.php`, {
    ...opts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/album/${albumId}/` },
    body: new URLSearchParams({ id: String(commentId), albumID: String(albumId) }).toString(),
  });
  if (!res.ok) throw new Error(`Comment replies fetch failed: ${res.status}`);
  return { albumId: parseId(albumId) ?? 0, commentId: parseId(commentId) ?? 0, replies: await scrapeCommentRows(res) };
}

/** Replies on a user-list comment thread (verified handler: showListCommentReplies {id, listID, commentType}). */
export async function scrapeListCommentReplies(listId: string | number, commentId: string | number, opts: FetchOpts = FETCH_OPTS): Promise<{ listId: number; commentId: number; replies: AotyComment[] }> {
  const res = await fetch(`${BASE}/scripts/showListCommentReplies.php`, {
    ...opts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/list/${listId}/` },
    body: new URLSearchParams({ id: String(commentId), listID: String(listId), commentType: "userList" }).toString(),
  });
  if (!res.ok) throw new Error(`List comment replies fetch failed: ${res.status}`);
  return { listId: parseId(listId) ?? 0, commentId: parseId(commentId) ?? 0, replies: await scrapeCommentRows(res) };
}

/** Replies on an artist comment thread (verified handler: showArtistCommentReplies {id, artistID}). */
export async function scrapeArtistCommentReplies(artistId: string | number, commentId: string | number, opts: FetchOpts = FETCH_OPTS): Promise<{ artistId: number; commentId: number; replies: AotyComment[] }> {
  const parsedArtistId = parseId(artistId) ?? 0;
  const parsedCommentId = parseId(commentId) ?? 0;
  const res = await fetch(`${BASE}/scripts/showArtistCommentReplies.php`, {
    ...opts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/artist/${parsedArtistId}/` },
    body: new URLSearchParams({ id: String(parsedCommentId), artistID: String(parsedArtistId) }).toString(),
  });
  if (!res.ok) throw new Error(`Artist comment replies fetch failed: ${res.status}`);
  return { artistId: parsedArtistId, commentId: parsedCommentId, replies: await scrapeCommentRows(res) };
}

/**
 * Inline news embed (verified request: POST /scripts/showContent.php {linkID}).
 * Embed markup varies by provider, so the fragment is returned raw.
 */
export async function scrapeNewsEmbed(linkId: string | number, opts: FetchOpts = FETCH_OPTS): Promise<{ id: number; html: string }> {
  const res = await fetch(`${BASE}/scripts/showContent.php`, {
    ...opts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/l/newsworthy/` },
    body: new URLSearchParams({ linkID: String(linkId) }).toString(),
  });
  if (!res.ok) throw new Error(`News embed fetch failed: ${res.status}`);
  return { id: parseId(linkId) ?? 0, html: await res.text() };
}

export async function scrapeHomepage(opts: FetchOpts = FETCH_OPTS): Promise<{
  newReleases: import("../types.js").AlbumBlock[];
  news: import("../types.js").NewsItem[];
  anticipated: import("../types.js").AlbumBlock[];
  criticsBest: import("../types.js").ChartItem[];
  usersBest: import("../types.js").ChartItem[];
  popular: import("../types.js").AlbumBlock[];
  popularReviews: import("../types.js").UserReview[];
  underRadar: import("../types.js").AlbumBlock[];
  onThisDay: import("../types.js").AlbumBlock[];
  recentlyAdded: import("../types.js").AlbumBlock[];
  topSongs: import("../types.js").TopSong[];
  bestSongs: import("../types.js").HomepageSong[];
  popularGenres: import("../types.js").NamedLink[];
  browseBy: import("../types.js").NamedLink[];
}> {
  const { scrapeRatingsChart } = await import("./charts.js");
  const { scrapeUserReviewBlocks } = await import("./user.js");
  const { scrapeTopSongs } = await import("./song.js");
  const year = new Date().getFullYear();
  const [
    newReleasesRes,
    newsItems,
    anticipatedRes,
    criticsBest,
    usersBest,
    popularRes,
    popularReviewsRes,
    underRadarRes,
    onThisDayRes,
    recentlyAddedRes,
    topSongs,
  ] = await Promise.all([
    fetch(`${BASE}/releases/this-week/`, opts),
    scrapeNewsPage(`${BASE}/l/newsworthy/1/`, opts),
    fetch(`${BASE}/discover/anticipated/`, opts),
    scrapeRatingsChart(`/ratings/6-highest-rated/${year}/1`, opts),
    scrapeRatingsChart(`/ratings/user-highest-rated/${year}/1`, opts),
    fetch(`${BASE}/discover/`, opts),
    fetch(`${BASE}/user-reviews/`, opts),
    fetch(`${BASE}/discover/under-radar/`, opts),
    fetch(`${BASE}/on-this-day/`, opts),
    fetch(`${BASE}/recently-added/`, opts),
    scrapeTopSongs(String(year), 1, opts),
  ]);
  const blocks = (res: Response) => scrapeAlbumBlocks(res);
  const [newReleases, anticipated, popular, underRadar, onThisDay, recentlyAdded, popularReviews] = await Promise.all([
    blocks(newReleasesRes),
    blocks(anticipatedRes),
    blocks(popularRes),
    blocks(underRadarRes),
    blocks(onThisDayRes),
    blocks(recentlyAddedRes),
    scrapeUserReviewBlocks(popularReviewsRes),
  ]);

  // Bottom rails parsed from the homepage DOM itself (one extra fetch).
  let bestSongs: import("../types.js").HomepageSong[] = [];
  let popularGenres: import("../types.js").NamedLink[] = [];
  let browseBy: import("../types.js").NamedLink[] = [];
  try {
    const homeRes = await fetch(`${BASE}/`, opts);
    if (homeRes.ok) {
      const homeHtml = await homeRes.text();
      bestSongs = parseHomepageBestSongs(homeHtml);
      popularGenres = parseHomepageLinkSection(homeHtml, "Popular Genres", /^\/genre\//);
      browseBy = parseHomepageLinkSection(homeHtml, "Browse By", /^\/decade\/|^\/20\d\d\/releases\/|^\/week\//);
    }
  } catch { /* bottom rails are best-effort */ }
  return {
    newReleases,
    news: newsItems,
    anticipated,
    criticsBest,
    usersBest,
    popular,
    popularReviews,
    underRadar,
    onThisDay,
    recentlyAdded,
    topSongs: topSongs.songs,
    bestSongs,
    popularGenres,
    browseBy,
  };
}

/** "Users' Best Songs of YYYY" track table at the bottom of the homepage. */
function parseHomepageBestSongs(html: string): import("../types.js").HomepageSong[] {
  const headIdx = html.indexOf("Best Songs");
  if (headIdx === -1) return [];
  const tableM = html.slice(headIdx).match(/<table class="trackListTable">([\s\S]*?)<\/table>/i);
  const tableHtml = tableM?.[1];
  if (!tableHtml) return [];
  const songs: import("../types.js").HomepageSong[] = [];
  for (const tr of tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const row = tr[1] ?? "";
    const coverM = row.match(/class="coverart"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);
    const songM = row.match(/class="songAlbum"[^>]*>[\s\S]*?<a href="([^"]*\/song\/[^"]*)">([^<]+)<\/a>/i);
    const artistM = row.match(/<div class="gray-font">([^<]*)<\/div>/i);
    const scoreM = row.match(/class="trackRating[^"]*"[^>]*>[\s\S]*?<span[^>]*title="([\d,]+) Ratings?"[^>]*>([^<]*)<\/span>/i)
      ?? row.match(/class="trackRating[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/i);
    if (!songM?.[1] || !songM[2]) continue;
    const countRaw = scoreM && scoreM.length > 2 ? scoreM[1] : null;
    const scoreRaw = scoreM ? (scoreM.length > 2 ? scoreM[2] : scoreM[1]) : "";
    songs.push({
      title: decodeEntities(songM[2].trim()),
      url: songM[1].startsWith("http") ? songM[1] : BASE + songM[1],
      artist: artistM?.[1] ? decodeEntities(artistM[1].trim()) : "",
      cover: coverM?.[1] ? cleanImageUrl(coverM[1]) : null,
      score: parseScore((scoreRaw ?? "").trim()),
      ratingCount: countRaw ? parseInt(countRaw.replace(/,/g, ""), 10) : null,
    });
  }
  return songs;
}

/** Named link sections ("Popular Genres", "Browse By") sliced by heading. */
function parseHomepageLinkSection(html: string, heading: string, hrefPattern: RegExp): import("../types.js").NamedLink[] {
  const start = html.indexOf(heading);
  if (start === -1) return [];
  const next = html.indexOf("sectionHeading", start + heading.length);
  const chunk = html.slice(start, next !== -1 ? next : start + 8000);
  const links: import("../types.js").NamedLink[] = [];
  const seen = new Set<string>();
  for (const m of chunk.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)) {
    const href = m[1] ?? "";
    const name = decodeEntities((m[2] ?? "").trim());
    if (!href || !name || seen.has(href)) continue;
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    if (!hrefPattern.test(path)) continue;
    seen.add(href);
    links.push({ name, url: href.startsWith("http") ? href : BASE + href });
  }
  return links;
}

export async function scrapeAlbumSubAlbums(albumSlug: string, sub: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<{ slug: string; page: number; albums: import("../types.js").AlbumBlock[] }> {
  const url = page > 1 ? `${BASE}/album/${albumSlug}/${sub}/${page}/` : `${BASE}/album/${albumSlug}/${sub}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Album ${sub} fetch failed: ${res.status}`);
  return { slug: albumSlug, page, albums: await scrapeAlbumBlocks(res) };
}

export async function scrapeAlbumUserLists(albumSlug: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<UserListEntry[]> {
  const url = page > 1 ? `${BASE}/album/${albumSlug}/user-lists/${page}/` : `${BASE}/album/${albumSlug}/user-lists/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Album user lists fetch failed: ${res.status}`);
  return scrapeUserListRows(res);
}

export async function scrapeAllComments(
  type: string,
  itemId: string | number,
  albumId?: string | number | null,
  opts: FetchOpts = FETCH_OPTS,
): Promise<AllCommentsResult> {
  const bodyParams = new URLSearchParams({ type, itemID: String(itemId) });
  if (albumId) bodyParams.set("albumID", String(albumId));

  const res = await fetch(`${BASE}/scripts/viewAllComments.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: bodyParams.toString(),
  });
  if (!res.ok) throw new Error(`All comments fetch failed: ${res.status}`);
  const html = await res.text();
  const comments = await scrapeCommentRows(new Response(html));
  return {
    type,
    itemId: parseId(itemId) ?? 0,
    albumId: albumId ? (parseId(albumId) ?? null) : null,
    comments,
  };
}

export async function scrapeEntityCorrections(
  type: "album" | "artist" | "song",
  idOrSlug: string,
  opts: FetchOpts = FETCH_OPTS,
): Promise<EntityCorrectionsResult> {
  let url: string;
  if (type === "album") {
    const id = idOrSlug.match(/^(\d+)/)?.[1] ?? idOrSlug;
    url = `${BASE}/album/corrections.php?id=${encodeURIComponent(id)}`;
  } else if (type === "artist") {
    url = `${BASE}/artist/${encodeURIComponent(idOrSlug)}/corrections/`;
  } else {
    const id = idOrSlug.match(/^(\d+)/)?.[1] ?? idOrSlug;
    url = `${BASE}/song/corrections.php?id=${encodeURIComponent(id)}`;
  }

  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Corrections fetch failed: ${res.status}`);
  const html = await res.text();

  const titleM = html.match(/<h1 class="(?:albumTitle|headline)[^"]*">\s*<a [^>]*>([^<]+)<\/a>/i);
  const title = titleM?.[1] ? decodeEntities(titleM[1].trim()) : idOrSlug;

  const addedOnM = html.match(/Added on\s*<strong>([^<]+)<\/strong>/i);
  const addedOn = addedOnM?.[1] ? decodeEntities(addedOnM[1].trim()) : null;

  const addedByM = html.match(/by\s*<strong>\s*<a href="([^"]*)">([^<]*)<\/a>\s*<\/strong>/i);
  const addedBy = addedByM?.[2] ? decodeEntities(addedByM[2].trim()) : null;
  const addedByUrl = addedByM?.[1] ? (addedByM[1].startsWith("http") ? addedByM[1] : BASE + addedByM[1]) : null;

  const sourceM = html.match(/<strong>Source:\s*<\/strong>\s*<a href="([^"]+)"/i);
  const sourceUrl = sourceM?.[1] ?? null;

  const locked = html.includes("Locked for moderators only") || html.includes("notice");

  const changeLog: CorrectionChangeLogEntry[] = [];
  for (const row of html.matchAll(/<div class="logRow">([\s\S]*?)<\/div>/g)) {
    const r = row[1];
    if (!r) continue;
    const userM = r.match(/<strong><a href="([^"]*)">([^<]*)<\/a><\/strong>/i);
    const roleM = r.match(/<i title="([^"]*)"/i);
    const dateM = r.match(/<span class="gray-font">([^<]*)<\/span>/i);

    const cleanText = decodeEntities(
      r.replace(/<span class="gray-font">[\s\S]*?<\/span>/i, "")
        .replace(/<strong><a [^>]*>[^<]*<\/a><\/strong>/i, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );

    if (userM?.[2] && userM[1]) {
      changeLog.push({
        user: decodeEntities(userM[2].trim()),
        userUrl: userM[1].startsWith("http") ? userM[1] : BASE + userM[1],
        role: roleM?.[1] ?? null,
        action: cleanText,
        date: dateM?.[1] ? dateM[1].trim() : null,
      });
    }
  }

  const corrections: CorrectionItem[] = [];
  for (const m of html.matchAll(/<div class="[^"]*correction[^"]*" id="correction(\d+)">([\s\S]*?)(?=<div[^>]*id="correction\d+"|<div class="clear"|<div class="footer"|$)/gi)) {
    const cid = m[1];
    const content = m[2];
    if (!cid || !content) continue;
    const titleMatch = content.match(/<div class="correctionTitle">([^<]+)<\/div>/i);
    const statusMatch = content.match(/<span class="status[^"]*">([^<]+)<\/span>/i);
    const submitterMatch = content.match(/by <a href="([^"]*)">([^<]*)<\/a>/i);
    const dateMatch = content.match(/<span class="gray-font">([^<]*)<\/span>/i);

    const cDate = dateMatch?.[1] ? dateMatch[1].trim() : null;
    corrections.push({
      id: parseId(cid) ?? 0,
      title: titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : "",
      status: statusMatch?.[1] ? decodeEntities(statusMatch[1].trim()) : "Pending",
      submittedBy: submitterMatch?.[2] ? decodeEntities(submitterMatch[2].trim()) : null,
      submittedByUrl: submitterMatch?.[1] ? (submitterMatch[1].startsWith("http") ? submitterMatch[1] : BASE + submitterMatch[1]) : null,
      date: cDate,
      dateTimestamp: parseDateToTimestamp(cDate),
    });
  }

  return {
    id: parseId(idOrSlug.match(/^(\d+)/)?.[1] ?? idOrSlug) ?? 0,
    title,
    url,
    addedOn,
    addedOnTimestamp: parseDateToTimestamp(addedOn),
    addedBy,
    addedByUrl,
    sourceUrl,
    locked,
    changeLog,
    corrections,
  };
}

