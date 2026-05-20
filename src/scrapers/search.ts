import { BASE, FETCH_OPTS, type FetchOpts } from "../constants.js";
import type { SearchArtist, SearchLabel } from "../types.js";

export async function scrapeArtistSearch(url: string, opts: FetchOpts = FETCH_OPTS): Promise<SearchArtist[]> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Artist search failed: ${res.status}`);

  const artists: SearchArtist[] = [];
  let current: Partial<SearchArtist> | null = null;

  await new HTMLRewriter()
    .on(".artistBlock", {
      element() {
        current = { url: "", name: "", image: null };
        artists.push(current as SearchArtist);
      },
    })
    .on(".artistBlock .image a", {
      element(el) {
        if (current) {
          const href = el.getAttribute("href");
          if (href) current.url = BASE + href;
        }
      },
    })
    .on(".artistBlock .image img", {
      element(el) {
        if (current) current.image = el.getAttribute("src") ?? null;
      },
    })
    .on(".artistBlock > a", {
      element(el) {
        if (current && !current.url) {
          const href = el.getAttribute("href");
          if (href) current.url = BASE + href;
        }
      },
    })
    .on(".artistBlock .name a", {
      text(t) { if (current) current.name += t.text; },
    })
    .transform(res)
    .arrayBuffer();

  return artists.map((a) => ({
    ...a,
    name: (a.name ?? "").trim(),
  }));
}

export async function scrapeLabelSearch(url: string, opts: FetchOpts = FETCH_OPTS): Promise<SearchLabel[]> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Label search failed: ${res.status}`);

  const labels: SearchLabel[] = [];
  let current: Partial<SearchLabel> | null = null;

  await new HTMLRewriter()
    .on(".tagRow", {
      element() {
        current = { url: "", name: "", description: null };
        labels.push(current as SearchLabel);
      },
    })
    .on(".tagRow a[href*='/label/']", {
      element(el) {
        if (current && !current.url) {
          const href = el.getAttribute("href");
          if (href) current.url = BASE + href;
        }
      },
      text(t) { if (current) current.name += t.text; },
    })
    .on(".tagRow .ui-autocomplete-descriptor", {
      text(t) { if (current) current.description = (current.description ?? "") + t.text; },
    })
    .transform(res)
    .arrayBuffer();

  return labels.map((l) => ({
    url: l.url ?? "",
    name: (l.name ?? "").trim(),
    description: l.description ? l.description.trim() : null,
  }));
}
