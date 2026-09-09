import { BASE, FETCH_OPTS, REQ_HEADERS, cleanImageUrl, decodeEntities, parseCount, parseScore, parseId, parseRank, parseTrackNumber, parseYear, parsePercent, type FetchOpts } from "../constants.js";
import { scrapeAlbumBlocks, mustHearScopeFromClass } from "./albumBlock.js";
import { scrapeCommentRows } from "./commentRow.js";
import { parseDiscussionTable } from "./social.js";
import { scrapeUserListRows } from "./userListRow.js";
import { parseAlbumUserReviewRows } from "./album.js";
import { fetchArtistImage } from "./artist.js";
import type {
  AlbumBlock,
  AlbumDistributionRow,
  AlbumUserReviewsResult,
  ArtistLink,
  DiscussionEntry,
  FollowArtist,
  FollowUser,
  NamedLink,
  SearchArtist,
  StreamingLink,
  UserBadgeItem,
  UserBestOfYear,
  UserDistributionResult,
  UserGenreItem,
  UserListDetail,
  UserListEntry,
  UserProfile,
  UserRating,
  UserReview,
  UserReviewDetail,
  UserTagEntry,
  UserYearEndAlbum,
  UserYearEndResult,
  UserArtistRatingsResult,
  UserAlbumTrackRatingsResult,
  UserContributionEntry,
  UserContributionsResult,
} from "../types.js";

export async function scrapeUserProfile(username: string, opts: FetchOpts = FETCH_OPTS): Promise<UserProfile> {
  const url = `${BASE}/user/${encodeURIComponent(username)}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User fetch failed: ${res.status}`);
  const html = await res.text();
  const stats: Record<string, string> = {};
  for (const m of html.matchAll(/<div class="profileStat">([^<]*)<\/div>\s*<div class="profileStatName">([^<]*)<\/div>/g)) {
    const v = m[1];
    const k = m[2];
    if (v !== undefined && k !== undefined) {
      stats[k.trim().toLowerCase()] = v.trim();
    }
  }
  const avatarM = html.match(/<img src="([^"]+)"[^>]*alt="[^"]*"[^>]*>/) ?? html.match(/<div class="profileImage">[\s\S]{0,300}?<img src="([^"]+)"/);
  const spanM = html.match(/<h1 class="headline profile">\s*<span[^>]*>([^<]*)<\/span>/i);
  const handleM = html.match(/<h1 class="headline profile">[\s\S]*?<div[^>]*>\(([^)]+)\)<\/div>/i);
  const nameM = html.match(/<h1 class="headline profile"><span>([^<]*)<\/span><\/h1>/) ?? html.match(/<h1[^>]*>([^<]*)<\/h1>/);
  const actualUsername = handleM?.[1] ? decodeEntities(handleM[1].trim()) : nameM?.[1] ? decodeEntities(nameM[1].trim()) : username;
  const displayName = spanM?.[1] ? decodeEntities(spanM[1].trim()) : decodeEntities(actualUsername);

  const userIdM = html.match(/data-(?:user-id|item-id)="(\d+)"/);
  const userId = userIdM?.[1] ?? null;

  const memberM = html.match(/Member since\s+([^<]+)/i);
  const memberSince = memberM?.[1] ? decodeEntities(memberM[1].trim()) : null;

  const yelMatches = [...html.matchAll(/\/year-end\/[^/]+\/(\d{4})\//g)];
  const yearEndLists = [...new Set(yelMatches.map((m) => (m[1] ? parseInt(m[1], 10) : 0)).filter((y) => y > 0))].sort((a, b) => b - a);

  let pinnedReview: UserReview | null = null;
  const pinnedIdx = html.indexOf("Pinned Review");
  if (pinnedIdx !== -1) {
    const endPinned = html.indexOf("<h2 class=\"sectionHeading\">", pinnedIdx + 20);
    const chunk = html.slice(pinnedIdx, endPinned !== -1 ? endPinned : pinnedIdx + 3000);
    const parsed = parseAlbumUserReviewRows(chunk);
    if (parsed.length > 0) pinnedReview = parsed[0] ?? null;
  }

  const bioM = html.match(/<div class="aboutUser">([\s\S]*?)<\/div>/);
  const locM = html.match(/<div class="profileLocation">([\s\S]*?)<\/div>/);
  const links: Array<{ name: string; url: string }> = [];
  for (const m of html.matchAll(/<div class="profileLink">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const u = m[1];
    const n = m[2];
    if (u && n !== undefined) {
      links.push({
        url: u,
        name: decodeEntities(n.replace(/<[^>]+>/g, "").trim()),
      });
    }
  }

  const subscriber = html.includes("donorBanner") || /class="[^"]*subscriber[^"]*"/i.test(html);

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

  let favorites: AlbumBlock[] = [];
  let favoriteArtists: SearchArtist[] = [];
  const favBlockM = html.match(/<div id="favBlock"[^>]*>([\s\S]*?)<\/section>/);
  if (favBlockM?.[1]) {
    const favRes = new Response(favBlockM[1]);
    favorites = await scrapeAlbumBlocks(favRes);
    // Artist-mode favorites render .artistBlock cards instead.
    if (favorites.length === 0) {
      const favArtists: SearchArtist[] = [];
      let favCur: SearchArtist | null = null;
      await new HTMLRewriter()
        .on(".artistBlock", {
          element() {
            favCur = { url: "", name: "", image: null };
            favArtists.push(favCur);
          },
        })
        .on(".artistBlock a", {
          element(el) {
            const href = el.getAttribute("href") ?? "";
            if (favCur && !favCur.url && href.includes("/artist/")) {
              favCur.url = href.startsWith("http") ? href : BASE + href;
            }
          },
        })
        .on(".artistBlock img", {
          element(el) {
            if (favCur) favCur.image = cleanImageUrl(el.getAttribute("src") ?? null);
          },
        })
        .on(".artistBlock .name", {
          text(t) {
            if (favCur) favCur.name = (favCur.name ?? "") + t.text;
          },
        })
        .transform(new Response(favBlockM[1]))
        .arrayBuffer();
      favoriteArtists = favArtists
        .filter((a) => (a.name ?? "").trim() || (a.url ?? "").trim())
        .map((a) => ({ url: a.url ?? "", name: decodeEntities((a.name ?? "").trim()), image: cleanImageUrl(a.image ?? null) }));
    }
  }

  // Activity rails share the profile fetch: slice each section by its heading.
  const sliceSection = (heading: string): string => {
    const start = html.indexOf(heading);
    if (start === -1) return "";
    const next = html.indexOf('<h2 class="sectionHeading">', start + heading.length);
    return html.slice(start, next !== -1 ? next : start + 60000);
  };

  let recentlyRated: UserRating[] = [];
  const ratedChunk = sliceSection("Recently Listened") || sliceSection("Recently Rated");
  if (ratedChunk) recentlyRated = await scrapeUserAlbumBlocks(new Response(ratedChunk), actualUsername);

  let bestOfYear: UserBestOfYear | null = null;
  const bestIdx = html.indexOf("Best of ");
  if (bestIdx !== -1) {
    const bestChunk = sliceSection("Best of ");
    const yearM = bestChunk.match(/\/ratings\/highest\/\?y=(\d{4})|(\d{4})<\/a>/);
    const year = yearM?.[1] ? parseInt(yearM[1], 10) : yearM?.[2] ? parseInt(yearM[2], 10) : null;
    if (bestChunk) bestOfYear = { year, ratings: await scrapeUserAlbumBlocks(new Response(bestChunk), actualUsername) };
  }

  let recentReviews: UserReview[] = [];
  const revChunk = sliceSection("Recent Reviews");
  if (revChunk) {
    recentReviews = (await scrapeAlbumReviewRows(new Response(revChunk), actualUsername)).map((r) => ({
      ...r,
      username: r.username || actualUsername,
      userUrl: r.userUrl || url,
    }));
  }

  let recentLists: UserListEntry[] = [];
  const listsChunk = sliceSection("Recent Lists");
  if (listsChunk) {
    const profileAvatar = cleanImageUrl(avatarM?.[1] ?? null);
    recentLists = (await scrapeUserListRows(new Response(listsChunk))).map((l) => ({
      ...l,
      username: l.username || actualUsername,
      userUrl: l.userUrl || url,
      avatar: l.avatar ?? profileAvatar,
    }));
  }

  // Right-rail previews: tags, following avatars.
  const tagsPreview: string[] = [];
  for (const m of html.matchAll(/<div class="tag[^"]*">\s*<a href="([^"]*\/tag\/[^"]*)">([^<]*)<\/a>\s*<\/div>/g)) {
    const href = m[1] ?? "";
    const name = m[2];
    if (href.includes("/user/") && name !== undefined) {
      const clean = decodeEntities(name.trim());
      if (clean) tagsPreview.push(clean);
    }
  }

  const followingPreview: SearchArtist[] = [];
  const followingIdx = html.indexOf("Following (");
  if (followingIdx !== -1) {
    const nextBox = html.indexOf('<div class="rightBox">', followingIdx + 12);
    const nextHeading = html.indexOf('<h2 class="sectionHeading">', followingIdx + 12);
    let end = html.length;
    if (nextBox !== -1) end = Math.min(end, nextBox);
    if (nextHeading !== -1) end = Math.min(end, nextHeading);
    const box = html.slice(followingIdx, end);
    for (const m of box.matchAll(/<a href="(\/user\/[^"/]+\/)">([\s\S]*?)<\/a>/g)) {
      const u = m[1] ?? "";
      const inner = m[2] ?? "";
      const imgM = inner.match(/<img[^>]*src="([^"]+)"/);
      if (!u || !imgM?.[1]) continue;
      const altM = inner.match(/alt="([^"]*)"/);
      const seg = u.split("/").filter(Boolean).pop() ?? "";
      followingPreview.push({
        url: BASE + u,
        name: decodeEntities((altM?.[1] || seg).trim()),
        image: cleanImageUrl(imgM[1]),
      });
    }
  }

  return {
    url,
    username: actualUsername,
    displayName,
    userId: parseId(userId),
    memberSince,
    avatar: cleanImageUrl(avatarM?.[1] ?? null),
    bio: bioM?.[1] ? decodeEntities(bioM[1].replace(/<[^>]+>/g, "").trim()) : null,
    location: locM?.[1] ? decodeEntities(locM[1].replace(/<[^>]+>/g, "").trim()) : null,
    links,
    subscriber,
    ratingDistribution,
    favorites,
    favoriteArtists,
    pinnedReview,
    recentlyRated,
    bestOfYear,
    recentReviews,
    recentLists,
    tagsPreview,
    followingPreview,
    yearEndLists,
    stats: {
      // AOTY labels the count "Listens" on live profiles ("Ratings" on older markup).
      ratings: parseCount(stats["ratings"]) ?? parseCount(stats["listens"]) ?? 0,
      listens: parseCount(stats["listens"]) ?? parseCount(stats["ratings"]) ?? 0,
      reviews: parseCount(stats["reviews"]) ?? 0,
      lists: parseCount(stats["lists"]) ?? 0,
      followers: parseCount(stats["followers"]) ?? 0,
      following: parseCount(stats["following"]) ?? 0,
    },
  };
}

