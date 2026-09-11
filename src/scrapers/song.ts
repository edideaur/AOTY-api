import { BASE, FETCH_OPTS, cleanImageUrl, decodeEntities, parseCount, parseScore, parseExactScore, parseId, parseRank, parseTrackNumber, parseYear, parsePercent, parseDurationToSeconds, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type {
  ArtistTopSong,
  AotyComment,
  ArtistLink,
  NamedLink,
  PageTab,
  SongCredit,
  SongDetail,
  SongRating,
  SongTracklistItem,
  SongsBestItem,
  SongsBestResult,
  TopSong,
} from "../types.js";
import { fetchArtistImage } from "./artist.js";

export async function scrapeSongPage(pageUrl: string, opts: FetchOpts = FETCH_OPTS): Promise<SongDetail> {
  const res = await fetch(pageUrl, opts);
  if (!res.ok) throw new Error(`Song fetch failed: ${res.status}`);
  const idM = pageUrl.match(/\/song\/(\d+)/);
  const s = {
    title: "",
    artist: "",
    artistUrl: "",
    cover: null as string | null,
    album: null as string | null,
    albumUrl: null as string | null,
    trackNumber: null as string | null,
    year: "",
    duration: "",
    userScore: "",
    userScoreExact: "",
    ratingCount: "",
    credits: [] as SongCredit[],
    creditRole: null as SongCredit | null,
    topRatings: [] as SongRating[],
    rating: null as { username: string; userUrl: string; avatar: string | null; rating: string; date: string | null } | null,
  };
  await new HTMLRewriter()
    .on("h1.songTitle", {
      text(t) {
        s.title += t.text;
      },
    })
    .on(".albumHeader.song .artist a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (!s.artistUrl && href.includes("/artist/")) s.artistUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        s.artist += t.text;
      },
    })
    .on(".albumHeaderCover img", {
      element(el) {
        if (!s.cover) s.cover = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".songScore", {
      element(el) {
        s.userScoreExact = el.getAttribute("title") ?? "";
      },
      text(t) {
        s.userScore += t.text;
      },
    })
    .on(".songScoreBox .text", {
      text(t) {
        s.ratingCount += t.text;
      },
    })
    .on(".songInfo .detailRow", {
      element() {
        s.creditRole = null;
      },
      text(t) {
        void t;
      },
    })
    .on(".songRatings .cell", {
      element(el) {
        void el;
      },
    })
    .transform(res.clone())
    .arrayBuffer();

  const html = await res.text();
  // Track/album/year/duration come from plain detailRows; parse them here.
  const rows = [...html.matchAll(/<div class="detailRow">(.*?)<\/div>/gs)]
    .map((m) => m[1])
    .filter((r): r is string => typeof r === "string");
  for (const row of rows) {
    const plain = row.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const trackM = plain.match(/Track #(\d+) on/i);
    const yearM = plain.match(/^(\d{4})\s*\/ Year/);
    const durM = plain.match(/^([\d:]+)\s*\/ duration/);
    if (trackM?.[1]) {
      s.trackNumber = trackM[1];
      const am = row.match(/<a href="([^"]+)">([^<]*)<\/a>/);
      if (am?.[1] && am[2] !== undefined) {
        s.album = decodeEntities(am[2].trim());
        s.albumUrl = am[1].startsWith("http") ? am[1] : BASE + am[1];
      }
    } else if (yearM?.[1]) {
      s.year = yearM[1];
    } else if (durM?.[1]) {
      s.duration = durM[1];
    }
  }
  // Role labels: rows like "<a..>X</a> / Feature" — fill roles missed by span pass
  {
    const creditRows = rows.filter((r) => r.includes("/artist/") && r.includes("<span>"));
    const parsed: SongCredit[] = [];
    for (const row of creditRows) {
      const roleM = row.match(/<span>\s*\/\s*([^<]+)<\/span>/);
      const role = roleM?.[1] ? decodeEntities(roleM[1].trim()) : "";
      const artists = [...row.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)].flatMap((m) => {
        const u = m[1];
        const n = m[2];
        if (!u || n === undefined) return [];
        return [{
          name: decodeEntities(n.trim()),
          url: u.startsWith("http") ? u : BASE + u,
          image: null,
        }];
      });
      if (artists.length) parsed.push({ role, artists });
    }
    if (parsed.length) s.credits = parsed;
  }
  // Top user ratings (first page of the song ratings)
  s.topRatings = await scrapeSongRatingRows(new Response(html));

  const ratingDistribution: Array<{ label: string; count: number }> = [];
  for (const row of html.matchAll(/<tr class="distRow">([\s\S]*?)<\/tr>/g)) {
    const rowHtml = row[1];
    if (!rowHtml) continue;
    const mLabel = rowHtml.match(/<td class="distLabel">([\s\S]*?)<\/td>/);
    const mCount = rowHtml.match(/<td class="distCount">([\s\S]*?)<\/td>/);
    const label = mLabel?.[1] ? decodeEntities(mLabel[1].replace(/<[^>]+>/g, "").trim()) : "";
    const countStr = mCount?.[1] ? mCount[1].replace(/<[^>]+>/g, "").replace(/,/g, "").trim() : "";
    if (label) {
      ratingDistribution.push({
        label,
        count: countStr ? parseInt(countStr, 10) || 0 : 0,
      });
    }
  }

  const likePctM = html.match(/<strong[^>]*>(\d+%)<\/strong>\s*of users like this song/i);
  const dislikePctM = html.match(/<strong[^>]*>(\d+%)<\/strong>\s*of users don't like this song/i);
  const likePercentage = likePctM?.[1] ?? null;
  const dislikePercentage = dislikePctM?.[1] ?? null;

  const tracklist: SongTracklistItem[] = [];
  const tracklistTableM = html.match(/class="trackListTable"[\s\S]*?<\/table>/i) ?? html.match(/Track List[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tracklistTableM) {
    for (const tr of tracklistTableM[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const row = tr[1];
      if (!row) continue;
      const numM = row.match(/class="[^"]*trackNumber[^"]*"[^>]*>([^<]+)<\/td>|<td[^>]*>(\d+)<\/td>/);
      const titleM = row.match(/<a href="([^"]*\/song\/[^"]*)">([^<]+)<\/a>/);
      const lenM = row.match(/class="[^"]*length[^"]*"[^>]*>([^<]+)<\/td>|<td[^>]*>(\d+:\d+)<\/td>/);
      const scoreM = row.match(/class="[^"]*trackRating[^"]*"[^>]*>([^<]+)<\/td>|<div class="trackRating[^"]*">([^<]+)<\/div>/);
      const countM = row.match(/title="([\d,]+) Ratings?"/i);
      if (titleM?.[1] && titleM[2]) {
        const tLen = (lenM?.[1] ?? lenM?.[2] ?? "").trim();
        tracklist.push({
          number: parseTrackNumber((numM?.[1] ?? numM?.[2] ?? "").trim()),
          title: decodeEntities(titleM[2].trim()),
          url: titleM[1].startsWith("http") ? titleM[1] : BASE + titleM[1],
          length: tLen,
          lengthSeconds: parseDurationToSeconds(tLen),
          score: parseScore((scoreM?.[1] ?? scoreM?.[2] ?? "").trim()),
          ratingCount: countM?.[1] ? parseInt(countM[1].replace(/,/g, ""), 10) : null,
        });
      }
    }
  }

  const totalLengthM = html.match(/<div class="totalLength">([^<]*)<\/div>/i);
  const tracklistTotalLength = totalLengthM?.[1]
    ? decodeEntities(totalLengthM[1].replace(/^Total Length:\s*/i, "").trim()) || null
    : null;

  // "Community's Top Songs" by the same artist (table after the best-songs heading).
  const artistTopSongs: ArtistTopSong[] = [];
  const bestSongsIdx = html.indexOf("/best-songs/");
  if (bestSongsIdx !== -1) {
    const tableM = html.slice(bestSongsIdx).match(/<table class="trackListTable">([\s\S]*?)<\/table>/i);
    const tableHtml = tableM?.[1] ?? tableM?.[0];
    if (tableHtml) {
      for (const tr of tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
        const row = tr[1];
        if (!row) continue;
        const coverM = row.match(/class="coverart"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);
        const songM = row.match(/class="songAlbum"[^>]*>[\s\S]*?<a href="([^"]*\/song\/[^"]*)">([^<]+)<\/a>/i);
        const albumM = row.match(/<div class="gray-font">([^<]*)<\/div>/i);
        const scoreTitleM = row.match(/class="trackRating[^"]*"[^>]*>[\s\S]*?<span[^>]*title="([\d,]+) Ratings?"[^>]*>([^<]*)<\/span>/i);
        const scorePlainM = scoreTitleM ? null : row.match(/class="trackRating[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/i);
        if (songM?.[1] && songM[2]) {
          const countRaw = scoreTitleM?.[1] ?? null;
          const scoreRaw = scoreTitleM?.[2] ?? scorePlainM?.[1] ?? "";
          artistTopSongs.push({
            title: decodeEntities(songM[2].trim()),
            url: songM[1].startsWith("http") ? songM[1] : BASE + songM[1],
            album: albumM?.[1] ? decodeEntities(albumM[1].trim()) || null : null,
            cover: coverM?.[1] ? cleanImageUrl(coverM[1]) : null,
            score: parseScore((scoreRaw ?? "").trim()),
            ratingCount: countRaw ? parseInt(countRaw.replace(/,/g, ""), 10) : null,
          });
        }
      }
    }
  }

  const tags: NamedLink[] = [];
  for (const m of html.matchAll(/<div class="tag[^"]*">\s*<a href="([^"]+)">([^<]*)<\/a>\s*<\/div>/g)) {
    const href = m[1];
    const text = m[2];
    if (!href || text === undefined) continue;
    tags.push({
      name: decodeEntities(text.trim()),
      url: href.startsWith("http") ? href : BASE + href,
    });
  }

  const comments: AotyComment[] = [];
  for (const m of html.matchAll(/<div class="commentRow" id="comment_(\d+)">([\s\S]*?)(?=<div class="commentRow" id="comment_|$)/g)) {
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
      avatar: avatarM?.[1] ? cleanImageUrl(avatarM[1]) : null,
      subscriber: /class="donor[\s"]/.test(c),
      date: dateM?.[2] ? dateM[2].trim() : "",
      dateExact: dateM?.[1] ? dateM[1].trim() : "",
      text: textM?.[1] ? decodeEntities(textM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "",
      replies: parseCount(repliesM?.[1]) ?? 0,
    });
  }

  const artistImage = await fetchArtistImage(s.artistUrl, opts);

    const songDur = s.duration || null;
    return {
      url: pageUrl,
      id: parseId(idM?.[1]),
      title: decodeEntities(s.title.trim()),
      artist: decodeEntities(s.artist.trim()),
      artistUrl: s.artistUrl,
      artistImage,
      cover: cleanImageUrl(s.cover),
      album: s.album,
      albumUrl: s.albumUrl,
      trackNumber: s.trackNumber ? parseTrackNumber(s.trackNumber) : null,
      year: s.year ? parseYear(s.year) : null,
      duration: songDur,
      durationSeconds: parseDurationToSeconds(songDur),
      userScore: parseScore(s.userScore.trim()),
      userScoreExact: parseExactScore(s.userScoreExact),
      ratingCount: parseCount(s.ratingCount),
      ratingDistribution,
      likePercentage: parsePercent(likePercentage),
      dislikePercentage: parsePercent(dislikePercentage),
      tracklist,
      tracklistTotalLength,
      tracklistTotalLengthSeconds: parseDurationToSeconds(tracklistTotalLength),
      artistTopSongs,
      tags,
      credits: s.credits.filter((c) => c.artists.length > 0),
      topRatings: s.topRatings,
      comments,
    };
}

async function scrapeSongRatingRows(res: Response): Promise<SongRating[]> {
  type RawSongRating = { username: string; displayName: string; userUrl: string; avatar: string | null; subscriber: boolean; rating: string; date: string | null };
  const ratings: RawSongRating[] = [];
  const st: { cur: RawSongRating | null } = { cur: null };
  await new HTMLRewriter()
    .on(".songRatings", {
      element() {
        st.cur = { username: "", displayName: "", userUrl: "", avatar: null, subscriber: false, rating: "", date: null };
        ratings.push(st.cur);
      },
    })
    .on(".songRatings .cell.profilePic a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.userUrl && href.includes("/user/"))
          st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".songRatings .cell.profilePic img", {
      element(el) {
        if (st.cur) st.cur.avatar = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".songRatings .cell.userName a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/user/")) {
          if (!st.cur.userUrl) st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
          const title = el.getAttribute("title");
          if (title && !(st.cur.username ?? "").trim()) st.cur.username = title;
        }
      },
      text(t) {
        if (st.cur && !(st.cur.username ?? "").trim()) st.cur.username = (st.cur.username ?? "") + t.text;
        if (st.cur) st.cur.displayName = (st.cur.displayName ?? "") + t.text;
      },
    })
    .on(".songRatings .cell.userName .donor", {
      element() {
        if (st.cur) st.cur.subscriber = true;
      },
    })
    .on(".songRatings .cell.userName .gray-font", {
      text(t) {
        if (st.cur) st.cur.date = ((st.cur.date ?? "") as string) + t.text;
      },
    })
    .on(".songRatings .cell.score", {
      text(t) {
        if (st.cur) st.cur.rating = ((st.cur.rating ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return ratings
    .filter((r) => (r.username ?? "").trim())
    .map((r) => {
      const username = decodeEntities((r.username ?? "").trim());
      const displayName = decodeEntities((r.displayName ?? "").trim()) || username;
      const srDate = (r.date ?? "").trim() || null;
      return {
        username,
        displayName,
        userUrl: r.userUrl ?? "",
        avatar: cleanImageUrl(r.avatar ?? null),
        subscriber: r.subscriber ?? false,
        rating: parseScore((r.rating ?? "").trim()),
        date: srDate,
        dateTimestamp: parseDateToTimestamp(srDate),
      };
    });
}

export async function scrapeSongRatingsPage(slug: string, page: number, opts: FetchOpts = FETCH_OPTS): Promise<{ slug: string; page: number; totalPages: number | null; ratings: SongRating[] }> {
  const url = page > 1 ? `${BASE}/song/${slug}/${page}/` : `${BASE}/song/${slug}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Song ratings fetch failed: ${res.status}`);
  const html = await res.text();
  // Pagination links (/song/<slug>/<n>/); the last one is the final page.
  let totalPages: number | null = null;
  for (const m of html.matchAll(/<a href="\/song\/[^"/]+\/(\d+)\/"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  return { slug, page, totalPages, ratings: await scrapeSongRatingRows(new Response(html)) };
}

export interface SongCriticListItem {
  rank: number | null;
  publication: string;
  url: string;
}

/**
 * Scrape the "Critic Lists" year-end placements table from a song detail page.
 * AOTY has no dedicated critic-lists sub-page for songs (unlike albums), so this
 * parses the table embedded in the song page itself. Rows are only captured after
 * the "Critic Lists" heading to avoid matching unrelated `.listTable` markup.
 */
export async function scrapeSongCriticLists(slug: string, opts: FetchOpts = FETCH_OPTS): Promise<{ slug: string; lists: SongCriticListItem[] }> {
  const res = await fetch(`${BASE}/song/${slug}/`, opts);
  if (!res.ok) throw new Error(`Song critic lists fetch failed: ${res.status}`);

  const lists: Array<{ rank: string; publication: string; url: string }> = [];
  const st = {
    inSection: false,
    cur: null as { rank: string; publication: string; url: string } | null,
  };

  await new HTMLRewriter()
    .on(".sectionHeading h2", {
      text(t) {
        if (t.text.trim() === "Critic Lists") st.inSection = true;
      },
    })
    .on(".listTable tr", {
      element() {
        if (!st.inSection) {
          st.cur = null;
          return;
        }
        st.cur = { rank: "", publication: "", url: "" };
        lists.push(st.cur);
      },
    })
    .on(".listTable td.rank", {
      text(t) {
        if (st.cur) st.cur.rank += t.text;
      },
    })
    .on(".listTable td a[href*='/songs/list/']", {
      element(el) {
        if (st.cur && !st.cur.url) {
          const href = el.getAttribute("href") ?? "";
          st.cur.url = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) {
        if (st.cur) st.cur.publication += t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    slug,
    lists: lists
      .filter((l) => l.url && l.publication.trim())
      .map((l) => ({
        rank: parseRank(l.rank.replace("#", "").trim()),
        publication: decodeEntities(l.publication.trim()),
        url: l.url,
      })),
  };
}

export async function scrapeTopSongs(period: string, page: number, opts: FetchOpts = FETCH_OPTS): Promise<{ period: string; page: number; songs: TopSong[] }> {
  const { songs } = await scrapeTopSongsPage(period, page, opts);
  return { period, page, songs };
}

export async function scrapeTopSongsPage(period: string, page: number, opts: FetchOpts = FETCH_OPTS): Promise<{ period: string; page: number; totalPages: number | null; note: string | null; years: PageTab[]; songs: TopSong[] }> {
  const aotyPath = page > 1 ? `/songs/top/${period}/${page}/` : `/songs/top/${period}/`;
  const res = await fetch(`${BASE}${aotyPath}`, opts);
  if (!res.ok) throw new Error(`Top songs fetch failed: ${res.status}`);
  const html = await res.text();
  const parsed = await parseTopSongsRows(new Response(html));
  let totalPages: number | null = null;
  for (const m of html.matchAll(/<a href="[^"]*\/songs\/top\/[^"]*\/(\d+)\/"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  const noteM = html.match(/<strong>Note:<\/strong>([^<]*)/i);
  const years: PageTab[] = [];
  const yearNavIdx = html.indexOf("yearNav");
  if (yearNavIdx !== -1) {
    const chunk = html.slice(yearNavIdx, yearNavIdx + 6000);
    for (const m of chunk.matchAll(/<a href="([^"]+)">[\s\S]*?<div class="yearNavBox[^"]*">([^<]*)<\/div>/g)) {
      const href = m[1] ?? "";
      const label = decodeEntities((m[2] ?? "").trim());
      if (href && label) {
        years.push({ label, url: href.startsWith("http") ? href : BASE + href, selected: false });
      }
    }
    for (const m of chunk.matchAll(/<div class="yearNavBox[^"]*selected[^"]*">([^<]*)<\/div>/g)) {
      const label = decodeEntities((m[1] ?? "").trim());
      const hit = years.find((y) => y.label === label);
      if (hit) hit.selected = true;
    }
  }
  return {
    period,
    page,
    totalPages,
    note: noteM?.[1] ? decodeEntities(noteM[1].trim()) : null,
    years,
    songs: parsed.songs,
  };
}

async function parseTopSongsRows(res: Response): Promise<{ songs: TopSong[] }> {
  type RawTopSong = { rank: string; title: string; url: string; artist: string; artistUrl: string; artists: ArtistLink[]; album: string | null; albumUrl: string | null; cover: string | null; score: string | null; exactScore: string | null; ratingCount: string | null };
  const songs: RawTopSong[] = [];
  let cur: RawTopSong | null = null;
  let linkKind: "song" | "artist" | "album" | null = null;
  await new HTMLRewriter()
    .on(".trackListTable tr", {
      element() {
        cur = { rank: String(songs.length + 1), title: "", url: "", artist: "", artistUrl: "", artists: [], album: null, albumUrl: null, cover: null, score: null, exactScore: null, ratingCount: null };
        songs.push(cur);
        linkKind = null;
      },
    })
    .on(".coverart img", {
      element(el) {
        if (cur) cur.cover = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".songAlbum a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (!cur) return;
        if (href.includes("/song/")) {
          linkKind = "song";
          if (!cur.url) cur.url = href.startsWith("http") ? href : BASE + href;
        } else if (href.includes("/artist/")) {
          linkKind = "artist";
          const url = href.startsWith("http") ? href : BASE + href;
          if (!cur.artistUrl) cur.artistUrl = url;
          cur.artists.push({ name: "", url, image: null });
        } else if (href.includes("/album/")) {
          linkKind = "album";
          if (!cur.albumUrl) cur.albumUrl = href.startsWith("http") ? href : BASE + href;
        } else linkKind = null;
      },
      text(t) {
        if (!cur || !linkKind) return;
        if (linkKind === "song") cur.title = (cur.title ?? "") + t.text;
        else if (linkKind === "artist") {
          cur.artist = (cur.artist ?? "") + t.text;
          const last = cur.artists[cur.artists.length - 1];
          if (last) last.name += t.text;
        }
        else if (linkKind === "album") cur.album = ((cur.album ?? "") as string) + t.text;
      },
    })
    .on(".songAlbum .rank", {
      text(t) {
        if (cur) cur.rank = (cur.rank ?? "") + t.text;
      },
    })
    .on(".trackRating .green-font, .trackRating .yellow-font, .trackRating .red-font", {
      element(el) {
        if (cur && !cur.exactScore) {
          const title = el.getAttribute("title") ?? "";
          const m = title.match(/([\d.]+)/);
          if (m?.[1]) cur.exactScore = m[1];
        }
      },
      text(t) {
        if (cur) cur.score = ((cur.score ?? "") as string) + t.text;
      },
    })
    .on(".trackRating .gray-font", {
      text(t) {
        if (cur) cur.ratingCount = ((cur.ratingCount ?? "") as string) + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    songs: songs
      .filter((x) => (x.title ?? "").trim())
      .map((x, i) => ({
        rank: parseRank((x.rank ?? "").replace(".", "").trim()) ?? i + 1,
        title: decodeEntities((x.title ?? "").trim()),
        url: x.url ?? "",
        artist: decodeEntities((x.artist ?? "").trim()),
        artistUrl: x.artistUrl ?? "",
        artistImage: null,
        artists: (x.artists ?? [])
          .map((a) => ({ name: decodeEntities((a.name ?? "").trim()), url: a.url ?? "", image: null as string | null }))
          .filter((a) => a.name && a.url),
        album: x.album ? decodeEntities((x.album as string).trim()) : null,
        albumUrl: x.albumUrl ?? null,
        cover: cleanImageUrl(x.cover ?? null),
        score: parseScore((x.score ?? "").trim()),
        exactScore: x.exactScore ? parseScore(x.exactScore.trim()) : null,
        ratingCount: parseCount((x.ratingCount ?? "").replace(/Ratings?/i, "").trim()),
      })),
  };
}

export async function scrapeBestSongsYearEnd(
  year: number,
  sort = "points",
  opts: FetchOpts = FETCH_OPTS,
): Promise<SongsBestResult> {
  const url = sort === "lists" ? `${BASE}/songs/best/${year}/sort-by/lists/` : `${BASE}/songs/best/${year}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Best songs fetch failed: ${res.status}`);
  const html = await res.text();
  const songs: SongsBestItem[] = [];
  const rows = [...html.matchAll(/<div class="listSummaryRow">([\s\S]*?)(?=<div class="listSummaryRow"|<div id="comments"|<div class="footer"|$)/g)];

  for (const match of rows) {
    const r = match[1];
    if (!r) continue;

    const rankM = r.match(/<div class="listSummaryRank[^"]*">(\d+)<\/div>/);
    const rank = rankM?.[1] ? parseInt(rankM[1], 10) : 0;

    const coverM = r.match(/<div class="listSummaryCover[^"]*">[\s\S]*?<img [^>]*src="([^"]+)"/);
    const cover = coverM?.[1] ?? null;

    const songM = r.match(/<h3 class="albumTitle listSummary song"><a [^>]*href="([^"]+)">([^<]+)<\/a><\/h3>/);
    const songUrl = songM?.[1] ? (songM[1].startsWith("http") ? songM[1] : BASE + songM[1]) : "";
    const title = songM?.[2] ? decodeEntities(songM[2].trim()) : "";

    const artistBlockM = r.match(/<h2 class="artistTitle listSummary song">([\s\S]*?)<\/h2>/);
    const artists: ArtistLink[] = [];
    if (artistBlockM?.[1]) {
      for (const am of artistBlockM[1].matchAll(/<a [^>]*href="([^"]+)">([^<]+)<\/a>/g)) {
        if (am[1] && am[2]) {
          artists.push({
            name: decodeEntities(am[2].trim()),
            url: am[1].startsWith("http") ? am[1] : BASE + am[1],
            image: null,
          });
        }
      }
    }
    const artist = artists.map((a) => a.name).join(", ");
    const artistUrl = artists[0]?.url ?? "";

    const listsM = r.match(/<div class="head"># Lists<\/div>\s*<div class="count">([\d,]+)<\/div>/);
    const listsCount = listsM?.[1] ? parseInt(listsM[1].replace(/,/g, ""), 10) : 0;

    const pointsM = r.match(/<div class="head">Points<\/div>\s*<div class="count">([\d,]+)<\/div>/);
    const points = pointsM?.[1] ? parseInt(pointsM[1].replace(/,/g, ""), 10) : 0;

    if (title || artist) {
      songs.push({
        rank,
        artist,
        artistUrl,
        artistImage: null,
        artists,
        title,
        url: songUrl,
        cover: cleanImageUrl(cover),
        points,
        listsCount,
      });
    }
  }

  return { year, sort, songs };
}

export interface BestSongsMeta {
  playlistUrl: string | null;
  banner: string | null;
  availableYears: number[];
}

export interface IndividualSongList {
  publication: string;
  sourceUrl: string | null;
  entries: Array<{ artist: string; title: string }>;
}

/** Year nav, playlist, banner and methodology for the best-songs aggregate. */
export async function scrapeBestSongsMeta(year: number, sort: string, opts: FetchOpts = FETCH_OPTS): Promise<BestSongsMeta> {
  const url = sort === "lists" ? `${BASE}/songs/best/${year}/sort-by/lists/` : `${BASE}/songs/best/${year}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Best songs meta fetch failed: ${res.status}`);
  const html = await res.text();
  const playlistM = html.match(/<div class="footerButton spotify">\s*<a href="([^"]+)"/);
  const bannerM = html.match(/<img[^>]*src="([^"]*banner[^"]*)"/i);
  const years = new Set<number>();
  for (const m of html.matchAll(/<a href="\/songs\/best\/(\d{4})\/">/g)) {
    const y = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(y)) years.add(y);
  }
  return {
    playlistUrl: playlistM?.[1] ?? null,
    banner: bannerM?.[1] ? cleanImageUrl(bannerM[1]) : null,
    availableYears: [...years].sort((a, b) => b - a),
  };
}

/** Per-publication individual song lists behind the aggregate ("The Individual Lists"). */
export async function scrapeBestSongsLists(year: number, sort: string, opts: FetchOpts = FETCH_OPTS): Promise<{ year: number; sort: string; methodology: Array<{ place: string; points: string }>; individualLists: IndividualSongList[] }> {
  const url = sort === "lists" ? `${BASE}/songs/best/${year}/sort-by/lists/` : `${BASE}/songs/best/${year}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Best songs lists fetch failed: ${res.status}`);
  const html = await res.text();
  const methodology: Array<{ place: string; points: string }> = [];
  for (const m of html.matchAll(/<div class="pointRow">\s*<div class="left">([^<]*)<\/div>\s*<div class="right">([^<]*)<\/div>/g)) {
    const place = decodeEntities((m[1] ?? "").trim());
    const points = decodeEntities((m[2] ?? "").trim());
    if (place) methodology.push({ place, points });
  }
  const individualLists: IndividualSongList[] = [];
  for (const m of html.matchAll(/<div class="songListContainer">([\s\S]*?)(?=<div class="songListContainer"|<div id="comments"|<div class="footer"|$)/g)) {
    const block = m[1] ?? "";
    const titleM = block.match(/<div class="songListTitle">([^<]*)<\/div>/);
    const sourceM = block.match(/<div class="songListSource">\s*<a href="([^"]+)"/);
    const entries: Array<{ artist: string; title: string }> = [];
    for (const li of block.matchAll(/<li class="songListRow">([\s\S]*?)<\/li>/g)) {
      const item = li[1] ?? "";
      const artistM = item.match(/<span class="songListArtist">([^<]*)<\/span>/);
      const text = decodeEntities(item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      const artist = artistM?.[1] ? decodeEntities(artistM[1].trim()) : "";
      let title = text;
      if (artist && text.startsWith(artist)) title = text.slice(artist.length).trim();
      title = title.replace(/^[\s\-–—"\u201c\u201d'\u2018\u2019]+/, "").replace(/[\s\-–—"\u201c\u201d'\u2018\u2019]+$/, "").trim();
      if (title) entries.push({ artist, title });
    }
    const publication = titleM?.[1] ? decodeEntities(titleM[1].trim()) : "";
    if (publication && entries.length > 0) {
      individualLists.push({
        publication,
        sourceUrl: sourceM?.[1] ?? null,
        entries,
      });
    }
  }
  return { year, sort, methodology, individualLists };
}

