import { BASE } from "../constants.js";
import type { AlbumBlock } from "../types.js";

export async function scrapeAlbumBlocks(res: Response): Promise<AlbumBlock[]> {
  const albums: AlbumBlock[] = [];
  let cur: Partial<AlbumBlock> | null = null;
  let ratingValue = "";
  let lastRatingType: "critic" | "user" | null = null;

  await new HTMLRewriter()
    .on(".albumBlock", {
      element(el) {
        cur = {
          url: "",
          artist: "",
          title: "",
          cover: "",
          mediaType: el.getAttribute("data-type") ?? "",
          releaseDate: "",
          criticScore: null,
          criticCount: null,
          userScore: null,
          userCount: null,
          mustHear: false,
        };
        albums.push(cur as AlbumBlock);
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
        if (cur) cur.cover = el.getAttribute("src") ?? "";
      },
    })
    .on(".albumBlock .image .mustHear", {
      element() {
        if (cur) cur.mustHear = true;
      },
    })
    .on(".albumBlock .artistTitle", {
      text(t) {
        if (cur) cur.artist = (cur.artist ?? "") + t.text;
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

  return albums.map((a) => ({
    ...a,
    artist: (a.artist ?? "").trim(),
    title: (a.title ?? "").trim(),
    releaseDate: (a.releaseDate ?? "").trim(),
  }));
}