export async function scrapeUserRatings(
  username: string,
  opts: FetchOpts = FETCH_OPTS,
  params: { page?: number; type?: string | null; decade?: string | null; sort?: string | null; year?: string | number | null; genreId?: string | number | null } = {},
): Promise<{ username: string; page: number; type: string | null; decade: string | null; sort: string | null; year: number | null; genreId: number | null; ratings: UserRating[] }> {
  const { page = 1, type = null, decade = null, sort = null, year = null, genreId = null } = params;
  let url = `${BASE}/user/${encodeURIComponent(username)}/ratings/`;
  if (type === "perfect" || sort === "perfect") {
    url += "perfect/";
  } else {
    if (type) url += `${encodeURIComponent(type)}/`;
    if (sort) url += `${encodeURIComponent(sort)}/`;
  }
  if (page > 1) url += `${page}/`;
  const queryParams = new URLSearchParams();
  if (decade) queryParams.set("d", decade);
  if (year !== null && year !== undefined && String(year) !== "") queryParams.set("y", String(year));
  if (genreId !== null && genreId !== undefined && String(genreId) !== "") queryParams.set("genreID", String(genreId));
  const qs = queryParams.toString();
  if (qs) url += `?${qs}`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User ratings fetch failed: ${res.status}`);
  const ratings = await scrapeUserAlbumBlocks(res, username);
  const yearNum = year === null || year === undefined || String(year) === "" ? null : (parseYear(year) ?? parseId(year));
  const genreNum = genreId === null || genreId === undefined || String(genreId) === "" ? null : parseId(genreId);
  return { username, page, type, decade, sort, year: yearNum, genreId: genreNum, ratings };
}

export async function scrapeUserListened(
  username: string,
  page: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; page: number; ratings: UserRating[] }> {
  const url = page > 1
    ? `${BASE}/user/${encodeURIComponent(username)}/listened/${page}/`
    : `${BASE}/user/${encodeURIComponent(username)}/listened/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User listened fetch failed: ${res.status}`);
  return { username, page, ratings: await scrapeUserAlbumBlocks(res, username) };
}

export async function scrapeUserLibrary(
  username: string,
  opts: FetchOpts = FETCH_OPTS,
  params: { show?: string | null; sort?: string | null; page?: number } = {},
): Promise<{ username: string; show: string | null; sort: string | null; page: number; ratings: UserRating[] }> {
  const { show = null, sort = null, page = 1 } = params;
  const qp = new URLSearchParams();
  if (show) qp.set("t", show);
  if (sort) qp.set("s", sort);
  if (page > 1) qp.set("p", String(page));
  const qs = qp.toString();
  const url = `${BASE}/user/${encodeURIComponent(username)}/library/${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User library fetch failed: ${res.status}`);
  return { username, show, sort, page, ratings: await scrapeUserAlbumBlocks(res, username) };
}

export async function scrapeUserLikedAlbums(
  username: string,
  page: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; page: number; ratings: UserRating[] }> {
  const url = page > 1
    ? `${BASE}/user/${encodeURIComponent(username)}/liked/albums/${page}/`
    : `${BASE}/user/${encodeURIComponent(username)}/liked/albums/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User liked albums fetch failed: ${res.status}`);
  return { username, page, ratings: await scrapeUserAlbumBlocks(res, username) };
}

export async function scrapeUserSpinList(
  username: string,
  page: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; page: number; ratings: UserRating[] }> {
  const url = page > 1
    ? `${BASE}/user/${encodeURIComponent(username)}/spin-list/${page}/`
    : `${BASE}/user/${encodeURIComponent(username)}/spin-list/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User spin list fetch failed: ${res.status}`);
  return { username, page, ratings: await scrapeUserAlbumBlocks(res, username) };
}

export async function scrapeUserTags(
  username: string,
  scope: string,
  sort: string | null,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; scope: string; sort: string | null; tags: UserTagEntry[] }> {
  const tab = scope === "artists" ? "/artists/" : "/";
  const url = `${BASE}/user/${encodeURIComponent(username)}/tags${tab}${sort ? `?s=${encodeURIComponent(sort)}` : ""}`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User tags fetch failed: ${res.status}`);
  type RawTag = { tag: string; url: string; count: string };
  const tags: RawTag[] = [];
  const st: { cur: RawTag | null; countBuf: string } = { cur: null, countBuf: "" };
  await new HTMLRewriter()
    .on(".tagColumn > div", {
      element() {
        st.cur = { tag: "", url: "", count: "" };
        tags.push(st.cur);
        st.countBuf = "";
      },
      text(t) {
        st.countBuf += t.text;
      },
    })
    .on(".tagColumn .tag a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.url && href) st.cur.url = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (st.cur) st.cur.tag = (st.cur.tag ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  // Counts render as sibling spans; recover them in document order via regex.
  const html = await (await fetch(url, opts)).text();
  const counts = [...html.matchAll(/<span style="font-size: 12px; float:right;[^"]*">([^<]*)<\/span>/g)].flatMap((m) => m[1] !== undefined ? [m[1].trim()] : []);
  return {
    username,
    scope,
    sort,
    tags: tags.map((tg, i) => ({
      tag: decodeEntities((tg.tag ?? "").trim()),
      url: tg.url ?? "",
      count: parseCount(counts[i] ?? (tg.count ?? "")) ?? 0,
    })),
  };
}

export async function scrapeUserTagDetail(
  username: string,
  tag: string,
  sort: string | null,
  opts: FetchOpts = FETCH_OPTS,
  page = 1,
): Promise<{ username: string; tag: string; sort: string | null; page: number; ratings: UserRating[] }> {
  let url = `${BASE}/user/${encodeURIComponent(username)}/tag/${encodeURIComponent(tag)}/`;
  if (page > 1) url += `${page}/`;
  if (sort) url += `?s=${encodeURIComponent(sort)}`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User tag fetch failed: ${res.status}`);
  return { username, tag, sort, page, ratings: await scrapeUserAlbumBlocks(res, username) };
}

async function scrapeUserAlbumBlocks(res: Response, username: string): Promise<UserRating[]> {
  type RawUserRating = { url: string; artist: string; artistUrl: string; title: string; cover: string; mediaType: string; releaseDate: string; criticScore: string | null; criticCount: string | null; userScore: string | null; userCount: string | null; mustHear: boolean; mustHearScope: "both" | "user" | "critic" | null; locked: boolean; userRating: string | null; ratedDate: string | null; reviewUrl: string | null; liked: boolean; hasTrackRatings: boolean };
  const ratings: RawUserRating[] = [];
  let cur: RawUserRating | null = null;
  let ratingValue = "";
  let lastRatingType: "critic" | "user" | null = null;
  let inRatingRow = false;
  await new HTMLRewriter()
    .on(".albumBlock", {
      element(el) {
        cur = { url: "", artist: "", artistUrl: "", title: "", cover: "", mediaType: el.getAttribute("data-type") ?? "", releaseDate: "", criticScore: null, criticCount: null, userScore: null, userCount: null, mustHear: false, mustHearScope: null, locked: false, userRating: null, ratedDate: null, reviewUrl: null, liked: false, hasTrackRatings: false };
        ratings.push(cur);
        lastRatingType = null;
        ratingValue = "";
      },
    })
    .on(".albumBlock .image a", {
      element(el) {
        if (cur && !cur.url) {
          const href = el.getAttribute("href");
          if (href) cur.url = BASE + href;
        }
      },
    })
    .on(".albumBlock .image img", {
      element(el) {
        if (cur) cur.cover = el.getAttribute("src") || el.getAttribute("data-src") || "";
      },
    })
    .on(".albumBlock .image .mustHear", {
      element() {
        if (cur) {
          cur.mustHear = true;
          if (cur.mustHearScope === null) cur.mustHearScope = "critic";
        }
      },
    })
    .on(".albumBlock .image", {
      element(el) {
        if (!cur) return;
        const scope = mustHearScopeFromClass(el.getAttribute("class"));
        if (scope) {
          cur.mustHear = true;
          cur.mustHearScope = scope;
        }
      },
    })
    // Heart icon links to the user's liked-albums list: this card is liked.
    .on(".albumBlock .fa-heart", {
      element() {
        if (cur) cur.liked = true;
      },
    })
    // Locked (no-cover art) releases render .noCover instead of an <img>.
    .on(".albumBlock .noCover", {
      element() {
        if (cur) cur.locked = true;
      },
    })
    // Per-track ratings expander for this album by this user.
    .on(".albumBlock .showUserTrackRatings", {
      element() {
        if (cur) cur.hasTrackRatings = true;
      },
    })
    .on(".albumBlock .artistTitle", {
      text(t) {
        if (cur) cur.artist = (cur.artist ?? "") + t.text;
      },
    })
    .on(".albumBlock a", {
      element(el) {
        // artistTitle is sometimes a link (or wrapped in one); first /artist/ href wins.
        const href = el.getAttribute("href") ?? "";
        if (cur && !cur.artistUrl && href.includes("/artist/")) {
          cur.artistUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
    })
    .on(".albumBlock .albumTitle", {
      text(t) {
        if (cur) cur.title = (cur.title ?? "") + t.text;
      },
    })
    .on(".albumBlock .type.functions", {
      text(t) {
        if (cur) cur.releaseDate = (cur.releaseDate ?? "") + t.text;
      },
    })
    .on(".albumBlock .ratingRow", {
      element() {
        ratingValue = "";
        inRatingRow = true;
      },
      text(t) {
        void t;
      },
    })
    // Profile rails wrap the row in .ratingRowContainer instead.
    .on(".albumBlock .ratingRowContainer", {
      element() {
        ratingValue = "";
        inRatingRow = true;
      },
      text(t) {
        void t;
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
          if (cur) cur.criticScore = ratingValue.trim() || null;
          lastRatingType = "critic";
        } else if (text === "user score") {
          if (cur) cur.userScore = ratingValue.trim() || null;
          lastRatingType = "user";
        } else if (text.startsWith("(") && lastRatingType) {
          const count = text.replace(/[()]/g, "").trim();
          if (lastRatingType === "critic" && cur) cur.criticCount = count || null;
          else if (lastRatingType === "user" && cur) cur.userCount = count || null;
          lastRatingType = null;
        } else if (inRatingRow && cur) {
          // User ratings pages show the user's own rating + date without labels.
          if (!cur.userRating && ratingValue.trim()) cur.userRating = ratingValue.trim();
          if (!cur.ratedDate && /[a-z]{3}\s+\d/i.test(text)) cur.ratedDate = t.text.trim();
        }
      },
    })
    .on(".albumBlock a[href*='/album/']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (cur && href.includes(`/user/${username}/album/`) && !cur.reviewUrl) cur.reviewUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .transform(res)
    .arrayBuffer();
  void inRatingRow;

  return ratings.map((r) => {
    const albumIdM = r.url.match(/\/album\/(\d+)/);
    return {
    url: r.url,
    artist: decodeEntities(r.artist.trim()),
    artistUrl: r.artistUrl,
    artistImage: null,
    title: decodeEntities(r.title.trim()),
    cover: cleanImageUrl(r.cover),
    mediaType: r.mediaType,
    releaseDate: r.releaseDate.replace(/\s+/g, " ").trim(),
    criticScore: parseScore(r.criticScore),
    criticCount: parseCount(r.criticCount),
    userScore: parseScore(r.userScore),
    userCount: parseCount(r.userCount),
    mustHear: r.mustHear,
    mustHearScope: r.mustHearScope ?? null,
    userRating: parseScore(r.userRating),
    ratedDate: r.ratedDate,
    reviewUrl: r.reviewUrl,
    liked: r.liked ?? false,
    albumId: albumIdM?.[1] ? parseInt(albumIdM[1], 10) : null,
    hasTrackRatings: r.hasTrackRatings ?? false,
    locked: r.locked ?? false,
    };
  });
}

export async function scrapeFollowList(
  username: string,
  kind: "followers" | "following",
  page: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; kind: string; page: number; users: FollowUser[] }> {
  const base = `${BASE}/user/${encodeURIComponent(username)}/${kind}/`;
  const url = page > 1 ? `${base}${page}/` : base;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User ${kind} fetch failed: ${res.status}`);
  type RawFollow = { url: string; slug: string; name: string; image: string | null; subscriber: boolean };
  const users: RawFollow[] = [];
  const st: { cur: RawFollow | null } = { cur: null };
  await new HTMLRewriter()
    .on(".listRow.users", {
      element() {
        st.cur = { url: "", slug: "", name: "", image: null, subscriber: false };
        users.push(st.cur);
      },
    })
    .on(".listRow.users a[href*='/user/']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.url && /^\/user\/[^/]+\/$/.test(href)) {
          st.cur.url = BASE + href;
          st.cur.slug = href.split("/").filter(Boolean).pop() ?? "";
        }
      },
    })
    .on(".listRow.users .profilePic img", {
      element(el) {
        if (st.cur) st.cur.image = el.getAttribute("src") ?? null;
      },
    })
    .on(".listRow.users .userName", {
      text(t) {
        if (st.cur) st.cur.name = (st.cur.name ?? "") + t.text;
      },
    })
    .on(".listRow.users .donor", {
      element() {
        if (st.cur) st.cur.subscriber = true;
      },
    })
    .transform(res)
    .arrayBuffer();
  return {
    username,
    kind,
    page,
    users: users
      .filter((u) => (u.url ?? "").trim())
      .map((u) => ({
        url: u.url ?? "",
        name: decodeEntities((u.name ?? "").trim()),
        username: decodeEntities((u.slug ?? "").trim()),
        image: cleanImageUrl(u.image ?? null),
        subscriber: u.subscriber ?? false,
      })),
  };
}

