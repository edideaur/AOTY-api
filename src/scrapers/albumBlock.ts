import { BASE, decodeEntities, cleanImageUrl, parseCount, parseScore, parseDateToTimestamp } from "../constants.js";
import type { AlbumBlock } from "../types.js";

/** Audience scope from a must-hear badge wrapper class (e.g. "image mustHear both"). */
export function mustHearScopeFromClass(classAttr: string | null | undefined): "both" | "user" | "critic" | null {
  if (!classAttr) return null;
  const cls = ` ${classAttr} `;
  if (!cls.includes("mustHear")) return null;
  if (cls.includes(" both ")) return "both";
  if (cls.includes(" user ")) return "user";
  return "critic";
}

type RawAlbumBlock = {
  url: string;
  artist: string;
  artistUrl: string;
  title: string;
  cover: string;
  mediaType: string;
  releaseDate: string;
  criticScore: string | null;
  criticCount: string | null;
  userScore: string | null;
  userCount: string | null;
  mustHear: boolean;
  mustHearScope: "both" | "user" | "critic" | null;
  locked: boolean;
};

export async function scrapeAlbumBlocks(res: Response): Promise<AlbumBlock[]> {
  const rawAlbums: RawAlbumBlock[] = [];
  let cur: RawAlbumBlock | null = null;
  let ratingValue = "";
  let lastRatingType: "critic" | "user" | null = null;

  await new HTMLRewriter()
    .on(".albumBlock", {
      element(el) {
        cur = {
          url: "",
          artist: "",
          artistUrl: "",
          title: "",
          cover: "",
          mediaType: el.getAttribute("data-type") ?? "",
          releaseDate: "",
          criticScore: null,
          criticCount: null,
          userScore: null,
          userCount: null,
          mustHear: false,
          mustHearScope: null,
          locked: false,
        };
        rawAlbums.push(cur);
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
    // Locked (no-cover art) releases render .noCover instead of an <img>
    .on(".albumBlock .noCover", {
      element() {
        if (cur) cur.locked = true;
      },
    })
    // Audience scope lives on the wrapping .image (mustHear both|user) on live pages
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
    .on(".albumBlock .artistTitle", {
      text(t) {
        if (cur) cur.artist = (cur.artist ?? "") + t.text;
      },
    })
    .on(".albumBlock a", {
      element(el) {
        // artistTitle is sometimes a link (or wrapped in one); first /artist/ href wins.
        // Plain-text artist names leave artistUrl empty.
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
    .on(".albumBlock .type", {
      text(t) {
        if (cur) cur.releaseDate = (cur.releaseDate ?? "") + t.text;
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
        }
      },
    })
    .transform(res)
    .arrayBuffer();

  return rawAlbums.map((a) => {
    const releaseDate = decodeEntities(a.releaseDate.trim());
    return {
      url: a.url,
      artist: decodeEntities(a.artist.trim()),
      artistUrl: a.artistUrl,
      artistImage: null,
      title: decodeEntities(a.title.trim()),
      releaseDate,
      releaseDateTimestamp: parseDateToTimestamp(releaseDate),
      cover: cleanImageUrl(a.cover.trim()),
      mediaType: a.mediaType,
      criticScore: parseScore(a.criticScore),
      criticCount: parseCount(a.criticCount),
      userScore: parseScore(a.userScore),
      userCount: parseCount(a.userCount),
      mustHear: a.mustHear,
      mustHearScope: a.mustHearScope,
      locked: a.locked ?? false,
    };
  });
}
