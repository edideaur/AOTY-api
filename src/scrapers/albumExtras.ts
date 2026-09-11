import { BASE, FETCH_OPTS, REQ_HEADERS, cleanImageUrl, decodeEntities, parseCount, parseScore, parseExactScore, parseId, parsePercent, parseDateToTimestamp, type FetchOpts } from "../constants.js";
import type {
  AlbumStats,
  CreditEntry,
  CreditSection,
  AlbumRatingHistory,
  AlbumDistribution,
  AlbumDistributionRow,
  AlbumUserItem,
  AlbumImagesResult,
  AlbumImageItem,
} from "../types.js";

const EXTRAS_HEADERS: HeadersInit = {
  ...REQ_HEADERS,
  "Content-Type": "application/x-www-form-urlencoded",
  "X-Requested-With": "XMLHttpRequest",
};

export async function scrapeAlbumStats(albumId: string | number): Promise<AlbumStats | null> {
  try {
    const res = await fetch(`${BASE}/scripts/moreStatsAlbum.php`, {
      method: "POST",
      headers: EXTRAS_HEADERS,
      body: `albumID=${String(albumId)}`,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const nums = [...text.matchAll(/[\d,]+/g)]
      .map((m) => parseInt(m[0].replace(/,/g, ""), 10))
      .filter((n) => !Number.isNaN(n));
    if (nums.length < 5) return null;
    return {
      favorites: nums[0] ?? null,
      likes: nums[1] ?? null,
      listens: nums[2] ?? null,
      libraryCount: nums[3] ?? null,
      lists: nums[4] ?? null,
    };
  } catch {
    return null;
  }
}

export async function scrapeAlbumCredits(albumId: string | number): Promise<CreditSection[] | null> {
  try {
    const res = await fetch(`${BASE}/scripts/showAlbumCredits.php`, {
      method: "POST",
      headers: EXTRAS_HEADERS,
      body: `albumID=${String(albumId)}`,
    });
    if (!res.ok) return null;

    const sections: CreditSection[] = [];
    const c = {
      section: null as CreditSection | null,
      credit: null as CreditEntry | null,
      // HTMLRewriter has no element-end hook, so track which credit a role buffer belongs
      // to separately: flush to roleTarget when the *next* <a> element starts.
      roleBuf: "",
      roleTarget: null as CreditEntry | null,
    };

    function flushRole() {
      const r = c.roleBuf.trim();
      if (r && c.roleTarget) c.roleTarget.roles.push(r);
      c.roleBuf = "";
    }

    await new HTMLRewriter()
      .on(".sectionTitle", {
        element() {
          c.section = { title: "", credits: [] };
          sections.push(c.section);
        },
        text(t) { if (c.section) c.section.title += t.text; },
      })
      .on(".credit", {
        element() {
          c.credit = { name: "", url: "", image: null, roles: [] };
          if (c.section) c.section.credits.push(c.credit);
        },
      })
      .on(".credit .photo img", {
        element(el) { if (c.credit) c.credit.image = cleanImageUrl(el.getAttribute("src") ?? null); },
      })
      .on(".credit .name a[href*='/artist/']", {
        element(el) {
          if (c.credit && !c.credit.url) {
            const href = el.getAttribute("href");
            if (href) c.credit.url = BASE + href;
          }
        },
        text(t) { if (c.credit) c.credit.name += t.text; },
      })
      .on(".credit .songs a", {
        element() {
          // flush the previous role (belongs to roleTarget, not necessarily c.credit)
          flushRole();
          c.roleTarget = c.credit;
        },
        text(t) { c.roleBuf += t.text; },
      })
      .transform(res)
      .arrayBuffer();

    flushRole(); // flush the last accumulated role

    for (const section of sections) {
      section.title = decodeEntities(section.title.trim());
      for (const credit of section.credits) {
        credit.name = decodeEntities(credit.name.trim());
        credit.image = cleanImageUrl(credit.image);
      }
    }

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}

export async function scrapeAlbumRatingHistory(albumId: string): Promise<AlbumRatingHistory> {
  const res = await fetch(`${BASE}/scripts/ratingHistory.php`, {
    method: "POST",
    headers: EXTRAS_HEADERS,
    body: `albumID=${albumId}`,
  });
  if (!res.ok) throw new Error(`Rating history fetch failed: ${res.status}`);

  const rawMilestones: Array<{ milestone: string; date: string | null; score: string; exactScore: string | null }> = [];
  let cur: { milestone: string; date: string | null; score: string; exactScore: string | null } | null = null;
  let headline = "";

  await new HTMLRewriter()
    .on(".subHeadline.scoreTrend", {
      text(t) {
        headline += t.text;
      },
    })
    .on(".ratingHistoryTable tr", {
      element() {
        cur = { milestone: "", date: null, score: "", exactScore: null };
        rawMilestones.push(cur);
      },
    })
    .on(".ratingHistoryTable .historyLabel", {
      text(t) {
        if (cur && !cur.date) {
          cur.milestone = (cur.milestone ?? "") + t.text;
        }
      },
    })
    .on(".ratingHistoryTable .historyLabel div", {
      text(t) {
        if (cur) cur.date = (cur.date ?? "") + t.text;
      },
    })
    .on(".ratingHistoryTable .historyScore", {
      element(el) {
        if (cur) cur.exactScore = el.getAttribute("title") ?? null;
      },
      text(t) {
        if (cur) cur.score = (cur.score ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    albumId: parseId(albumId) ?? 0,
    headline: decodeEntities(headline.trim()),
    milestones: rawMilestones.map((m) => {
      const rawM = decodeEntities((m.milestone ?? "").replace(m.date ?? "", "").trim());
      const mDate = (m.date ?? "").trim() || null;
      return {
        milestone: parseCount(rawM) ?? 0,
        date: mDate,
        dateTimestamp: parseDateToTimestamp(mDate),
        score: parseScore((m.score ?? "").trim()),
        exactScore: m.exactScore ? parseExactScore(m.exactScore.trim()) : null,
      };
    }),
  };
}

export async function scrapeAlbumDistribution(albumId: string | number, format = "all"): Promise<AlbumDistribution> {
  const res = await fetch(`${BASE}/scripts/changeDistribution.php`, {
    method: "POST",
    headers: EXTRAS_HEADERS,
    body: new URLSearchParams({ type: "album", format, itemID: String(albumId) }).toString(),
  });
  if (!res.ok) throw new Error(`Album distribution fetch failed: ${res.status}`);

  const rows: AlbumDistributionRow[] = [];
  let cur: AlbumDistributionRow | null = null;
  let labelBuf = "";
  let countBuf = "";

  await new HTMLRewriter()
    .on(".distRow", {
      element() {
        cur = { label: "", count: 0, percentage: null };
        rows.push(cur);
        labelBuf = "";
        countBuf = "";
      },
    })
    .on(".distRow .distLabel", {
      text(t) {
        labelBuf += t.text;
      },
      element(el) {
        el.onEndTag(() => {
          if (cur) cur.label = labelBuf.trim();
        });
      },
    })
    .on(".distRow .distCount", {
      text(t) {
        countBuf += t.text;
      },
      element(el) {
        el.onEndTag(() => {
          if (cur) cur.count = parseInt(countBuf.replace(/,/g, "").trim(), 10) || 0;
        });
      },
    })
    .on(".distRow .distBar", {
      element(el) {
        const style = el.getAttribute("style") ?? "";
        const match = style.match(/width:\s*([\d.]+%)/);
        if (cur && match?.[1]) cur.percentage = parsePercent(match[1]);
      },
    })
    .transform(res)
    .arrayBuffer();

  return {
    albumId: parseId(albumId) ?? 0,
    format,
    rows,
  };
}

export async function scrapeAlbumUsers(
  type: "albumLikes" | "albumLibrary",
  albumId: string | number,
  start = 0,
  opts: FetchOpts = FETCH_OPTS,
): Promise<{ albumId: number; type: string; start: number; users: AlbumUserItem[] }> {
  const res = await fetch(`${BASE}/scripts/showMore.php`, {
    ...opts,
    method: "POST",
    headers: EXTRAS_HEADERS,
    body: new URLSearchParams({ type, albumID: String(albumId), start: String(start) }).toString(),
  });
  if (!res.ok) throw new Error(`Album ${type} fetch failed: ${res.status}`);
  const html = await res.text();
  const users: AlbumUserItem[] = [];
  for (const block of html.matchAll(/<div class="userBlock[^"]*">([\s\S]*?)(?=<div class="userBlock"|$)/g)) {
    const b = block[1];
    if (!b) continue;
    const linkM = b.match(/<a [^>]*href="([^"]*\/user\/[^"]*)"/i);
    const imgM = b.match(/<img [^>]*src="([^"]+)"/i);
    const nameM = b.match(/<div class="userName">\s*<a [^>]*>([^<]+)<\/a>/i);
    if (linkM?.[1] && nameM?.[1]) {
      users.push({
        username: decodeEntities(nameM[1].trim()),
        url: linkM[1].startsWith("http") ? linkM[1] : BASE + linkM[1],
        avatar: cleanImageUrl(imgM?.[1] ?? null),
      });
    }
  }
  return { albumId: parseId(albumId) ?? 0, type, start, users };
}

export async function scrapeAlbumImages(
  albumId: string | number,
  opts: FetchOpts = FETCH_OPTS,
): Promise<AlbumImagesResult> {
  const res = await fetch(`${BASE}/scripts/showImage.php`, {
    ...opts,
    method: "POST",
    headers: EXTRAS_HEADERS,
    body: `id=${encodeURIComponent(albumId)}&type=album`,
  });
  if (!res.ok) throw new Error(`Album images fetch failed: ${res.status}`);
  const html = await res.text();

  const mainImageM = html.match(/<div id="curImage"><img [^>]*src="([^"]+)"/i);
  const mainImage = mainImageM?.[1] ? cleanImageUrl(mainImageM[1]) : null;

  const images: AlbumImageItem[] = [];
  for (const m of html.matchAll(/<div id="img_(\d+)" class="thumbnail([^"]*)">[\s\S]*?<img [^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*title="([^"]*)"/g)) {
    const id = m[1];
    const classes = m[2];
    const src = m[3];
    const alt = m[4];
    const title = m[5];
    if (id && src) {
      images.push({
        id: parseId(id) ?? 0,
        title: decodeEntities(title || alt || ""),
        src: cleanImageUrl(src),
        isDefault: classes?.includes("selected") ?? false,
      });
    }
  }

  return {
    albumId: parseId(albumId) ?? 0,
    mainImage,
    images,
  };
}