/** Artists a user follows (/user/:username/following/artists/). */
export async function scrapeFollowArtists(
  username: string,
  page: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; page: number; artists: FollowArtist[] }> {
  const base = `${BASE}/user/${encodeURIComponent(username)}/following/artists/`;
  const url = page > 1 ? `${base}${page}/` : base;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User following-artists fetch failed: ${res.status}`);
  type RawFollowArtist = { url: string; name: string; image: string | null; hasImage: boolean; followers: string | null };
  const artists: RawFollowArtist[] = [];
  const st: { cur: RawFollowArtist | null } = { cur: null };
  await new HTMLRewriter()
    .on(".listRow.users", {
      element() {
        st.cur = { url: "", name: "", image: null, hasImage: false, followers: null };
        artists.push(st.cur);
      },
    })
    .on(".listRow.users a[href*='/artist/']", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.url && href.includes("/artist/")) {
          st.cur.url = href.startsWith("http") ? href : BASE + href;
        }
      },
    })
    .on(".listRow.users .profilePic img", {
      element(el) {
        if (st.cur) {
          st.cur.image = el.getAttribute("src") ?? null;
          st.cur.hasImage = true;
        }
      },
    })
    .on(".listRow.users .userName", {
      text(t) {
        if (st.cur) st.cur.name = (st.cur.name ?? "") + t.text;
      },
    })
    .on(".listRow.users .followStat", {
      text(t) {
        if (st.cur && !(st.cur.followers ?? "").trim()) st.cur.followers = (st.cur.followers ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  return {
    username,
    page,
    artists: artists
      .filter((a) => (a.url ?? "").trim())
      .map((a) => ({
        url: a.url ?? "",
        name: decodeEntities((a.name ?? "").trim()),
        image: cleanImageUrl(a.image ?? null),
        hasImage: a.hasImage ?? false,
        followers: parseCount((a.followers ?? "").replace(/followers?/i, "").trim()),
      })),
  };
}

export async function scrapeUserReviewBlocks(res: Response): Promise<UserReview[]> {
  type RawReview = { id: string | null; url: string; artist: string; artistUrl: string; album: string; albumUrl: string; cover: string | null; username: string; userUrl: string; avatar: string | null; subscriber: boolean; rating: string | null; text: string; likes: string; comments: string; commentsUrl: string | null; date: string | null; dateExact: string | null };
  const reviews: RawReview[] = [];
  const st: { cur: RawReview | null; textBuf: string; linkKind: "artist" | "album" | "user" | "review" | null; linkHref: string; linkDepth: number } = { cur: null, textBuf: "", linkKind: null, linkHref: "", linkDepth: 0 };
  await new HTMLRewriter()
    .on(".userReviewBlock", {
      element(el) {
        if (st.cur) st.cur.text = st.textBuf.trim();
        const idM = (el.getAttribute("id") ?? "").match(/(\d+)\s*$/);
        st.cur = { id: idM?.[1] ?? null, url: "", artist: "", artistUrl: "", album: "", albumUrl: "", cover: null, username: "", userUrl: "", avatar: null, subscriber: false, rating: null, text: "", likes: "", comments: "", commentsUrl: null, date: null, dateExact: null };
        reviews.push(st.cur);
        st.textBuf = "";
        st.linkKind = null;
        st.linkHref = "";
      },
    })
    .on(".userReviewBlock .cover a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.url && href) st.cur.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".userReviewBlock .cover img", {
      element(el) {
        if (st.cur) st.cur.cover = el.getAttribute("src") ?? null;
      },
    })
    .on(".userReviewBlock .artistTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/artist/")) {
          st.linkKind = "artist";
          st.cur.artistUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) {
        if (st.cur && st.linkKind === "artist") st.cur.artist = (st.cur.artist ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .albumTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/album/")) {
          st.linkKind = "album";
          st.cur.albumUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) {
        if (st.cur && st.linkKind === "album") st.cur.album = (st.cur.album ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .profilePic a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.userUrl && href.includes("/user/")) st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".userReviewBlock .profilePic img", {
      element(el) {
        if (st.cur) st.cur.avatar = el.getAttribute("src") ?? null;
      },
    })
    .on(".userReviewBlock .userName a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/user/")) {
          st.linkKind = "user";
          if (!st.cur.userUrl) st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) {
        if (st.cur && st.linkKind === "user") st.cur.username = (st.cur.username ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .donor", {
      element() {
        if (st.cur) st.cur.subscriber = true;
      },
    })
    .on(".userReviewBlock a", {
      element(el) {
        st.linkHref = el.getAttribute("href") ?? "";
        st.linkDepth++;
        el.onEndTag(() => {
          st.linkDepth = Math.max(0, st.linkDepth - 1);
        });
      },
    })
    .on(".userReviewBlock .rating", {
      text(t) {
        if (st.cur) st.cur.rating = ((st.cur.rating ?? "") as string) + t.text;
      },
    })
    .on(".userReviewBlock .reviewText", {
      text(t) {
        st.textBuf += t.text;
      },
    })
    .on(".userReviewBlock .review_likes", {
      text(t) {
        if (st.cur) st.cur.likes = (st.cur.likes ?? "") + t.text;
      },
    })
    .on(".userReviewBlock .review_comments, .userReviewBlock .comment_count", {
      text(t) {
        if (st.cur) {
          st.cur.comments = (st.cur.comments ?? "") + t.text;
          if (st.linkDepth > 0 && st.linkHref.includes("/album/") && !st.cur.commentsUrl) {
            st.cur.commentsUrl = st.linkHref.startsWith("http") ? st.linkHref : BASE + st.linkHref;
          }
        }
      },
    })
    .on(".userReviewBlock .review_date", {
      element(el) {
        if (st.cur) {
          const attr = el.getAttribute("title");
          if (attr !== null) {
            st.cur.date = attr;
            st.cur.dateExact = attr;
          }
        }
      },
      text(t) {
        if (st.cur && !st.cur.date) st.cur.date = (st.cur.date ?? "") + t.text;
      },
    })
    // Home and community pages render the exact timestamp on .actionContainer
    .on(".userReviewBlock .actionContainer", {
      element(el) {
        if (st.cur && !st.cur.date) {
          const attr = el.getAttribute("title");
          if (attr) {
            st.cur.date = attr;
            st.cur.dateExact = attr;
          }
        }
      },
    })
    .transform(res)
    .arrayBuffer();
  if (st.cur) st.cur.text = st.textBuf.trim();
  return reviews
    .filter((r) => (r.album ?? "").trim() || (r.text ?? "").trim())
    .map((r) => {
      const dateRaw = (r.date ?? "").trim();
      const edited = /\*$/.test(dateRaw);
      return {
      reviewId: r.id ? parseInt(r.id, 10) : null,
      url: r.url ?? "",
      artist: decodeEntities((r.artist ?? "").trim()),
      artistUrl: r.artistUrl ?? "",
      artistImage: null,
      album: decodeEntities((r.album ?? "").trim()),
      albumUrl: r.albumUrl ?? "",
      cover: cleanImageUrl(r.cover ?? null),
      username: decodeEntities((r.username ?? "").trim()),
      userUrl: r.userUrl ?? "",
      avatar: cleanImageUrl(r.avatar ?? null),
      subscriber: r.subscriber ?? false,
      rating: parseScore((r.rating ?? "").trim()),
      text: decodeEntities((r.text ?? "").trim()),
      isTruncated: /read more/i.test(r.text ?? ""),
      likes: parseCount((r.likes ?? "").trim()) ?? 0,
      comments: parseCount((r.comments ?? "").trim()) ?? 0,
      commentsUrl: r.commentsUrl ?? null,
      date: dateRaw.replace(/\*$/, "").trim() || null,
      dateExact: (r.dateExact ?? "").trim() || null,
      edited,
      };
    });
}

export async function scrapeUserReviewsPage(username: string, page: number, sort: string, opts: FetchOpts = FETCH_OPTS): Promise<{ username: string; page: number; sort: string; reviews: UserReview[] }> {
  const base = username === "-" ? `${BASE}/user-reviews/${sort}/` : `${BASE}/user/${encodeURIComponent(username)}/reviews/`;
  const url = page > 1 ? `${base}${page}/` : base;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User reviews fetch failed: ${res.status}`);
  // Global /user-reviews/ pages use .userReviewBlock, per-user pages use .albumReviewRow.
  if (username === "-") return { username, page, sort, reviews: await scrapeUserReviewBlocks(res) };
  return { username, page, sort, reviews: await scrapeAlbumReviewRows(res, username) };
}

