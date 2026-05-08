import { fetchAoty, json, extractNumbers, stripHtml } from "../utils";
import type { Album, Review, JSONResponse } from "../types";

export const handleAlbum = async (artistQuery: string, albumQuery: string): Promise<JSONResponse> => {
  try {
    const searchUrl = `/search/albums/?q=${encodeURIComponent(`${artistQuery} - ${albumQuery}`)}`;

    const searchRes = await fetchAoty(searchUrl);
    let albumPageUrl: string | null = null;

    await new HTMLRewriter().on("div.albumBlock a", {
      element(el) {
        if (!albumPageUrl) {
          const href = el.getAttribute("href");
          if (href) albumPageUrl = `https://www.albumoftheyear.org${href}`;
        }
      },
    }).transform(searchRes).arrayBuffer();

    if (!albumPageUrl) return json({ error: "Album not found" }, 404);

    const albumRes = await fetchAoty(albumPageUrl);

    let criticScore = "";
    let userScore = "";
    let criticReviewsRaw = "";
    let userReviewsRaw = "";
    let reviewSelector = 0;

    const reviews: Review[] = [];
    let currentReview: Review | null = null;
    let inReviewText = false;
    let inPublication = false;
    let inAuthor = false;

    await new HTMLRewriter()
      .on('a[href="#critics"]', {
        text(t) { criticScore += t.text; }
      })
      .on('a[href="#users"]', {
        text(t) { userScore += t.text; }
      })
      .on("div.text.numReviews", {
        element() { reviewSelector++; },
        text(t) {
          if (reviewSelector === 1) criticReviewsRaw += t.text;
          if (reviewSelector === 2) userReviewsRaw += t.text;
        }
      })
      .on("div.albumReviewRow", {
        element() {
          currentReview = { score: "", publication: "", author: "", text: "", image: "", link: "" };
          reviews.push(currentReview);
          inReviewText = false;
          inPublication = false;
          inAuthor = false;
        }
      })
      .on("div.albumReviewRating", {
        text(t) {
          if (currentReview) currentReview.score += t.text;
        }
      })
      .on("div.albumReviewImage img", {
        element(el) {
          if (currentReview) currentReview.image = el.getAttribute("src") || "";
        }
      })
      .on("div.publication a", {
        element(el) { 
          inPublication = true;
          if (currentReview) {
            const href = el.getAttribute("href");
            if (href && href.startsWith("http")) currentReview.link = href;
          }
        },
        text(t) {
          if (currentReview && inPublication) currentReview.publication += t.text;
        }
      })
      .on("div.author a", {
        element() { inAuthor = true; },
        text(t) {
          if (currentReview && inAuthor) currentReview.author += t.text;
        }
      })
      .on("div.albumReviewText", {
        element() {
          inReviewText = true;
          inPublication = false;
          inAuthor = false;
        }
      })
      .on("div.albumReviewText *", {
        text(t) {
          if (currentReview && inReviewText) currentReview.text += t.text;
        }
      })
      .transform(albumRes)
      .arrayBuffer();

    const album: Album = {
      artist: artistQuery,
      album: albumQuery,
      url: albumPageUrl,
      critic: {
        score: criticScore.trim() || "N/A",
        count: extractNumbers(criticReviewsRaw),
        reviews: reviews
          .slice(0, 50)
          .filter((r): r is Review => !!r.publication.trim() && !!r.link)
          .map((r) => ({
            score: r.score.trim(),
            publication: r.publication.trim(),
            author: r.author.trim(),
            text: stripHtml(r.text).slice(0, 500),
            image: r.image,
            link: r.link,
          })),
      },
      user: {
        score: userScore.trim() || "N/A",
        count: extractNumbers(userReviewsRaw),
      },
    };

    return json(album);
  } catch {
    return json({ error: "Failed to fetch album" }, 500);
  }
};