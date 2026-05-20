import { BASE, FETCH_OPTS, type FetchOpts } from "../constants.js";
import type { NewsItem } from "../types.js";

export async function scrapeNewsPage(url: string, opts: FetchOpts = FETCH_OPTS): Promise<NewsItem[]> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);

  const items: NewsItem[] = [];
  let current: Partial<NewsItem> | null = null;

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
          likes: "",
          comments: "",
        };
        items.push(current as NewsItem);
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
      element(el) { if (current) current.image = el.getAttribute("src") ?? null; },
    })
    .on(".mediaContainer .source a", {
      element(el) { if (current) current.sourceUrl = el.getAttribute("href") ?? ""; },
      text(t) { if (current) current.source += t.text; },
    })
    .on(".mediaContainer .postDate", {
      text(t) { if (current) current.date = (current.date ?? "") + t.text; },
    })
    .on(".mediaContainer .points", {
      text(t) { if (current) current.likes = (current.likes ?? "") + t.text; },
    })
    .on(".mediaContainer .comment_count", {
      text(t) { if (current) current.comments = (current.comments ?? "") + t.text; },
    })
    .transform(res)
    .arrayBuffer();

  return items.map((item) => ({
    ...item,
    title: (item.title ?? "").trim(),
    source: (item.source ?? "").trim(),
    date: (item.date ?? "").trim(),
    likes: (item.likes ?? "").trim() || "0",
    comments: (item.comments ?? "").trim() || "0",
  }));
}