export async function scrapeAlbumReviewRows(res: Response, fallbackUsername: string | null): Promise<UserReview[]> {
  // Handles both `.albumReviewRow` variants:
  // - album page: reviewer avatar/name, no artist/album links
  // - user page and profile rails: artist/album links, review url, cover
  type RawReview = { id: string | null; url: string; artist: string; artistUrl: string; album: string; albumUrl: string; cover: string | null; username: string; userUrl: string; avatar: string | null; subscriber: boolean; rating: string | null; text: string; likes: string; comments: string; commentsUrl: string | null; date: string | null; dateExact: string | null };
  const reviews: RawReview[] = [];
  const st: { cur: RawReview | null; textBuf: string; linkHref: string; linkDepth: number } = { cur: null, textBuf: "", linkHref: "", linkDepth: 0 };
  await new HTMLRewriter()
    .on(".albumReviewRow", {
      element(el) {
        if (st.cur) st.cur.text = st.textBuf.trim();
        const idM = (el.getAttribute("id") ?? "").match(/(\d+)\s*$/);
        st.cur = { id: idM?.[1] ?? null, url: "", artist: "", artistUrl: "", album: "", albumUrl: "", cover: null, username: fallbackUsername ?? "", userUrl: "", avatar: null, subscriber: false, rating: null, text: "", likes: "", comments: "", commentsUrl: null, date: null, dateExact: null };
        reviews.push(st.cur);
        st.textBuf = "";
        st.linkHref = "";
        st.linkDepth = 0;
      },
    })
    .on(".albumReviewRow .userReviewImage a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (!st.cur) return;
        if (href.includes("/album/") && !st.cur.url) {
          st.cur.url = href.startsWith("http") ? href : BASE + href;
          const um = href.match(/\/user\/([^/]+)\//);
          if (um && !st.cur.userUrl) st.cur.userUrl = `${BASE}/user/${um[1]}/`;
        } else if (!st.cur.userUrl && href.includes("/user/")) {
          st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
    })
    .on(".albumReviewRow .userReviewImage img", {
      element(el) {
        if (!st.cur) return;
        const src = el.getAttribute("src") ?? null;
        if (st.cur.url) {
          if (!st.cur.cover) st.cur.cover = src;
        } else if (!st.cur.avatar) {
          st.cur.avatar = src;
        }
      },
    })
    .on(".albumReviewRow .userReviewName a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/user/")) {
          if (!st.cur.userUrl) st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
        }
      },
      text(t) {
        if (st.cur) st.cur.username = (st.cur.username ?? "") + t.text;
      },
    })
    .on(".albumReviewRow .donor", {
      element() {
        if (st.cur) st.cur.subscriber = true;
      },
    })
    .on(".albumReviewRow a", {
      element(el) {
        st.linkHref = el.getAttribute("href") ?? "";
        st.linkDepth++;
        el.onEndTag(() => {
          st.linkDepth = Math.max(0, st.linkDepth - 1);
        });
      },
    })
    .on(".albumReviewRow .artistTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/artist/")) st.cur.artistUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (st.cur) st.cur.artist = (st.cur.artist ?? "") + t.text;
      },
    })
    .on(".albumReviewRow .albumTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/album/") && !st.cur.albumUrl) st.cur.albumUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (st.cur) {
          if (/^\d{4}$/.test(t.text.trim())) return;
          st.cur.album = (st.cur.album ?? "") + t.text;
        }
      },
    })
    .on(".albumReviewRow .rating", {
      text(t) {
        if (st.cur) st.cur.rating = ((st.cur.rating ?? "") as string) + t.text;
      },
    })
    .on(".albumReviewRow .albumReviewText", {
      text(t) {
        st.textBuf += t.text;
      },
    })
    .on(".albumReviewRow .albumReviewText a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && href.includes("/user/") && href.includes("/album/") && !st.cur.url)
          st.cur.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".albumReviewRow .review_likes", {
      text(t) {
        if (st.cur) st.cur.likes = (st.cur.likes ?? "") + t.text;
      },
    })
    .on(".albumReviewRow .review_comments", {
      text(t) {
        if (st.cur) {
          st.cur.comments = (st.cur.comments ?? "") + t.text;
          if (st.linkDepth > 0 && st.linkHref.includes("/album/") && !st.cur.commentsUrl) {
            st.cur.commentsUrl = st.linkHref.startsWith("http") ? st.linkHref : BASE + st.linkHref;
          }
        }
      },
    })
    .on(".albumReviewRow .review_date", {
      text(t) {
        if (st.cur) st.cur.date = ((st.cur.date ?? "") as string) + t.text;
      },
    })
    .on(".albumReviewRow .actionContainer[title]", {
      element(el) {
        if (st.cur) {
          const attr = el.getAttribute("title");
          if (attr !== null) {
            st.cur.date = attr;
            st.cur.dateExact = attr;
          }
        }
      },
    })
    .transform(res)
    .arrayBuffer();
  if (st.cur) st.cur.text = st.textBuf.trim();
  return reviews
    .filter((r) => (r.username ?? "").trim())
    .map((r) => {
      const dateRaw = (r.date ?? "").trim();
      const edited = /\*$/.test(dateRaw);
      return {
      reviewId: r.id ? parseInt(r.id, 10) : null,
      url: r.url ?? "",
      artist: decodeEntities((r.artist ?? "").trim()),
      artistUrl: r.artistUrl ?? "",
      artistImage: null,
      album: decodeEntities((r.album ?? "").trim()),
      albumUrl: r.albumUrl ?? "",
      cover: cleanImageUrl(r.cover ?? null),
      username: decodeEntities((r.username ?? "").trim()),
      userUrl: r.userUrl ?? "",
      avatar: cleanImageUrl(r.avatar ?? null),
      subscriber: r.subscriber ?? false,
      rating: parseScore((r.rating ?? "").trim()),
      text: decodeEntities((r.text ?? "").replace(/read more\s*$/i, "").trim()),
      isTruncated: /read more/i.test(r.text ?? ""),
      likes: parseCount((r.likes ?? "").trim()) ?? 0,
      comments: parseCount((r.comments ?? "").trim()) ?? 0,
      commentsUrl: r.commentsUrl ?? null,
      date: dateRaw.replace(/\*$/, "").trim() || null,
      dateExact: (r.dateExact ?? "").trim() || null,
      edited,
      };
    });
}

