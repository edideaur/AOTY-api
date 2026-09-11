import { BASE, FETCH_OPTS, REQ_HEADERS, cleanImageUrl, decodeEntities, parseCount, parseScore, parseId, parseYear, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type {
  ArtistsOverviewSection,
  ChartItem,
  CriticDetail,
  GenreAutocompleteItem,
  GenreDetail,
  GenreIndexItem,
  GenreReleasesByYear,
  GenreSection,
  LabelDetail,
  ListEntry,
  NamedLink,
  PageTab,
  PerfectSection,
  PublicationDetail,
  PublicationReview,
  SearchArtist,
  TagResults,
} from "../types.js";
import { scrapeAlbumBlocks, mustHearScopeFromClass } from "./albumBlock.js";
import { scrapeRatingsChart } from "./charts.js";
import { scrapeNewsPage } from "./news.js";

export async function scrapeLabelPage(pageUrl: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<LabelDetail> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Label fetch failed: ${res.status}`);
  const html = await res.text();

  const s = {
    name: "",
    image: null as string | null,
    website: null as string | null,
    parentLabel: null as NamedLink | null,
    description: null as string | null,
  };
  await new HTMLRewriter()
    .on("h1.headline", {
      text(t) {
        s.name += t.text;
      },
    })
    .on(".publicationHeader img, .logo img", {
      element(el) {
        if (!s.image) s.image = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".publicationHeader a[href], .logo a[href], .labelInfo a[href*='http']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (!s.website && !href.includes("albumoftheyear.org")) {
          if (href.startsWith("http")) s.website = href;
          else if (href.startsWith("//")) s.website = `https:${href}`;
        }
      },
    })
    .on(".labelDescription, .description", {
      text(t) {
        s.description = (s.description ?? "") + t.text;
      },
    })
    .on(".labelInfo a[href*='/label/'], .parentLabel a[href*='/label/']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href && !s.parentLabel) {
          s.parentLabel = { name: "", url: href.startsWith("http") ? href : BASE + href };
        }
      },
      text(t) {
        if (s.parentLabel) s.parentLabel.name += t.text;
      },
    })
    .transform(new Response(html))
    .arrayBuffer();

  // Header detail rows: genres, also-known-as, country flag.
  const genres: string[] = [];
  const alsoKnownAs: string[] = [];
  for (const m of html.matchAll(/<div class="detailRow">([\s\S]*?)<\/div>/g)) {
    const row = m[1] ?? "";
    const plain = decodeEntities(row.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (/\/\s*genres$/i.test(plain)) {
      const names = plain.replace(/\/\s*genres$/i, "").split(",").map((x) => x.trim()).filter(Boolean);
      genres.push(...names);
    } else if (/\/\s*also known as$/i.test(plain)) {
      const names = plain.replace(/\/\s*also known as$/i, "").split(",").map((x) => x.trim()).filter(Boolean);
      alsoKnownAs.push(...names);
    }
  }
  const flagM = html.match(/<img class="flag"[^>]*src="[^"]*\/flags\/([a-z]{2})\.webp"[^>]*>\s*([^<]+)/i);
  const countryCode = flagM?.[1] ?? null;
  const country = flagM?.[2] ? decodeEntities(flagM[2].trim()) : null;

  let totalPages: number | null = null;
  for (const m of html.matchAll(/<a href="[^"]*\/label\/[^"]*\/(\d+)\/"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }

  // Sort + release type are encoded in the page URL (?sort=, /singles/).
  let sort: string | null = null;
  let releaseType = "albums";
  try {
    const urlObj = new URL(pageUrl);
    sort = urlObj.searchParams.get("sort");
    if (urlObj.pathname.includes("/singles/")) releaseType = "singles";
  } catch { /* keep defaults for non-absolute URLs */ }

  return {
    url: pageUrl,
    name: decodeEntities(s.name.trim()),
    image: cleanImageUrl(s.image),
    website: s.website,
    parentLabel: s.parentLabel
      ? { name: decodeEntities(s.parentLabel.name.trim()), url: s.parentLabel.url }
      : null,
    description: s.description ? decodeEntities(s.description.trim()) : null,
    genres: [...new Set(genres)],
    alsoKnownAs: [...new Set(alsoKnownAs)],
    country,
    countryCode,
    page,
    totalPages,
    sort,
    releaseType,
    albums: await scrapeAlbumBlocks(new Response(html)),
  };
}

export async function scrapeGenresIndex(opts: FetchOpts = FETCH_OPTS): Promise<GenreIndexItem[]> {
  const res = await fetch(`${BASE}/genre.php`, opts);
  if (!res.ok) throw new Error(`Genres fetch failed: ${res.status}`);
  type RawBlock = { url: string; artist: string; artistUrl: string; title: string; cover: string; mediaType: string; releaseDate: string; criticScore: string | null; criticCount: string | null; userScore: string | null; userCount: string | null; mustHear: boolean; mustHearScope: "both" | "user" | "critic" | null; locked: boolean };
  const items: Array<{ name: string; url: string; albums: RawBlock[] }> = [];
  let cur: { name: string; url: string; albums: RawBlock[] } | null = null;
  let curBlock: RawBlock | null = null;
  let ratingValue = "";
  let lastRatingType: "critic" | "user" | null = null;
  await new HTMLRewriter()
    .on("h2", {
      element() {
        cur = { name: "", url: "", albums: [] };
        items.push(cur);
        curBlock = null;
      },
    })
    .on("h2 a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (cur && !cur.url && href.includes("/genre/")) cur.url = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (cur) cur.name += t.text;
      },
    })
    .on(".albumBlock", {
      element(el) {
        curBlock = { url: "", artist: "", artistUrl: "", title: "", cover: "", mediaType: el.getAttribute("data-type") ?? "", releaseDate: "", criticScore: null, criticCount: null, userScore: null, userCount: null, mustHear: false, mustHearScope: null, locked: false };
        if (cur) cur.albums.push(curBlock);
        lastRatingType = null;
        ratingValue = "";
      },
    })
    .on(".albumBlock .image a", {
      element(el) {
        if (curBlock && !curBlock.url) {
          const href = el.getAttribute("href");
          if (href) curBlock.url = BASE + href;
        }
      },
    })
    .on(".albumBlock .image img", {
      element(el) {
        if (curBlock) curBlock.cover = cleanImageUrl(el.getAttribute("src") || el.getAttribute("data-src") || "");
      },
    })
    .on(".albumBlock .image .mustHear", {
      element() {
        if (curBlock) {
          curBlock.mustHear = true;
          if (curBlock.mustHearScope === null) curBlock.mustHearScope = "critic";
        }
      },
    })
    .on(".albumBlock .noCover", {
      element() {
        if (curBlock) curBlock.locked = true;
      },
    })
    .on(".albumBlock .image", {
      element(el) {
        if (!curBlock) return;
        const scope = mustHearScopeFromClass(el.getAttribute("class"));
        if (scope) {
          curBlock.mustHear = true;
          curBlock.mustHearScope = scope;
        }
      },
    })
    .on(".albumBlock .artistTitle", {
      text(t) {
        if (curBlock) curBlock.artist = (curBlock.artist ?? "") + t.text;
      },
    })
    .on(".albumBlock a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (curBlock && !curBlock.artistUrl && href.includes("/artist/")) {
          curBlock.artistUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
    })
    .on(".albumBlock .albumTitle", {
      text(t) {
        if (curBlock) curBlock.title = (curBlock.title ?? "") + t.text;
      },
    })
    .on(".albumBlock .type", {
      text(t) {
        if (curBlock) curBlock.releaseDate = (curBlock.releaseDate ?? "") + t.text;
      },
    })
    .on(".albumBlock .ratingRow", {
      element() {
        ratingValue = "";
      },
    })
    .on(".albumBlock .ratingBlock .rating", {
      text(t) {
        ratingValue += t.text;
      },
    })
    .on(".albumBlock .ratingText", {
      text(t) {
        const text = t.text.trim().toLowerCase();
        if (text === "critic score") {
          if (curBlock) curBlock.criticScore = ratingValue.trim() || null;
          lastRatingType = "critic";
        } else if (text === "user score") {
          if (curBlock) curBlock.userScore = ratingValue.trim() || null;
          lastRatingType = "user";
        } else if (text.startsWith("(") && lastRatingType) {
          const count = text.replace(/[()]/g, "").trim();
          if (lastRatingType === "critic" && curBlock) curBlock.criticCount = count || null;
          else if (lastRatingType === "user" && curBlock) curBlock.userCount = count || null;
          lastRatingType = null;
        }
      },
    })
    .transform(res)
    .arrayBuffer();

  return items
    .filter((g) => g.name.trim() && g.url)
    .map((g) => ({
      name: decodeEntities(g.name.trim()),
      url: g.url,
      albums: g.albums.map((a) => ({
        url: a.url,
        artist: decodeEntities(a.artist.trim()),
        artistUrl: a.artistUrl,
        artistImage: null,
        title: decodeEntities(a.title.trim()),
        cover: cleanImageUrl(a.cover),
        mediaType: a.mediaType,
        releaseDate: a.releaseDate.trim(),
        criticScore: parseScore(a.criticScore),
        criticCount: parseCount(a.criticCount),
        userScore: parseScore(a.userScore),
        userCount: parseCount(a.userCount),
        mustHear: a.mustHear,
        mustHearScope: a.mustHearScope ?? null,
        locked: a.locked ?? false,
      })),
    }));
}

export async function scrapeGenrePage(pageUrl: string, slug: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<GenreDetail> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Genre fetch failed: ${res.status}`);
  type RawBlock = { url: string; artist: string; artistUrl: string; title: string; cover: string; mediaType: string; releaseDate: string; criticScore: string | null; criticCount: string | null; userScore: string | null; userCount: string | null; mustHear: boolean; mustHearScope: "both" | "user" | "critic" | null; locked: boolean };
  const s = {
    name: "",
    sections: [] as Array<{ title: string; url: string | null; albums: RawBlock[]; artists: Array<{ url: string; name: string; image: string | null }> }>,
    section: null as { title: string; url: string | null; albums: RawBlock[]; artists: Array<{ url: string; name: string; image: string | null }> } | null,
    cur: null as RawBlock | null,
    artist: null as { url: string; name: string; image: string | null } | null,
    ratingValue: "",
    lastRatingType: null as "critic" | "user" | null,
  };
  await new HTMLRewriter()
    .on("h1", {
      text(t) {
        s.name += t.text;
      },
    })
    .on("h2", {
      element(el) {
        void el;
        s.section = { title: "", url: null, albums: [], artists: [] };
        s.sections.push(s.section);
      },
      text(t) {
        if (s.section) s.section.title += t.text;
      },
    })
    .on("h2 a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.section && !s.section.url && href) s.section.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".albumBlock", {
      element(el) {
        if (!s.section) {
          s.section = { title: "", url: null, albums: [], artists: [] };
          s.sections.push(s.section);
        }
        s.cur = { url: "", artist: "", artistUrl: "", title: "", cover: "", mediaType: el.getAttribute("data-type") ?? "", releaseDate: "", criticScore: null, criticCount: null, userScore: null, userCount: null, mustHear: false, mustHearScope: null, locked: false };
        s.section.albums.push(s.cur);
        s.lastRatingType = null;
        s.ratingValue = "";
      },
    })
    .on(".albumBlock .image a", {
      element(el) {
        if (s.cur && !s.cur.url) {
          const href = el.getAttribute("href");
          if (href) s.cur.url = BASE + href;
        }
      },
    })
    .on(".albumBlock .image img", {
      element(el) {
        if (s.cur) s.cur.cover = cleanImageUrl(el.getAttribute("src") || el.getAttribute("data-src") || "");
      },
    })
    .on(".albumBlock .image .mustHear", {
      element() {
        if (s.cur) {
          s.cur.mustHear = true;
          if (s.cur.mustHearScope === null) s.cur.mustHearScope = "critic";
        }
      },
    })
    .on(".albumBlock .noCover", {
      element() {
        if (s.cur) s.cur.locked = true;
      },
    })
    .on(".albumBlock .image", {
      element(el) {
        if (!s.cur) return;
        const scope = mustHearScopeFromClass(el.getAttribute("class"));
        if (scope) {
          s.cur.mustHear = true;
          s.cur.mustHearScope = scope;
        }
      },
    })
    .on(".albumBlock .artistTitle", {
      text(t) {
        if (s.cur) s.cur.artist = (s.cur.artist ?? "") + t.text;
      },
    })
    .on(".albumBlock a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.cur && !s.cur.artistUrl && href.includes("/artist/")) {
          s.cur.artistUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
    })
    .on(".albumBlock .albumTitle", {
      text(t) {
        if (s.cur) s.cur.title = (s.cur.title ?? "") + t.text;
      },
    })
    .on(".albumBlock .type", {
      text(t) {
        if (s.cur) s.cur.releaseDate = (s.cur.releaseDate ?? "") + t.text;
      },
    })
    .on(".albumBlock .ratingRow", {
      element() {
        s.ratingValue = "";
      },
    })
    .on(".albumBlock .ratingBlock .rating", {
      text(t) {
        s.ratingValue += t.text;
      },
    })
    .on(".albumBlock .ratingText", {
      text(t) {
        const text = t.text.trim().toLowerCase();
        if (text === "critic score") {
          if (s.cur) s.cur.criticScore = s.ratingValue.trim() || null;
          s.lastRatingType = "critic";
        } else if (text === "user score") {
          if (s.cur) s.cur.userScore = s.ratingValue.trim() || null;
          s.lastRatingType = "user";
        } else if (text.startsWith("(") && s.lastRatingType) {
          const count = text.replace(/[()]/g, "").trim();
          if (s.lastRatingType === "critic" && s.cur) s.cur.criticCount = count || null;
          else if (s.lastRatingType === "user" && s.cur) s.cur.userCount = count || null;
          s.lastRatingType = null;
        }
      },
    })
    .on(".artistBlock", {
      element() {
        if (!s.section) {
          s.section = { title: "", url: null, albums: [], artists: [] };
          s.sections.push(s.section);
        }
        s.artist = { url: "", name: "", image: null };
        s.section.artists.push(s.artist);
      },
    })
    .on(".artistBlock a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.artist && !s.artist.url && href.includes("/artist/"))
          s.artist.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".artistBlock img", {
      element(el) {
        if (s.artist) s.artist.image = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".artistBlock .name", {
      text(t) {
        if (s.artist) s.artist.name = (s.artist.name ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  const sections: GenreSection[] = s.sections
    .map((sec) => ({
      title: decodeEntities(sec.title.replace(/View More/g, "").replace(/View All/g, "").trim()),
      url: sec.url,
      albums: sec.albums.map((a) => ({
        url: a.url,
        artist: decodeEntities(a.artist.trim()),
        artistUrl: a.artistUrl,
        artistImage: null,
        title: decodeEntities(a.title.trim()),
        cover: cleanImageUrl(a.cover),
        mediaType: a.mediaType,
        releaseDate: a.releaseDate.trim(),
        criticScore: parseScore(a.criticScore),
        criticCount: parseCount(a.criticCount),
        userScore: parseScore(a.userScore),
        userCount: parseCount(a.userCount),
        mustHear: a.mustHear,
        mustHearScope: a.mustHearScope ?? null,
        locked: a.locked ?? false,
      })),
      artists: sec.artists.map((a) => ({ url: a.url ?? "", name: decodeEntities((a.name ?? "").trim()), image: cleanImageUrl(a.image ?? null) })),
    }))
    .filter((sec) => sec.albums.length > 0 || sec.artists.length > 0);

  // Year / all-time genre pages use chart rows instead of album blocks.
  let items: ChartItem[] = [];
  if (sections.length === 0) {
    const aotyPath = pageUrl.replace(BASE, "");
    try {
      items = await scrapeRatingsChart(aotyPath, opts);
    } catch {
      items = [];
    }
  }

  // Child genres live in the two-column link cloud near the bottom.
  const res2 = await fetch(pageUrl, opts);
  const html2 = await res2.text();
  const childGenres: NamedLink[] = [];
  const cloudParts = html2.split("Child Genres");
  const cloudM = cloudParts[1];
  if (cloudM) {
    const cloud = cloudM.split("</div></div>")[0];
    if (cloud) {
      for (const m of cloud.matchAll(/<a href="(\/genre\/[^"]+)">([^<]+)<\/a>/g)) {
        if (m[1] && m[2]) {
          childGenres.push({ name: decodeEntities(m[2].trim()), url: BASE + m[1] });
        }
      }
    }
  }

  // "By Year" release distribution sidebar (same already-fetched HTML).
  const releasesByYear: GenreReleasesByYear[] = [];
  let totalReleases: number | null = null;
  const byYearIdx = html2.indexOf("By Year");
  if (byYearIdx !== -1) {
    const nextBox = html2.indexOf("rightBox", byYearIdx + 7);
    const chunk = html2.slice(byYearIdx, nextBox !== -1 ? nextBox : byYearIdx + 20000);
    for (const m of chunk.matchAll(/<tr class="distRow">([\s\S]*?)<\/tr>/g)) {
      const row = m[1] ?? "";
      const yM = row.match(/<td class="distLabel">[\s\S]*?<a href="([^"]+)">([^<]+)<\/a>/);
      const countCell = row.match(/<td class="distCount">([\s\S]*?)<\/td>/)?.[1] ?? "";
      const cM = countCell.replace(/<[^>]+>/g, "").match(/([\d,]+)/);
      const year = yM?.[2] ? parseInt(yM[2].trim(), 10) : NaN;
      if (yM?.[1] && Number.isFinite(year)) {
        releasesByYear.push({
          year,
          count: cM?.[1] ? parseInt(cM[1].replace(/,/g, ""), 10) || 0 : 0,
          url: yM[1].startsWith("http") ? yM[1] : BASE + yM[1],
        });
      }
    }
    const totalM = chunk.match(/class="distEnd"[^>]*>[\s\S]*?([\d,]+)\s*releases/i);
    totalReleases = totalM?.[1] ? parseInt(totalM[1].replace(/,/g, ""), 10) : null;
  }

  // Tab navigation (Overview / Best Albums / New Releases / This Year / Top Artists).
  const tabs: PageTab[] = [];
  const selectIdx = html2.indexOf("selectRow");
  if (selectIdx !== -1) {
    const selectChunk = html2.slice(selectIdx, selectIdx + 3000);
    for (const m of selectChunk.matchAll(/(?:<a href="([^"]+)">)?\s*<div class="selectBox([^"]*)">([^<]*)<\/div>/g)) {
      const label = decodeEntities((m[3] ?? "").trim());
      if (!label) continue;
      const href = m[1] ?? null;
      tabs.push({
        label,
        url: href ? (href.startsWith("http") ? href : BASE + href) : null,
        selected: (m[2] ?? "").includes("selected"),
      });
      if (tabs.length >= 10) break;
    }
  }
  return { url: pageUrl, slug, name: decodeEntities(s.name.trim()), page, sections, items, childGenres, releasesByYear, totalReleases, tabs };
}

const TAG_SORTS = new Set(["popularity", "newest-first", "critic-score", "user-score"]);

export function isTagSort(value: string | null): boolean {
  return value !== null && TAG_SORTS.has(value);
}

export async function scrapeTagPage(tag: string, type: string, year: string | number | null, opts: FetchOpts = FETCH_OPTS, page = 1, sort: string | null = null): Promise<TagResults> {
  const slug = encodeURIComponent(tag).replace(/%20/g, "+");
  const yearNum = year === null || year === undefined || year === "" ? null : (parseYear(year) ?? parseId(year));
  const sortQs = sort && sort !== "popularity" ? `?s=${encodeURIComponent(sort)}` : "";
  if (type === "media") {
    const mediaUrl = page > 1 ? `${BASE}/tag/${slug}/media/${page}/${sortQs}` : `${BASE}/tag/${slug}/media/${sortQs}`;
    return { tag, type, year: yearNum, page, headline: null, usedBy: null, useCount: null, tabs: [], sort, hasNextPage: false, totalPages: null, popularTags: [], albums: [], artists: [], media: await scrapeNewsPage(mediaUrl, opts) };
  }
  if (type === "artists") {
    const artistsUrl = page > 1 ? `${BASE}/tag/${slug}/artists/${page}/${sortQs}` : `${BASE}/tag/${slug}/artists/${sortQs}`;
    const res = await fetch(artistsUrl, opts);
    if (!res.ok) throw new Error(`Tag fetch failed: ${res.status}`);
    const html = await res.text();
    return { tag, type, year: yearNum, page, albums: [], artists: parseTagArtists(html), media: [], sort, ...tagMeta(html) };
  }
  let path = page > 1 ? `/tag/${slug}/albums/${page}/` : `/tag/${slug}/albums/`;
  if (year) path = page > 1 ? `/tag/${slug}/albums/year/${year}/${page}/` : `/tag/${slug}/albums/year/${year}/`;
  if (type === "singles") path = page > 1 ? `/tag/${slug}/singles/${page}/` : `/tag/${slug}/singles/`;
  const res = await fetch(`${BASE}${path}${sortQs}`, opts);
  if (!res.ok) throw new Error(`Tag fetch failed: ${res.status}`);
  const html = await res.text();
  return { tag, type, year: yearNum, page, albums: await scrapeAlbumBlocks(new Response(html)), artists: [], media: [], sort, ...tagMeta(html) };
}

/** Artist cards on tag artist tabs. */
function parseTagArtists(html: string): SearchArtist[] {
  const artists: SearchArtist[] = [];
  for (const m of html.matchAll(/<div class="artistBlock[^"]*">([\s\S]*?)(?=<div class="artistBlock|<div class="pageSelectRow|$)/g)) {
    const b = m[1] ?? "";
    const linkM = b.match(/<a href="([^"]*\/artist\/[^"]*)"/);
    const imgM = b.match(/<img[^>]*src="([^"]+)"/);
    const nameM = b.match(/<div class="name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>|<div class="name"[^>]*>([^<]+)<\/div>/);
    if (!linkM?.[1]) continue;
    artists.push({
      url: linkM[1].startsWith("http") ? linkM[1] : BASE + linkM[1],
      name: decodeEntities(((nameM?.[1] ?? nameM?.[2] ?? "")).trim()),
      image: cleanImageUrl(imgM?.[1] ?? null),
    });
  }
  return artists.filter((a) => a.url && a.name);
}

/** Headline, usage stats, tabs, pagination and popular tags shared by tag tabs. */
function tagMeta(html: string): Pick<TagResults, "headline" | "usedBy" | "useCount" | "tabs" | "hasNextPage" | "totalPages" | "popularTags"> {
  const headM = html.match(/<h1 class="headline">([\s\S]*?)<\/h1>/i);
  const useM = html.match(/Used by\s*([\d,]+)\s*people\s*([\d,]+)\s*times/i);
  const tabs: PageTab[] = [];
  const selectIdx = html.indexOf("selectRow");
  if (selectIdx !== -1) {
    const chunk = html.slice(selectIdx, selectIdx + 2000);
    for (const m of chunk.matchAll(/(?:<a href="([^"]+)">)?\s*<div class="selectBox([^"]*)">([^<]*)<\/div>/g)) {
      const label = decodeEntities((m[3] ?? "").trim());
      if (!label) continue;
      const href = m[1] ?? null;
      tabs.push({
        label,
        url: href ? (href.startsWith("http") ? href : BASE + href) : null,
        selected: (m[2] ?? "").includes("selected"),
      });
      if (tabs.length >= 6) break;
    }
  }
  let totalPages: number | null = null;
  for (const m of html.matchAll(/<a href="[^"]*\/tag\/[^"]*\/(\d+)\/"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  const hasNextPage = /<div class="pageSelect next">Next<\/div>/i.test(html);
  // "Popular Artist Tags" / "Popular Tags" rail at the bottom.
  const popularTags: NamedLink[] = [];
  const popIdx = html.search(/Popular .*Tags/);
  if (popIdx !== -1) {
    const chunk = html.slice(popIdx, popIdx + 12000);
    for (const m of chunk.matchAll(/<div class="tag"[^>]*>\s*<a href="([^"]+)">([^<]*)<\/a>/g)) {
      const href = m[1] ?? "";
      const name = m[2] ?? "";
      if (href.includes("/tag/") && name.trim()) {
        popularTags.push({
          name: decodeEntities(name.trim()),
          url: href.startsWith("http") ? href : BASE + href,
        });
      }
    }
  }
  return {
    headline: headM?.[1] ? decodeEntities(headM[1].replace(/<[^>]+>/g, "").trim()) : null,
    usedBy: useM?.[1] ? parseInt(useM[1].replace(/,/g, ""), 10) : null,
    useCount: useM?.[2] ? parseInt(useM[2].replace(/,/g, ""), 10) : null,
    tabs,
    hasNextPage,
    totalPages,
    popularTags,
  };
}

function scrapePublicationReviewsFromHtml(html: string): PublicationReview[] {
  // Fallback regex parser used when HTMLRewriter pass needs a second source.
  const reviews: PublicationReview[] = [];
  const blocks = html.split('<div class="albumBlock');
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b) continue;
    const albumM = b.match(/<a href="(\/album\/[^"]+)"[^>]*>[\s\S]{0,300}?<div class="albumTitle">([^<]*)<\/div>/);
    const artistM = b.match(/<div class="artistTitle">([^<]*)<\/div>/);
    const imgM = b.match(/<img src="([^"]+)"/);
    const scoreM = b.match(/<div class="rating">([^<]*)<\/div>/);
    const extM = b.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*Full Review/);
    if (!albumM?.[1]) continue;
    reviews.push({
      artist: decodeEntities((artistM?.[1] ?? "").trim()),
      artistUrl: "",
      artistImage: null,
      album: decodeEntities((albumM[2] ?? "").trim()),
      albumUrl: BASE + albumM[1],
      cover: cleanImageUrl(imgM?.[1] ?? null),
      score: parseScore((scoreM?.[1] ?? "").trim()),
      reviewUrl: extM?.[1] ?? "",
    });
  }
  return reviews;
}

export async function scrapePublicationPage(pageUrl: string, slug: string, opts: FetchOpts = FETCH_OPTS): Promise<PublicationDetail> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Publication fetch failed: ${res.status}`);
  const s = {
    name: "",
    image: null as string | null,
    website: null as string | null,
    albumsRated: "",
    averageRating: "",
    dist: [] as { range: string; count: number }[],
    distRange: "",
    distCount: "",
    distStep: 0,
    recentReviews: [] as PublicationReview[],
    topAlbums: [] as PublicationReview[],
    rev: null as Partial<PublicationReview> | null,
    revTarget: null as "recent" | "top" | null,
    sectionIndex: 0,
    artistBuf: "",
  };
  await new HTMLRewriter()
    .on("h1", {
      text(t) {
        s.name += t.text;
      },
    })
    .on(".publicationHeader img, .logo img", {
      element(el) {
        if (!s.image) s.image = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".publicationHeader a[href*='http'], .logo a[href*='http']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href.startsWith("http") && !s.website) s.website = href;
      },
    })
    .on(".pubSubHeadline a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href && !s.website) s.website = href.startsWith("//") ? `https:${href}` : href;
      },
    })
    .transform(res.clone())
    .arrayBuffer();

  const html = await res.text();
  const infoM = html.match(/Albums Rated:<\/span>\s*([\d,]+)/);
  const avgM = html.match(/Average Rating:<\/span>\s*([\d.]+)/);
  s.albumsRated = infoM?.[1] ?? "";
  s.averageRating = avgM?.[1] ?? "";

  // Rating distribution: <td class="distLabel">range</td><td class="distCount">count</td>
  for (const m of html.matchAll(/<td class="distLabel">([^<]*)<\/td>\s*<td class="distCount">([^<]*)<\/td>/g)) {
    const m1 = m[1];
    const m2 = m[2];
    if (m1 !== undefined && m2 !== undefined) {
      const count = parseInt(m2.replace(/,/g, ""), 10);
      if (!Number.isNaN(count)) s.dist.push({ range: m1.trim(), count });
    }
  }

  // Recent + top reviews: albumBlock runs separated by "Highest Rated" headings.
  // The top run itself holds two sections (current-year, then all-time).
  const [beforeHighest, ...restHighest] = html.split(/Highest Rated Albums/);
  const afterHighest = restHighest.join("Highest Rated Albums");
  s.recentReviews = scrapePublicationReviewsFromHtml(beforeHighest ?? "");
  // attach artist urls + review urls via second regex on same chunk
  s.topAlbums = scrapePublicationReviewsFromHtml(afterHighest ?? "");
  const [after2026, afterAllTime] = (afterHighest ?? "").split(/Highest Rated Albums of All ?time/i);
  const highest2026 = scrapePublicationReviewsFromHtml(after2026 ?? "");
  const highestAllTime = scrapePublicationReviewsFromHtml(afterAllTime ?? "");

  // Artist URLs: match artist link preceding each album link
  const enrich = (chunk: string, out: PublicationReview[]) => {
    const pairs = [...chunk.matchAll(/<a href="(\/artist\/[^"]+)">[\s\S]{0,200}?<div class="artistTitle">([\s\S]*?)<\/div>/g)];
    out.forEach((r, i) => {
      const p = pairs[i];
      if (p?.[1]) {
        r.artistUrl = BASE + p[1];
        if (!r.artist && p[2]) r.artist = decodeEntities(p[2].replace(/<[^>]+>/g, "").trim());
      }
    });
  };
  enrich(beforeHighest ?? "", s.recentReviews);
  enrich(afterHighest ?? "", s.topAlbums);
  enrich(after2026 ?? "", highest2026);
  enrich(afterAllTime ?? "", highestAllTime);

  // Tab navigation (Overview / Best Albums / Reviews / Lists / Perfect Scores).
  const tabs: PageTab[] = [];
  const selectIdx = html.indexOf("selectRow");
  if (selectIdx !== -1) {
    const chunk = html.slice(selectIdx, selectIdx + 3000);
    for (const m of chunk.matchAll(/(?:<a href="([^"]+)">)?\s*<div class="selectBox([^"]*)">([^<]*)<\/div>/g)) {
      const label = decodeEntities((m[3] ?? "").trim());
      if (!label) continue;
      const href = m[1] ?? null;
      tabs.push({
        label,
        url: href ? (href.startsWith("http") ? href : BASE + href) : null,
        selected: (m[2] ?? "").includes("selected"),
      });
      if (tabs.length >= 10) break;
    }
  }

  return {
    url: pageUrl,
    slug,
    name: decodeEntities(s.name.trim()),
    image: cleanImageUrl(s.image),
    website: s.website,
    albumsRated: parseCount(s.albumsRated),
    averageRating: parseScore(s.averageRating),
    ratingDistribution: s.dist,
    recentReviews: s.recentReviews,
    topAlbums: s.topAlbums,
    highest2026,
    highestAllTime,
    tabs,
  };
}

export async function scrapePublicationPerfect(slug: string, opts: FetchOpts = FETCH_OPTS): Promise<{ slug: string; sections: PerfectSection[] }> {
  const res = await fetch(`${BASE}/publication/${slug}/perfect/`, opts);
  if (!res.ok) throw new Error(`Publication perfect scores fetch failed: ${res.status}`);
  type RawRev = { album: string; albumUrl: string; artist: string; artistUrl: string; cover: string | null; score: string; reviewUrl: string };
  const sections: Array<{ title: string; reviews: RawRev[] }> = [];
  let section: { title: string; reviews: RawRev[] } | null = null;
  let rev: RawRev | null = null;
  await new HTMLRewriter()
    .on(".sectionHeading", {
      element() {
        section = { title: "", reviews: [] };
        sections.push(section);
      },
      text(t) {
        if (section && !section.reviews.length) section.title += t.text;
      },
    })
    .on(".albumBlock", {
      element() {
        if (!section) {
          section = { title: "", reviews: [] };
          sections.push(section);
        }
        rev = { album: "", albumUrl: "", artist: "", artistUrl: "", cover: null, score: "", reviewUrl: "" };
        section.reviews.push(rev);
      },
    })
    .on(".albumBlock .image a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (rev && !rev.albumUrl && href.includes("/album/")) rev.albumUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".albumBlock .image img", {
      element(el) {
        if (rev) rev.cover = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".albumBlock .artistTitle", {
      element(el) {
        void el;
      },
      text(t) {
        if (rev) rev.artist = (rev.artist ?? "") + t.text;
      },
    })
    .on(".albumBlock a[href*='/artist/']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (rev && !rev.artistUrl) rev.artistUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".albumBlock .albumTitle", {
      text(t) {
        if (rev) rev.album = (rev.album ?? "") + t.text;
      },
    })
    .on(".albumBlock .rating", {
      text(t) {
        if (rev) rev.score = (rev.score ?? "") + t.text;
      },
    })
    .on(".albumBlock .ratingText a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (rev && href.startsWith("http")) rev.reviewUrl = href;
      },
    })
    .transform(res)
    .arrayBuffer();
  return {
    slug,
    sections: sections
      .map((sec) => ({
        title: decodeEntities(sec.title.replace(/View More/g, "").trim()),
        reviews: sec.reviews
          .filter((r) => (r.album ?? "").trim())
          .map((r) => ({
            album: decodeEntities((r.album ?? "").trim()),
            albumUrl: r.albumUrl ?? "",
            artist: decodeEntities((r.artist ?? "").trim()),
            artistUrl: r.artistUrl ?? "",
            artistImage: null,
            cover: cleanImageUrl(r.cover ?? null),
            score: parseScore((r.score ?? "").trim()),
            reviewUrl: r.reviewUrl ?? "",
          })),
      }))
      .filter((sec) => sec.reviews.length > 0),
  };
}

export async function scrapeArtistsOverview(opts: FetchOpts = FETCH_OPTS): Promise<ArtistsOverviewSection[]> {
  const res = await fetch(`${BASE}/artists/`, opts);
  if (!res.ok) throw new Error(`Artists overview fetch failed: ${res.status}`);
  const sections: ArtistsOverviewSection[] = [];
  let section: ArtistsOverviewSection | null = null;
  let cur: SearchArtist | null = null;
  await new HTMLRewriter()
    .on("h2.sectionHeading", {
      element() {
        section = { title: "", url: null, artists: [] };
        sections.push(section);
      },
      text(t) {
        if (section) section.title += t.text;
      },
    })
    .on("h2.sectionHeading a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (section && !section.url && href) section.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".artistBlock", {
      element() {
        if (!section) {
          section = { title: "", url: null, artists: [] };
          sections.push(section);
        }
        cur = { url: "", name: "", image: null };
        section.artists.push(cur);
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
    .transform(res)
    .arrayBuffer();
  return sections
    .map((sec) => ({
      title: decodeEntities(sec.title.trim()),
      url: sec.url ?? null,
      artists: sec.artists
        .filter((a) => (a.name ?? "").trim() || (a.url ?? "").trim())
        .map((a) => ({ url: a.url ?? "", name: decodeEntities((a.name ?? "").trim()), image: cleanImageUrl(a.image ?? null) })),
    }))
    .filter((sec) => sec.artists.length > 0);
}

export async function scrapePublicationReviewsPage(pageUrl: string, opts: FetchOpts = FETCH_OPTS): Promise<PublicationReview[]> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Publication reviews fetch failed: ${res.status}`);
  const html = await res.text();
  return scrapePublicationReviewsFromHtml(html);
}

