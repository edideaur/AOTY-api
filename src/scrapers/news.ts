import { BASE, FETCH_OPTS, cleanImageUrl, decodeEntities, parseCount, parseId, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type { NewsItem, RssFeed, RssFeedItem } from "../types.js";

type RawNewsItem = {
  id: string;
  url: string;
  title: string;
  image: string | null;
  source: string;
  sourceUrl: string;
  date: string;
  submittedBy: string;
  submittedByUrl: string;
  likes: string;
  comments: string;
};

export async function scrapeNewsPage(url: string, opts: FetchOpts = FETCH_OPTS): Promise<NewsItem[]> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
  return parseNewsItems(res);
}

/** Same news items plus whether an older page exists (OLDER pager link). */
export async function scrapeNewsPageMeta(url: string, opts: FetchOpts = FETCH_OPTS): Promise<{ items: NewsItem[]; hasNextPage: boolean }> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
  const html = await res.text();
  const items = await parseNewsItems(new Response(html));
  const nextM = html.match(/<a href="([^"]*\/l\/[^"]*\/\d+\/)"[^>]*>\s*<div class="pageSelect next">OLDER<\/div>/i);
  return { items, hasNextPage: Boolean(nextM?.[1]) };
}

async function parseNewsItems(res: Response): Promise<NewsItem[]> {
  const items: RawNewsItem[] = [];
  let current: RawNewsItem | null = null;

  await new HTMLRewriter()
    .on(".mediaContainer", {
      element(el) {
        current = {
          id: el.getAttribute("id")?.replace(/^link/, "") ?? "",
          url: "",
          title: "",
          image: null,
          source: "",
          sourceUrl: "",
          date: "",
          submittedBy: "",
          submittedByUrl: "",
          likes: "",
          comments: "",
        };
        items.push(current);
      },
    })
    .on(".mediaContainer .content .title a", {
      element(el) {
        if (current) {
          const href = el.getAttribute("href");
          if (href) current.url = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) { if (current) current.title += t.text; },
    })
    .on(".mediaContainer .image img", {
      element(el) { if (current) current.image = cleanImageUrl(el.getAttribute("src") ?? null); },
    })
    .on(".mediaContainer .source a", {
      element(el) { if (current) current.sourceUrl = el.getAttribute("href") ?? ""; },
      text(t) { if (current) current.source += t.text; },
    })
    .on(".mediaContainer .postDate", {
      text(t) { if (current) current.date = (current.date ?? "") + t.text; },
    })
    // "1d ago by <a href=/user/x/>x</a>": submitter link inside the date line
    .on(".mediaContainer .postDate a", {
      element(el) {
        if (current) {
          const href = el.getAttribute("href") ?? "";
          if (href.includes("/user/")) current.submittedByUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) { if (current) current.submittedBy += t.text; },
    })
    .on(".mediaContainer .points", {
      text(t) { if (current) current.likes = (current.likes ?? "") + t.text; },
    })
    .on(".mediaContainer .comment_count", {
      text(t) { if (current) current.comments = (current.comments ?? "") + t.text; },
    })
    .transform(res)
    .arrayBuffer();

  return items.map((item) => {
    const submittedBy = decodeEntities((item.submittedBy ?? "").trim()) || null;
    // Strip the trailing " by <submitter>" that the postDate text handler absorbed.
    let date = (item.date ?? "").trim();
    if (submittedBy) {
      const cut = date.lastIndexOf(" by ");
      if (cut !== -1) date = date.slice(0, cut).trim();
    }
    return {
    id: parseId(item.id) ?? 0,
    url: item.url,
    title: decodeEntities((item.title ?? "").trim()),
    image: cleanImageUrl(item.image),
    source: decodeEntities((item.source ?? "").trim()),
    sourceUrl: item.sourceUrl,
    date,
    dateTimestamp: parseDateToTimestamp(date),
    submittedBy,
    submittedByUrl: item.submittedByUrl || null,
    likes: parseCount((item.likes ?? "").trim()) ?? 0,
    comments: parseCount((item.comments ?? "").trim()) ?? 0,
    };
  });
}

export async function scrapeNewsFeedXml(opts: FetchOpts = FETCH_OPTS): Promise<string> {
  const res = await fetch(`${BASE}/feed/news.xml`, opts);
  if (!res.ok) throw new Error(`News feed fetch failed: ${res.status}`);
  return res.text();
}

export async function scrapeNewsFeed(opts: FetchOpts = FETCH_OPTS): Promise<RssFeed> {
  const xml = await scrapeNewsFeedXml(opts);
  const titleM = xml.match(/<title>([^<]*)<\/title>/);
  const linkM = xml.match(/<link>([^<]*)<\/link>/);
  const descM = xml.match(/<description>([^<]*)<\/description>/);
  const items: RssFeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const itemXml = m[1];
    if (!itemXml) continue;
    const iTitle = itemXml.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const iLink = itemXml.match(/<link>([^<]*)<\/link>/)?.[1] ?? "";
    const iPubDate = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] ?? null;
    const iDesc = itemXml.match(/<description>([^<]*)<\/description>/)?.[1] ?? null;
    const pDate = iPubDate ? iPubDate.trim() : null;
    items.push({
      title: decodeEntities(iTitle.trim()),
      link: iLink.trim(),
      pubDate: pDate,
      pubDateTimestamp: parseDateToTimestamp(pDate),
      description: iDesc ? decodeEntities(iDesc.trim()) : null,
    });
  }
  return {
    title: decodeEntities(titleM?.[1]?.trim() ?? "Album of the Year"),
    link: linkM?.[1]?.trim() ?? `${BASE}/news/`,
    description: descM?.[1] ? decodeEntities(descM[1].trim()) : null,
    items,
  };
}