export async function scrapeAlbumUserReviews(
  albumSlug: string,
  sort: string,
  page: number,
  opts: FetchOpts = FETCH_OPTS,
  type = "reviews",
): Promise<AlbumUserReviewsResult> {
  const sortParam = sort === "recent" ? "recent" : sort === "worst" ? "worst" : "best";
  const params = new URLSearchParams({ sort: sortParam });
  if (type === "ratings") params.set("type", "ratings");
  if (page > 1) params.set("p", String(page));
  const res = await fetch(`${BASE}/album/${albumSlug}/user-reviews/?${params}`, opts);
  if (!res.ok) throw new Error(`Album user reviews fetch failed: ${res.status}`);
  const html = await res.text();

  const likePctM = html.match(/<strong[^>]*>(\d+%)<\/strong>\s*(?:of users )?like this album/i);
  const dislikePctM = html.match(/<strong[^>]*>(\d+%)<\/strong>\s*(?:of users )?don't like this album/i);
  const totalRatingsM = html.match(/showing \d+\s*-\s*\d+\s*of\s*([\d,]+)\s*user reviews/i)
    ?? html.match(/User Score\s*\(([\d,]+)\)/i);

  const distribution: AlbumDistributionRow[] = [];
  for (const row of html.matchAll(/<tr class="distRow">([\s\S]*?)<\/tr>/g)) {
    const rowHtml = row[1];
    if (!rowHtml) continue;
    const mLabel = rowHtml.match(/<td class="distLabel">([\s\S]*?)<\/td>/);
    const mCount = rowHtml.match(/<td class="distCount">([\s\S]*?)<\/td>/);
    const mBar = rowHtml.match(/width:\s*([\d.]+%)/);
    const label = mLabel?.[1] ? decodeEntities(mLabel[1].replace(/<[^>]+>/g, "").trim()) : "";
    const countStr = mCount?.[1] ? mCount[1].replace(/<[^>]+>/g, "").replace(/,/g, "").trim() : "";
    if (label) {
      distribution.push({
        label,
        count: countStr ? parseInt(countStr, 10) || 0 : 0,
        percentage: parsePercent(mBar?.[1]),
      });
    }
  }

  const reviews = await scrapeAlbumReviewRows(new Response(html), null);

  // Album header context + pagination.
  let header: AlbumUserReviewsResult["header"] = null;
  const headerIdx = html.indexOf("albumHeader");
  if (headerIdx !== -1) {
    const chunk = html.slice(headerIdx, headerIdx + 4000);
    const coverM = chunk.match(/<img[^>]*src="([^"]+)"/);
    const artistM = chunk.match(/class="artist"[^>]*>[\s\S]*?<a href="([^"]*\/artist\/[^"]*)">([^<]*)<\/a>/)
      ?? chunk.match(/<a href="([^"]*\/artist\/[^"]*)">([^<]*)<\/a>/);
    const albumM = chunk.match(/<a href="([^"]*\/album\/[^"]*)">/);
    const scoreM = chunk.match(/<div class="rating">([^<]*)<\/div>/);
    const countM = chunk.match(/User Score\s*\(([\d,]+)\)/i);
    header = {
      cover: coverM?.[1] ? cleanImageUrl(coverM[1]) : null,
      artist: artistM?.[2] ? decodeEntities(artistM[2].trim()) : "",
      artistUrl: artistM?.[1] ? (artistM[1].startsWith("http") ? artistM[1] : BASE + artistM[1]) : "",
      album: "",
      albumUrl: albumM?.[1] ? (albumM[1].startsWith("http") ? albumM[1] : BASE + albumM[1]) : "",
      userScore: parseScore((scoreM?.[1] ?? "").trim()),
      userScoreCount: countM?.[1] ? parseInt(countM[1].replace(/,/g, ""), 10) : null,
    };
  }
  let totalPages: number | null = null;
  for (const m of html.matchAll(/[?&]p=(\d+)[^"]*"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  const commentsM = html.match(/Comments \((\d[\d,]*)\)/);
  return {
    slug: albumSlug,
    sort,
    type,
    page,
    totalRatings: totalRatingsM?.[1] ? (parseCount(totalRatingsM[1])) : null,
    totalPages,
    commentCount: commentsM?.[1] ? parseInt(commentsM[1].replace(/,/g, ""), 10) : null,
    likePercentage: parsePercent(likePctM?.[1]),
    dislikePercentage: parsePercent(dislikePctM?.[1]),
    distribution,
    header,
    reviews,
  };
}

export async function scrapeUserReviewDetail(username: string, slug: string, opts: FetchOpts = FETCH_OPTS): Promise<UserReviewDetail> {
  const url = `${BASE}/user/${encodeURIComponent(username)}/album/${slug}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User review fetch failed: ${res.status}`);
  const html = await res.text();
  const idM = slug.match(/^(\d+)/);
  const s = {
    artist: "",
    artistUrl: "",
    album: "",
    albumUrl: "",
    cover: null as string | null,
    avatar: null as string | null,
    rating: "",
    text: "",
    likes: "",
    date: "",
    dateExact: "",
    tracks: [] as Array<{ number: string | null; title: string; url: string; rating: string | null }>,
    track: null as { number: string | null; title: string; url: string; rating: string | null } | null,
  };
  await new HTMLRewriter()
    .on("h2.artist a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href.includes("/artist/")) s.artistUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        s.artist += t.text;
      },
    })
    .on("h1.albumTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (href.includes("/album/")) s.albumUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        s.album += t.text;
      },
    })
    .on(".userReviewHeader .cover img", {
      element(el) {
        if (!s.cover) s.cover = el.getAttribute("src") ?? null;
      },
    })
    .on(".userReviewByline .image img", {
      element(el) {
        if (!s.avatar) s.avatar = el.getAttribute("src") ?? null;
      },
    })
    .on(".userReviewScoreBox .albumCriticScore", {
      text(t) {
        s.rating += t.text;
      },
    })
    .on(".userReviewText", {
      text(t) {
        s.text += t.text;
      },
    })
    .on(".review_likes", {
      text(t) {
        s.likes += t.text;
      },
    })
    .on(".reviewDate span", {
      element(el) {
        s.dateExact = el.getAttribute("title") ?? "";
      },
      text(t) {
        s.date += t.text;
      },
    })
    .on(".trackListTable tr", {
      element() {
        s.track = { number: "", title: "", url: "", rating: null };
        s.tracks.push(s.track);
      },
    })
    .on(".trackListTable .trackNumber", {
      text(t) {
        if (s.track) s.track.number = (s.track.number ?? "") + t.text;
      },
    })
    .on(".trackListTable .trackTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.track && !s.track.url && href.includes("/song/")) s.track.url = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (s.track) s.track.title = (s.track.title ?? "") + t.text;
      },
    })
    .on(".trackListTable .trackTitle span", {
      text(t) {
        const v = t.text.trim();
        if (s.track && /^\d+$/.test(v)) s.track.rating = v;
      },
    })
    .transform(new Response(html))
    .arrayBuffer();

  const commentsCountM = html.match(/<div class="comment_count">(\d+)<\/div>/)
    ?? html.match(/class="commentButton[^"]*">[^<]*Comments \((\d+)\)/i);
  const commentsCount = commentsCountM?.[1] ?? "0";

  const streamingLinks: StreamingLink[] = [];
  const listenIdx = html.indexOf('class="listenOn');
  if (listenIdx !== -1) {
    // Live markup: <div class="amazon"><a href="...">…<span>Amazon</span></a></div>
    const listenChunk = html.slice(listenIdx, listenIdx + 4000);
    const PLATFORM_BY_CLASS: Record<string, string> = {
      amazon: "Amazon",
      appleMusic: "Apple Music",
      apple: "Apple Music",
      spotify: "Spotify",
      soundcloud: "SoundCloud",
      bandcamp: "Bandcamp",
      vinyl: "Vinyl",
    };
    for (const link of listenChunk.matchAll(/<div class="([a-zA-Z]+)"><a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const cls = link[1] ?? "";
      const href = link[2] ?? "";
      const inner = link[3] ?? "";
      if (!href.startsWith("http")) continue;
      const spanM = inner.match(/<span[^>]*>([^<]+)<\/span>/);
      const platform = spanM?.[1] ? decodeEntities(spanM[1].trim()) : (PLATFORM_BY_CLASS[cls] ?? cls);
      if (platform) streamingLinks.push({ platform, url: href });
    }
  }
  if (streamingLinks.length === 0) {
    const linksIdx = html.indexOf('class="albumListLinks');
    if (linksIdx !== -1) {
      const linksChunk = html.slice(linksIdx, linksIdx + 2000);
      for (const link of linksChunk.matchAll(/<a [^>]*href="([^"]+)"[^>]*>\s*<div>([^<]+)<\/div>\s*<\/a>/g)) {
        if (link[1] && link[2]) {
          streamingLinks.push({ platform: decodeEntities(link[2].trim()), url: link[1] });
        }
      }
    }
  }

  // Prev/next review cards: link wraps the arrow (class names are swapped on site).
  const edgeM = [...html.matchAll(/<a [^>]*href="([^"]*\/user\/[^"]*\/album\/[^"]*)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const pickEdge = (cls: string): { title: string; url: string; cover: string | null } | null => {
    const hit = edgeM.find((m) => (m[3] ?? "").includes(cls));
    if (!hit?.[1]) return null;
    const coverM = (hit[3] ?? "").match(/<img [^>]*src="([^"]+)"/i);
    return {
      title: decodeEntities((hit[2] ?? "").trim()),
      url: hit[1].startsWith("http") ? hit[1] : BASE + hit[1],
      cover: cleanImageUrl(coverM?.[1] ?? null),
    };
  };
  // Prev/next review cards: link wraps the arrow (« = older, » = newer).
  // Older markup has the arrow outside the link: `« <a ...>`.
  const legacyEdge = (arrow: string): { title: string; url: string; cover: string | null } | null => {
    const m = html.match(
      new RegExp(`${arrow}[\\s\\S]{0,300}?<a [^>]*href="([^"]*\\/user\\/[^"]*\\/album\\/[^"]*)"[^>]*title="([^"]*)"[^>]*>([\\s\\S]*?)<\\/a>`, "i"),
    );
    if (!m?.[1]) return null;
    const coverM = (m[3] ?? "").match(/<img [^>]*src="([^"]+)"/i);
    return {
      title: decodeEntities((m[2] ?? "").trim()),
      url: m[1].startsWith("http") ? m[1] : BASE + m[1],
      cover: cleanImageUrl(coverM?.[1] ?? null),
    };
  };
  // Fall back to the wrapper class names (which read swapped on live markup).
  const previousReview = pickEdge("«") ?? legacyEdge("«") ?? pickEdge("prevAlbumReview");
  const nextReview = pickEdge("»") ?? legacyEdge("»") ?? pickEdge("nextAlbumReview");

  // Structured dates from JSON-LD + Related Content links.
  const jsonLdM = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  let datePublished: string | null = null;
  let dateModified: string | null = null;
  if (jsonLdM?.[1]) {
    try {
      const jsonLd = JSON.parse(jsonLdM[1]) as Record<string, unknown>;
      datePublished = typeof jsonLd["datePublished"] === "string" ? jsonLd["datePublished"] : null;
      dateModified = typeof jsonLd["dateModified"] === "string" ? jsonLd["dateModified"] : null;
    } catch { /* ignore malformed JSON-LD */ }
  }
  const relatedLinks: NamedLink[] = [];
  const relatedIdx = html.indexOf("Related Content");
  if (relatedIdx !== -1) {
    const relatedChunk = html.slice(relatedIdx, relatedIdx + 6000);
    for (const m of relatedChunk.matchAll(/<div class="relatedRow">\s*<a href="([^"]+)">([^<]+)<\/a>/g)) {
      const href = m[1] ?? "";
      const name = m[2] ?? "";
      if (href && name) {
        relatedLinks.push({
          name: decodeEntities(name.trim()),
          url: href.startsWith("http") ? href : BASE + href,
        });
      }
    }
  }

  const commentsList = await scrapeCommentRows(new Response(html));
  const reviewIdM = html.match(/id="review_likes_(\d+)"/) ?? html.match(/data-review-id="(\d+)"/) ?? html.match(/id="review_(\d+)"/);
  const reviewId = reviewIdM?.[1] ? (parseId(reviewIdM[1]) ?? null) : null;

  return {
    reviewId,
    url,
    artist: decodeEntities(s.artist.trim()),
    artistUrl: s.artistUrl,
    artistImage: await fetchArtistImage(s.artistUrl, opts),
    album: decodeEntities(s.album.trim()),
    albumUrl: s.albumUrl,
    cover: cleanImageUrl(s.cover),
    username,
    userUrl: `${BASE}/user/${encodeURIComponent(username)}/`,
    avatar: cleanImageUrl(s.avatar),
    subscriber: false,
    rating: parseScore(s.rating.trim()),
    text: decodeEntities(s.text.trim()),
    isTruncated: false,
    likes: parseCount(s.likes.trim()) ?? 0,
    comments: parseCount(commentsCount) ?? 0,
    commentsUrl: reviewId ? `${BASE}/scripts/viewAllComments.php?type=user_review&itemID=${reviewId}` : null,
    date: s.dateExact || s.date.trim() || null,
    dateExact: s.dateExact || null,
    edited: false,
    commentsList,
    streamingLinks,
    previousReview,
    nextReview,
    datePublished,
    dateModified,
    relatedLinks,
    albumId: idM?.[1] ? (parseId(idM[1]) ?? null) : null,
    trackRatings: s.tracks
      .filter((t) => (t.title ?? "").trim())
      .map((t) => ({
        number: parseTrackNumber(t.number ?? "") ?? null,
        title: decodeEntities((t.title ?? "").trim()),
        url: t.url ?? "",
        rating: parseScore(t.rating),
      })),
  };
}