export async function scrapePublicationListsPage(pageUrl: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<ListEntry[]> {
  const url = page > 1 ? `${pageUrl.replace(/\/+$/, "")}/${page}/` : pageUrl;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Publication lists fetch failed: ${res.status}`);
  const entries: ListEntry[] = [];
  const alts: string[] = [];
  const st: { cur: ListEntry | null; heading: string } = { cur: null, heading: "" };
  await new HTMLRewriter()
    .on("h1", {
      text(t) {
        st.heading += t.text;
      },
    })
    .on(".criticListBlockContainer", {
      element() {
        st.cur = { url: "", title: "", publication: "", cover: null };
        entries.push(st.cur);
        alts.push("");
      },
    })
    .on(".criticListBlockContainer a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.url && href.includes("/list/")) st.cur.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".criticListBlockImage", {
      element(el) {
        if (st.cur) {
          st.cur.cover = cleanImageUrl(el.getAttribute("src") ?? null);
          // Image alt usually carries the full list title ("Pitchfork's 50 Best Albums of 2025")
          alts[alts.length - 1] = el.getAttribute("alt") ?? "";
        }
      },
    })
    .on(".criticListBlockTitle a", {
      text(t) {
        if (st.cur) st.cur.title = (st.cur.title ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  const pub = st.heading.replace(/'?s? Lists?$/i, "").trim() || "Unknown";
  const SMALL = new Set(["of", "the", "a", "an", "and", "in", "on", "to", "for"]);
  const deSlugify = (url: string): string | null => {
    const m = url.match(/\/list\/\d+-([^/]+)\/?$/);
    if (!m?.[1]) return null;
    const words = m[1].split(/[-_]+/).filter(Boolean);
    if (words.length < 2) return null;
    return words
      .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");
  };
  return entries.map((e, i) => {
    let title = (e.title ?? "").trim();
    const altText = alts[i]?.trim();
    // Year-end lists show only a year as link text — derive a fuller title from the URL slug.
    if (/^\d{4}s?$/.test(title)) title = deSlugify(e.url ?? "") ?? altText ?? title;
    else if (!title && altText) title = altText;
    return {
      url: e.url ?? "",
      title: decodeEntities(title),
      publication: decodeEntities(pub),
      cover: cleanImageUrl(e.cover ?? null),
    };
  });
}

export async function scrapeCriticPage(pageUrl: string, slug: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<CriticDetail> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Critic fetch failed: ${res.status}`);
  type RawCriticReview = { album: string; albumUrl: string; artist: string; artistUrl: string; cover: string | null; score: string; text: string; publication: string; publicationUrl: string; reviewUrl: string | null; date: string | null; dateExact: string | null };
  const s = {
    name: "",
    publication: "",
    publicationUrl: "",
    reviews: [] as RawCriticReview[],
    rev: null as RawCriticReview | null,
    revTextBuf: "",
  };
  const html = await res.clone().text();
  await new HTMLRewriter()
    .on("h1.headline", {
      text(t) {
        s.name += t.text;
      },
    })
    .on(".userReviewBlock .cover a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.rev && !s.rev.albumUrl && href.includes("/album/")) s.rev.albumUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".userReviewBlock", {
      element() {
        if (s.rev) s.rev.text = s.revTextBuf.trim();
        s.rev = { album: "", albumUrl: "", artist: "", artistUrl: "", cover: null, score: "", text: "", publication: "", publicationUrl: "", reviewUrl: null, date: null, dateExact: null };
        s.reviews.push(s.rev);
        s.revTextBuf = "";
      },
    })
    .on(".userReviewBlock .cover img", {
      element(el) {
        if (s.rev) s.rev.cover = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".userReviewBlock .artistTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.rev && href.includes("/artist/")) s.rev.artistUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (s.rev) s.rev.artist = (s.rev.artist ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .albumTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.rev && href.includes("/album/")) s.rev.albumUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (s.rev) s.rev.album = (s.rev.album ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .userName a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.rev && href.includes("/publication/")) s.rev.publicationUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (s.rev) s.rev.publication = (s.rev.publication ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .rating", {
      text(t) {
        if (s.rev) s.rev.score = (s.rev.score ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .date, .userReviewBlock .review_date", {
      element(el) {
        if (s.rev) {
          const attr = el.getAttribute("title");
          if (attr !== null) s.rev.date = attr;
        }
      },
      text(t) {
        if (s.rev && !s.rev.date) s.rev.date = (s.rev.date ?? "") + t.text;
      },
    })
    // Exact timestamp lives on the parent actionContainer; .date only has "11h"/"5d".
    .on(".userReviewBlock .actionContainer", {
      element(el) {
        if (s.rev && !s.rev.dateExact) {
          const attr = el.getAttribute("title");
          if (attr) s.rev.dateExact = attr;
        }
      },
    })
    // External review permalink (YouTube / publication URL).
    .on(".userReviewBlock .albumReviewLinks a", {
      element(el) {
        if (s.rev && !s.rev.reviewUrl) {
          const href = el.getAttribute("href") ?? "";
          if (href.startsWith("http")) s.rev.reviewUrl = href;
        }
      },
    })
    .on(".userReviewBlock .reviewText", {
      text(t) {
        s.revTextBuf += t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  if (s.rev) s.rev.text = s.revTextBuf.trim();
  const pubM = html.match(/<a href="(\/publication\/[^"]+)">([^<]+)<\/a>/);
  let totalPages: number | null = null;
  for (const m of html.matchAll(/<a href="[^"]*\/critic\/[^"]*\/(\d+)\/"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  return {
    url: pageUrl,
    slug,
    name: decodeEntities(s.name.trim()),
    publication: pubM?.[2] ? decodeEntities(pubM[2].trim()) : null,
    publicationUrl: pubM?.[1] ? BASE + pubM[1] : null,
    page,
    totalPages,
    reviews: s.reviews
      .filter((r) => (r.album ?? "").trim())
      .map((r) => {
        const rDate = r.date ?? null;
        const rDateExact = r.dateExact ?? null;
        return {
          album: decodeEntities((r.album ?? "").trim()),
          albumUrl: r.albumUrl ?? "",
          artist: decodeEntities((r.artist ?? "").trim()),
          artistUrl: r.artistUrl ?? "",
          artistImage: null,
          cover: cleanImageUrl(r.cover ?? null),
          score: parseScore((r.score ?? "").trim()),
          text: decodeEntities((r.text ?? "").trim()),
          publication: decodeEntities((r.publication ?? "").trim()),
          publicationUrl: r.publicationUrl ?? "",
          reviewUrl: r.reviewUrl ?? null,
          date: rDate,
          dateTimestamp: parseDateToTimestamp(rDate),
          dateExact: rDateExact,
          dateExactTimestamp: parseDateToTimestamp(rDateExact),
        };
      }),
  };
}

export async function scrapeSubGenres(
  genreId: string | number,
  breadIdsOrOpts?: (string | number)[] | FetchOpts | null,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ genreId: number; heading: string; subgenres: NamedLink[] }> {
  const isBreadIds = Array.isArray(breadIdsOrOpts);
  const breadIds = isBreadIds ? breadIdsOrOpts : null;
  const effectiveOpts = !isBreadIds && typeof breadIdsOrOpts === "object" && breadIdsOrOpts !== null ? breadIdsOrOpts : opts;

  const bodyParams = new URLSearchParams({ genreID: String(genreId) });
  if (breadIds && breadIds.length > 0) {
    bodyParams.set("breadIDs", JSON.stringify(breadIds.map(Number)));
  }

  const res = await fetch(`${BASE}/scripts/showSubGenres.php`, {
    ...effectiveOpts,
    method: "POST",
    headers: { ...REQ_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/genre.php` },
    body: bodyParams.toString(),
  });
  if (!res.ok) throw new Error(`Subgenres fetch failed: ${res.status}`);
  const html = await res.text();
  const headingM = html.match(/<div class="heading">[\s\S]*?<\/i>\s*([^<]+)<\/div>/);
  const heading = headingM?.[1] ? decodeEntities(headingM[1].trim()) : "";
  const subgenres: NamedLink[] = [];
  for (const m of html.matchAll(/<a href="(\/genre\/[^"]+)">([^<]+)<\/a>/g)) {
    if (m[1] && m[2]) {
      subgenres.push({
        name: decodeEntities(m[2].trim()),
        url: BASE + m[1],
      });
    }
  }
  return { genreId: parseId(genreId) ?? 0, heading, subgenres };
}

export async function scrapeGenreName(
  genreId: string | number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ id: number; name: string }> {
  const res = await fetch(`${BASE}/scripts/getGenreName.php?id=${encodeURIComponent(String(genreId))}`, opts);
  if (!res.ok) throw new Error(`Genre name fetch failed: ${res.status}`);
  const text = (await res.text()).trim();
  return { id: parseId(genreId) ?? 0, name: decodeEntities(text) };
}

export async function scrapeGenreAutocomplete(
  query: string,
  opts: FetchOpts = FETCH_OPTS,
): Promise<GenreAutocompleteItem[]> {
  const enc = encodeURIComponent(query);
  const res = await fetch(`${BASE}/scripts/albumGenreAutocomplete.php?term=${enc}`, {
    ...opts,
    headers: {
      ...REQ_HEADERS,
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE}/`,
    },
  });
  if (!res.ok) throw new Error(`Genre autocomplete fetch failed: ${res.status}`);
  const data = (await res.json()) as Array<Record<string, unknown>>;
  return data.map((item) => {
    const rawLink = String(item["link"] ?? "");
    const slugM = rawLink.match(/\/genre\/([^/]+)/);
    const slug = slugM?.[1] ?? rawLink.replace(/^\/+|\/+$/g, "");
    return {
      id: parseId(item["id"]),
      name: decodeEntities(String(item["value"] ?? "").trim()),
      slug,
      url: rawLink.startsWith("http") ? rawLink : `${BASE}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`,
    };
  });
}


