import { BASE, FETCH_OPTS } from "../constants.js";
import type { ListDetailItem, ListEntry } from "../types.js";

export async function scrapeListsIndex(url: string): Promise<ListEntry[]> {
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`Lists fetch failed: ${res.status}`);

  const entries: ListEntry[] = [];
  let current: Partial<ListEntry> | null = null;

  await new HTMLRewriter()
    .on(".listColumn .listPub", {
      element() {
        current = { url: "", title: "", publication: "", cover: null };
        entries.push(current as ListEntry);
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
          current.cover = el.getAttribute("src") ?? null;
          current.title = el.getAttribute("alt") ?? "";
        }
      },
    })
    .on(".listColumn .listText a", {
      text(t) { if (current) current.publication += t.text; },
    })
    .transform(res)
    .arrayBuffer();

  return entries.map((e) => ({
    ...e,
    title: (e.title ?? "").trim(),
    publication: (e.publication ?? "").trim(),
  }));
}

export async function scrapeListDetail(url: string): Promise<{ title: string; sourceUrl: string; items: ListDetailItem[] }> {
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`List detail fetch failed: ${res.status}`);

  let listTitle = "";
  let sourceUrl = "";
  const items: ListDetailItem[] = [];
  let current: Partial<ListDetailItem> | null = null;

  await new HTMLRewriter()
    .on(".listHeader h1.headline", {
      text(t) { listTitle += t.text; },
    })
    .on(".listHeader a[href*='http']", {
      element(el) { if (!sourceUrl) sourceUrl = el.getAttribute("href") ?? ""; },
    })
    .on(".albumListRow", {
      element() {
        current = { rank: "", title: "", url: "", cover: "", date: "", genres: [] };
        items.push(current as ListDetailItem);
      },
    })
    .on(".albumListRank span[itemprop='position']", {
      text(t) { if (current) current.rank += t.text; },
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
      element(el) { if (current) current.cover = el.getAttribute("src") ?? ""; },
    })
    .on(".albumListDate", {
      text(t) { if (current) current.date += t.text; },
    })
    .on(".albumListGenre a[href*='/genre/']", {
      text(t) {
        const name = t.text.trim();
        if (current && name) (current.genres as string[]).push(name);
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    title: listTitle.trim(),
    sourceUrl,
    items: items.map((item) => ({
      rank: (item.rank ?? "").trim(),
      title: (item.title ?? "").trim(),
      url: item.url ?? "",
      cover: item.cover ?? "",
      date: (item.date ?? "").trim(),
      genres: ((item.genres as string[]) ?? []).map((g) => g.trim()).filter(Boolean),
    })),
  };
}