export async function scrapeUserLists(username: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<{ username: string; page: number; lists: UserListEntry[] }> {
  const url = page > 1 ? `${BASE}/user/${encodeURIComponent(username)}/lists/${page}/` : `${BASE}/user/${encodeURIComponent(username)}/lists/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User lists fetch failed: ${res.status}`);
  return { username, page, lists: await scrapeUserListRows(res) };
}

export async function scrapeUserListsIndex(opts: FetchOpts = FETCH_OPTS, page = 1): Promise<UserListEntry[]> {
  const url = page > 1 ? `${BASE}/lists/users/${page}/` : `${BASE}/lists/users/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User lists index fetch failed: ${res.status}`);
  return scrapeUserListRows(res);
}

export async function scrapeSearchLists(query: string, opts: FetchOpts = FETCH_OPTS, page = 1): Promise<{ query: string; page: number; total: number | null; totalPages: number | null; lists: UserListEntry[] }> {
  const p = page > 1 ? `&p=${page}` : "";
  const res = await fetch(`${BASE}/search/lists/?q=${encodeURIComponent(query)}${p}`, opts);
  if (!res.ok) throw new Error(`List search failed: ${res.status}`);
  const html = await res.text();
  const lists = await scrapeUserListRows(new Response(html));
  const totalM = html.match(/User Lists \(([\d,]+)\)/);
  const total = totalM?.[1] ? parseInt(totalM[1].replace(/,/g, ""), 10) : null;
  let totalPages: number | null = null;
  for (const m of html.matchAll(/[?&]p=(\d+)[^"]*"[^>]*>\s*<div class="pageSelectSmall"/g)) {
    const n = parseInt(m[1] ?? "", 10);
    if (Number.isFinite(n) && (totalPages === null || n > totalPages)) totalPages = n;
  }
  return { query, page, total, totalPages, lists };
}

export async function scrapeUserListDetail(
  username: string,
  slug: string,
  opts: FetchOpts = FETCH_OPTS,
  params: { sort?: string | null; page?: number } = {},
): Promise<UserListDetail> {
  // slug is like "4445/mu-essentials" or full "list/4445/mu-essentials"
  const { sort = null, page = 1 } = params;
  const path = slug.startsWith("list/") ? slug : `list/${slug}`;
  let url = `${BASE}/user/${encodeURIComponent(username)}/${path}/`;
  if (page > 1) url += `${page}/`;
  if (sort) url += `?sort=${encodeURIComponent(sort)}`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User list fetch failed: ${res.status}`);
  const s = { title: "", description: "", items: [] as Array<{ rank: string; artist: string; artistUrl: string; title: string; url: string; cover: string | null; year: string | null; blurb: string; creatorRating: string | null }>, cur: null as { rank: string; artist: string; artistUrl: string; title: string; url: string; cover: string | null; year: string | null; blurb: string; creatorRating: string | null } | null };
  const html = await res.text();
  await new HTMLRewriter()
    .on(".listHeader h1.headline, h1.headline", {
      text(t) {
        s.title += t.text;
      },
    })
    .on(".userListRow", {
      element() {
        s.cur = { rank: "", artist: "", artistUrl: "", title: "", url: "", cover: null, year: null, blurb: "", creatorRating: null };
        if (s.cur) s.items.push(s.cur);
      },
    })
    .on(".userListRow .rank", {
      text(t) {
        if (s.cur) s.cur.rank = (s.cur.rank ?? "") + t.text;
      },
    })
    .on(".userListRow .userCover a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.cur && !s.cur.url && href.includes("/album/")) s.cur.url = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".userListRow .userCover img", {
      element(el) {
        if (s.cur) s.cur.cover = el.getAttribute("src") ?? null;
      },
    })
    .on(".userListRow .blurb", {
      text(t) {
        if (s.cur) s.cur.blurb = (s.cur.blurb ?? "") + t.text;
      },
    })
    .on(".userListRow .ratingBlock .rating", {
      text(t) {
        if (s.cur && !(s.cur.creatorRating ?? "").trim()) s.cur.creatorRating = ((s.cur.creatorRating ?? "") as string) + t.text;
      },
    })
    .on(".userListRow .artistName a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.cur && href.includes("/artist/")) s.cur.artistUrl = href.startsWith("http") ? href : BASE + href;
      },
      text(t) {
        if (s.cur) s.cur.artist = (s.cur.artist ?? "") + t.text;
      },
    })
    .on(".userListRow .albumTitle a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (s.cur && href.includes("/album/")) {
          if (!s.cur.url) s.cur.url = href.startsWith("http") ? href : BASE + href;
        } else if (s.cur && href.includes("/releases/") && !s.cur.year) {
          const ym = href.match(/\/(\d{4})\//);
          if (ym?.[1]) s.cur.year = ym[1];
        }
      },
      text(t) {
        if (s.cur) {
          // year link text is numeric; album link text is the title
          if (/^\d{4}$/.test(t.text.trim())) {
            if (!s.cur.year) s.cur.year = t.text.trim();
          } else {
            s.cur.title = (s.cur.title ?? "") + t.text;
          }
        }
      },
    })
    .transform(new Response(html))
    .arrayBuffer();
  const descM = html.match(/<div class="listDescription">([\s\S]*?)<\/div>/);
  const comments = await scrapeCommentRows(new Response(html));
  // Header extras: likes, likers, updated time, author avatar, list ID.
  const likesM = html.match(/<div class="likes">([^<]*)<\/div>/);
  const updatedM = html.match(/<div class="updated">([^<]*)<\/div>/);
  const authorAvatarM = html.match(/<div class="byLine">[\s\S]{0,500}?<img[^>]*src="([^"]+)"/);
  const listIdM = url.match(/\/list\/(\d+)/);
  const gridM = html.match(/<a href="([^"]*\/grid\/)">/);
  const likers: SearchArtist[] = [];
  const likesIdx = html.indexOf("Likes (");
  if (likesIdx !== -1) {
    const nextHeading = html.indexOf("sectionHeading", likesIdx + 7);
    const likesChunk = html.slice(likesIdx, nextHeading !== -1 ? nextHeading : likesIdx + 8000);
    for (const m of likesChunk.matchAll(/<a href="(\/user\/[^"/]+\/)"[^>]*><img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g)) {
      const u = m[1] ?? "";
      const img = m[2] ?? null;
      const alt = m[3] ?? "";
      if (u) {
        likers.push({
          url: BASE + u,
          name: decodeEntities((alt || u.split("/").filter(Boolean).pop() || "").trim()),
          image: cleanImageUrl(img),
        });
      }
    }
  }
  return {
    url,
    title: decodeEntities(s.title.trim()),
    username,
    description: descM?.[1] ? decodeEntities(descM[1].replace(/<[^>]+>/g, "").trim()) : null,
    likes: likesM?.[1] ? parseInt(likesM[1].replace(/,/g, "").trim(), 10) || 0 : 0,
    likers,
    updatedAgo: updatedM?.[1] ? decodeEntities(updatedM[1].trim()) : null,
    authorAvatar: authorAvatarM?.[1] ? cleanImageUrl(authorAvatarM[1]) : null,
    listId: listIdM?.[1] ? parseInt(listIdM[1], 10) : null,
    gridUrl: gridM?.[1] ? (gridM[1].startsWith("http") ? gridM[1] : BASE + gridM[1]) : null,
    items: s.items.map((i, idx) => ({
      rank: parseRank((i.rank ?? "").replace(".", "").trim()) ?? idx + 1,
      artist: decodeEntities((i.artist ?? "").trim()),
      artistUrl: i.artistUrl ?? "",
      artistImage: null,
      title: decodeEntities((i.title ?? "").trim()),
      url: i.url ?? "",
      cover: cleanImageUrl(i.cover ?? null),
      year: i.year ? parseYear(i.year) : null,
      blurb: i.blurb ? decodeEntities(i.blurb.trim().replace(/\s+/g, " ")) : null,
      creatorRating: parseScore((i.creatorRating ?? "").trim()),
    })),
    comments,
  };
}

export async function scrapeUsersCommunity(opts: FetchOpts = FETCH_OPTS): Promise<{ reviews: UserReview[]; lists: UserListEntry[]; discussions: DiscussionEntry[] }> {
  const res = await fetch(`${BASE}/users/`, opts);
  if (!res.ok) throw new Error("Community fetch failed");
  const html = await res.text();
  const [reviews, lists] = await Promise.all([scrapeUserReviewBlocks(new Response(html)), scrapeUserListRows(new Response(html))]);
  // Recent Album Discussion table.
  const discussions = parseDiscussionTable(html);
  return { reviews, lists, discussions };
}

export async function scrapeUserGenres(
  username: string,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; genres: UserGenreItem[] }> {
  const url = `${BASE}/user/${encodeURIComponent(username)}/genres/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User genres fetch failed: ${res.status}`);

  type RawGenre = { name: string; url: string; count: number | null; percentage: string; averageScore: string };
  const genres: RawGenre[] = [];
  const st: { cur: RawGenre | null } = { cur: null };

  await new HTMLRewriter()
    .on(".genreRow, tr.genreRow, .genreBlock, tr", {
      element() {
        st.cur = { name: "", url: "", count: null, percentage: "", averageScore: "" };
      },
    })
    .on("a[href*='/genre/']", {
      element(el) {
        if (st.cur && !st.cur.url) {
          const href = el.getAttribute("href");
          if (href) {
            st.cur.url = href.startsWith("http") ? href : BASE + href;
          }
        }
      },
      text(t) {
        if (st.cur && !st.cur.name) {
          st.cur.name = t.text.trim();
        }
      },
    })
    .on(".genreCount, .count, td.count", {
      text(t) {
        if (st.cur) {
          const num = parseInt(t.text.replace(/,/g, "").trim(), 10);
          if (!Number.isNaN(num)) st.cur.count = num;
        }
      },
    })
    .on(".genrePercentage, .percentage, td.percentage", {
      text(t) {
        if (st.cur && t.text.trim()) st.cur.percentage = (st.cur.percentage ?? "") + t.text.trim();
      },
    })
    .on(".genreScore, .score, td.score, .averageScore", {
      text(t) {
        if (st.cur && t.text.trim()) st.cur.averageScore = (st.cur.averageScore ?? "") + t.text.trim();
      },
    })
    .on(".genreRow, tr.genreRow, .genreBlock, tr", {
      element(el) {
        el.onEndTag(() => {
          if (st.cur?.name) {
            genres.push({
              name: decodeEntities(st.cur.name.trim()),
              url: st.cur.url ?? "",
              count: st.cur.count ?? null,
              percentage: st.cur.percentage,
              averageScore: st.cur.averageScore,
            });
            st.cur = null;
          }
        });
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    username,
    genres: genres.map((g) => ({
      name: g.name,
      url: g.url,
      count: g.count ?? null,
      percentage: parsePercent(g.percentage),
      averageScore: parseScore(g.averageScore),
    })),
  };
}

export async function scrapeUserBadges(
  username: string,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ username: string; badges: UserBadgeItem[] }> {
  const url = `${BASE}/user/${encodeURIComponent(username)}/badges/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User badges fetch failed: ${res.status}`);

  const badges: UserBadgeItem[] = [];
  const st: { cur: Partial<UserBadgeItem> | null } = { cur: null };

  await new HTMLRewriter()
    .on(".badgeRow, .badgeBlock, .badge", {
      element() {
        st.cur = { name: "", description: null, image: null, date: null };
      },
    })
    .on(".badgeTitle, .badgeName, .title", {
      text(t) {
        if (st.cur) st.cur.name = (st.cur.name ?? "") + t.text;
      },
    })
    .on(".badgeDescription, .description, .desc", {
      text(t) {
        if (st.cur) st.cur.description = (st.cur.description ?? "") + t.text;
      },
    })
    .on("img", {
      element(el) {
        if (st.cur && !st.cur.image) {
          st.cur.image = el.getAttribute("src") ?? null;
        }
      },
    })
    .on(".badgeDate, .date", {
      text(t) {
        if (st.cur) st.cur.date = (st.cur.date ?? "") + t.text;
      },
    })
    .on(".badgeRow, .badgeBlock, .badge", {
      element(el) {
        el.onEndTag(() => {
          if (st.cur?.name?.trim()) {
            badges.push({
              name: decodeEntities(st.cur.name.trim()),
              description: st.cur.description ? decodeEntities(st.cur.description.trim()) : null,
              image: cleanImageUrl(st.cur.image ?? null),
              date: st.cur.date ? st.cur.date.trim() : null,
            });
            st.cur = null;
          }
        });
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    username,
    badges,
  };
}

export async function scrapeUserYearEnd(
  username: string,
  year: number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<UserYearEndResult> {
  const url = `${BASE}/year-end/${encodeURIComponent(username)}/${year}/`;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`User year-end fetch failed: ${res.status}`);
  const html = await res.text();

  const userM = html.match(/<div class="userName"><a [^>]*title="([^"]*)"[^>]*>([^<]*)<\/a><\/div>/i)
    ?? html.match(/<div class="userName"><a [^>]*>([^<]*)<\/a><\/div>/i);
  const displayName = userM?.[2] ? decodeEntities(userM[2].trim()) : userM?.[1] ? decodeEntities(userM[1].trim()) : username;
  const avatarM = html.match(/<div class="userImage"><a [^>]*><img [^>]*src="([^"]+)"/i);
  const avatar = cleanImageUrl(avatarM?.[1] ?? null);

  const coversByIndex = new Map<number, string>();
  for (const cm of html.matchAll(/<div class="yearEnd block[^"]*" data-album-index="(\d+)">[\s\S]*?<img [^>]*src="([^"]+)"/g)) {
    if (cm[1] && cm[2]) {
      const idx = parseInt(cm[1], 10);
      coversByIndex.set(idx, cleanImageUrl(cm[2]));
    }
  }

  const albums: UserYearEndAlbum[] = [];
  const listItems = [...html.matchAll(/<li data-album-index="(\d+)"><a href="([^"]+)">([^<]+)<\/a><\/li>/g)];
  for (const m of listItems) {
    if (!m[1] || !m[2] || !m[3]) continue;
    const idx = parseInt(m[1], 10);
    const href = m[2];
    const fullText = decodeEntities(m[3].trim());
    const dashIdx = fullText.indexOf(" - ");
    const artist = dashIdx > -1 ? fullText.slice(0, dashIdx).trim() : "";
    const album = dashIdx > -1 ? fullText.slice(dashIdx + 3).trim() : fullText;
    const albumUrl = href.startsWith("http") ? href : BASE + href;
    const cover = coversByIndex.get(idx) ?? null;
    albums.push({
      rank: idx + 1,
      artist,
      artistUrl: "",
      artistImage: null,
      album,
      albumUrl,
      cover,
    });
  }

  const parseCsvList = (cat: string): string[] => {
    const m = html.match(new RegExp(`<span class="category">${cat}<\\/span>\\s*\\/\\s*([^<]+)`, "i"));
    if (!m?.[1]) return [];
    return m[1].split(",").map((s) => decodeEntities(s.trim())).filter(Boolean);
  };

  const genres = parseCsvList("genres");
  const secondaries = parseCsvList("secondaries");
  const descriptors = parseCsvList("descriptors");

  return {
    username,
    displayName,
    userUrl: `${BASE}/user/${encodeURIComponent(username)}/`,
    avatar,
    year,
    albums,
    genres,
    secondaries,
    descriptors,
  };
}

export async function scrapeUserDistribution(
  usernameOrId: string | number,
  format = "albums",
  opts: FetchOpts = FETCH_OPTS,
): Promise<UserDistributionResult> {
  let userId: string | number = usernameOrId;
  if (typeof usernameOrId === "string" && !/^\d+$/.test(usernameOrId)) {
    const profile = await scrapeUserProfile(usernameOrId, opts);
    if (!profile.userId) throw new Error("Could not determine user ID for distribution");
    userId = profile.userId;
  }
  const res = await fetch(`${BASE}/scripts/changeDistribution.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ type: "profile", format, itemID: String(userId) }).toString(),
  });
  if (!res.ok) throw new Error(`User distribution fetch failed: ${res.status}`);
  const html = await res.text();
  const rows: AlbumDistributionRow[] = [];
  for (const row of html.matchAll(/<tr class="distRow">([\s\S]*?)<\/tr>/g)) {
    const rowHtml = row[1];
    if (!rowHtml) continue;
    const mLabel = rowHtml.match(/<td class="distLabel">([\s\S]*?)<\/td>/);
    const mCount = rowHtml.match(/<td class="distCount">([\s\S]*?)<\/td>/);
    const mBar = rowHtml.match(/width:\s*([\d.]+%)/);
    const label = mLabel?.[1] ? decodeEntities(mLabel[1].replace(/<[^>]+>/g, "").trim()) : "";
    const countStr = mCount?.[1] ? mCount[1].replace(/<[^>]+>/g, "").replace(/,/g, "").trim() : "";
    if (label) {
      rows.push({
        label,
        count: countStr ? parseInt(countStr, 10) || 0 : 0,
        percentage: parsePercent(mBar?.[1]),
      });
    }
  }
  return { username: String(usernameOrId), format, rows };
}

export async function scrapeUserArtistRatings(
  usernameOrId: string | number,
  artistId: string | number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<UserArtistRatingsResult> {
  let userId: string | number = usernameOrId;
  if (typeof usernameOrId === "string" && !/^\d+$/.test(usernameOrId)) {
    const profile = await scrapeUserProfile(usernameOrId, opts);
    if (!profile.userId) throw new Error("Could not determine user ID for artist ratings");
    userId = profile.userId;
  }
  const res = await fetch(`${BASE}/scripts/showArtistRatings.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ userID: String(userId), artistID: String(artistId) }).toString(),
  });
  if (!res.ok) throw new Error(`Artist ratings fetch failed: ${res.status}`);
  const html = await res.text();
  const ratings: Array<{ rank: number; album: string; albumUrl: string; cover: string | null; year: string | null; score: string | null; reviewUrl: string | null }> = [];

  for (const tr of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const r = tr[1];
    if (!r) continue;
    const rankM = r.match(/<td class="rank">(\d+)<\/td>/);
    const coverM = r.match(/<td class="tableCover">[\s\S]*?<img [^>]*src="([^"]+)"/);
    const albumM = r.match(/<div class="largeTitle"><a href="([^"]+)">([^<]+)<\/a><\/div>/);
    const yearM = r.match(/<div style="color: gray; font-size: \.9em;">(\d{4})<\/div>/);
    const scoreM = r.match(/<td class="tableRating"><div class="[^"]*-font">(\d+)<\/div><\/td>/);
    const revM = r.match(/<a href="([^"]*\/user\/[^"]*\/album\/[^"]*)">/);

    if (albumM?.[1] && albumM[2]) {
      ratings.push({
        rank: rankM?.[1] ? parseInt(rankM[1], 10) : ratings.length + 1,
        album: decodeEntities(albumM[2].trim()),
        albumUrl: albumM[1].startsWith("http") ? albumM[1] : BASE + albumM[1],
        cover: coverM?.[1] ?? null,
        year: yearM?.[1] ?? null,
        score: scoreM?.[1] ?? null,
        reviewUrl: revM?.[1] ? (revM[1].startsWith("http") ? revM[1] : BASE + revM[1]) : null,
      });
    }
  }

  return {
    username: String(usernameOrId),
    artistId: parseId(artistId) ?? 0,
    ratings: ratings.map((r) => ({
      rank: r.rank,
      album: r.album,
      albumUrl: r.albumUrl,
      cover: cleanImageUrl(r.cover),
      year: r.year ? parseYear(r.year) : null,
      score: parseScore(r.score),
      reviewUrl: r.reviewUrl,
    })),
  };
}

export async function scrapeUserAlbumTrackRatings(
  usernameOrId: string | number,
  albumIdOrSlug: string | number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<UserAlbumTrackRatingsResult> {
  let userId: string | number = usernameOrId;
  if (typeof usernameOrId === "string" && !/^\d+$/.test(usernameOrId)) {
    const profile = await scrapeUserProfile(usernameOrId, opts);
    if (!profile.userId) throw new Error("Could not determine user ID for track ratings");
    userId = profile.userId;
  }
  const albumId = String(albumIdOrSlug).match(/^(\d+)/)?.[1] ?? String(albumIdOrSlug);

  const res = await fetch(`${BASE}/scripts/trackRatings/showUserTrackRatings.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({ albumID: albumId, userID: String(userId) }).toString(),
  });
  if (!res.ok) throw new Error(`User track ratings fetch failed: ${res.status}`);
  const html = await res.text();

  const albumTitleM = html.match(/<h1 class="albumTitle"><a [^>]*>([^<]+)<\/a><\/h1>/i);
  const fullTitle = albumTitleM?.[1] ? decodeEntities(albumTitleM[1].trim()) : "";
  const dashIdx = fullTitle.indexOf(" - ");
  const artist = dashIdx > -1 ? fullTitle.slice(0, dashIdx).trim() : "";
  const album = dashIdx > -1 ? fullTitle.slice(dashIdx + 3).trim() : fullTitle;

  const coverM = html.match(/<div class="albumHeaderCover">[\s\S]*?<img [^>]*data-src="([^"]+)"/i)
    ?? html.match(/<div class="albumHeaderCover">[\s\S]*?<img [^>]*src="([^"]+)"/i);
  const cover = cleanImageUrl(coverM?.[1] ?? null);

  const tracks: Array<{ number: number; title: string; url: string; length: string; score: number | null; features: string[]; featureLinks: ArtistLink[] }> = [];
  for (const tr of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const r = tr[1];
    if (!r) continue;
    const numM = r.match(/<td class="trackNumber">(\d+)<\/td>/i);
    const titleM = r.match(/<td class="trackTitle"><a href="([^"]*)">([^<]*)<\/a>/i);
    const lenM = r.match(/<div class="length">([^<]*)<\/div>/i);
    const scoreM = r.match(/<td class="trackRating">(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/td>/i);

    const feat: string[] = [];
    const featLinks: ArtistLink[] = [];
    const featBlock = r.match(/<div class="featuredArtists">([\s\S]*?)<\/div>/i);
    if (featBlock?.[1]) {
      for (const fa of featBlock[1].matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g)) {
        if (fa[2]) {
          feat.push(decodeEntities(fa[2].trim()));
          if (fa[1]?.includes("/artist/")) {
            featLinks.push({
              name: decodeEntities(fa[2].trim()),
              url: fa[1].startsWith("http") ? fa[1] : BASE + fa[1],
              image: null,
            });
          }
        }
      }
      // Fallback for feature links without hrefs (keep names only).
      if (feat.length === 0) {
        for (const fa of featBlock[1].matchAll(/<a [^>]*>([^<]+)<\/a>/g)) {
          if (fa[1]) feat.push(decodeEntities(fa[1].trim()));
        }
      }
    }

    if (numM?.[1] && titleM?.[2] && titleM[1]) {
      const rawScore = scoreM?.[1]?.trim();
      const score = rawScore && rawScore !== "NR" ? rawScore : null;
      tracks.push({
        number: parseInt(numM[1], 10) || 0,
        title: decodeEntities(titleM[2].trim()),
        url: titleM[1].startsWith("http") ? titleM[1] : BASE + titleM[1],
        length: lenM?.[1]?.trim() ?? "",
        score: parseScore(score),
        features: feat,
        featureLinks: featLinks,
      });
    }
  }

  return {
    username: String(usernameOrId),
    albumId: parseId(albumId) ?? 0,
    album,
    artist,
    cover,
    tracks,
  };
}

/** Parse structured contribution or stats items from userStats.php HTML response. */
export function parseUserContributionsHtml(html: string): UserContributionEntry[] {
  const items: UserContributionEntry[] = [];
  const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>|<div class="(?:[^"]*Row|listItem|statRow|contributionRow)[^"]*">([\s\S]*?)<\/div>/gi)];
  for (const m of rowMatches) {
    const chunk = m[1] ?? m[2] ?? "";
    const linkM = chunk.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const dateM = chunk.match(/(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d+[smhdwmy]\s+ago)/i);
    if (linkM?.[1]) {
      const href = linkM[1];
      const text = decodeEntities(linkM[2]?.replace(/<[^>]+>/g, "").trim() ?? "");
      const fullText = decodeEntities(chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      items.push({
        type: href.includes("/album/") ? "album" : href.includes("/artist/") ? "artist" : href.includes("/song/") ? "song" : "other",
        title: text,
        url: href.startsWith("http") ? href : BASE + href,
        detail: fullText !== text ? fullText : null,
        date: dateM?.[0] ?? null,
      });
    }
  }
  return items;
}

/**
 * Fetch a user's stats or contributions popup via the overlay endpoint
 * (verified in userScript.js / profile HTML: POST /scripts/userStats.php {userID, popType}).
 */
export async function scrapeUserPopup(
  userOrId: string | number,
  popType: "contributions" | "stats" = "contributions",
  opts: FetchOpts = FETCH_OPTS,
): Promise<UserContributionsResult> {
  let userId: number;
  let username: string | null = null;
  const userStr = String(userOrId).trim();
  if (typeof userOrId === "number" || /^\d+$/.test(userStr)) {
    userId = typeof userOrId === "number" ? userOrId : parseInt(userStr, 10);
  } else {
    username = userStr;
    const profile = await scrapeUserProfile(username, opts);
    if (!profile.userId) throw new Error(`Could not resolve numeric user ID for "${username}"`);
    userId = profile.userId;
  }

  const res = await fetch(`${BASE}/scripts/userStats.php`, {
    ...opts,
    method: "POST",
    headers: {
      ...REQ_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: username ? `${BASE}/user/${encodeURIComponent(username)}/` : `${BASE}/`,
    },
    body: new URLSearchParams({ userID: String(userId), popType }).toString(),
  });
  if (!res.ok) throw new Error(`User ${popType} fetch failed: ${res.status}`);
  const html = await res.text();
  return {
    userId,
    username,
    popType,
    html,
    items: parseUserContributionsHtml(html),
  };
}




