export default {
  async fetch(request) {
    const url = new URL(request.url);
    const albumQuery = url.searchParams.get("album");
    const artistQuery = url.searchParams.get("artist");

    if (!albumQuery || !artistQuery) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    };

    try {
      const fullSearchQuery = `${artistQuery} - ${albumQuery}`;
      const searchUrl = `https://www.albumoftheyear.org/search/albums/?q=${encodeURIComponent(fullSearchQuery)}`;
      
      const searchRes = await fetch(searchUrl, { headers });
      if (!searchRes.ok) throw new Error(`AOTY Search failed with status ${searchRes.status}`);

      let albumPageUrl = null;

      await new HTMLRewriter().on("div.albumBlock a", {
        element(el) {
          if (!albumPageUrl) {
            const href = el.getAttribute("href");
            if (href) albumPageUrl = `https://www.albumoftheyear.org${href}`;
          }
        },
      }).transform(searchRes).arrayBuffer();

      if (!albumPageUrl) {
        return new Response(JSON.stringify({ error: "Album not found" }), { 
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      const albumRes = await fetch(albumPageUrl, { headers });
      
      let criticScore = "";
      let userScore = "";
      let criticReviewsRaw = "";
      let userReviewsRaw = "";
      let numReviewsCount = 0;

      let reviews = [];
      let currentReview = null;
      let inReviewText = false;
      let inAuthor = false;
      let inPublication = false;

      const rewriter = new HTMLRewriter()
        .on('a[href="#critics"]', {
          text(t) { criticScore += t.text; }
        })
        .on('a[href="#users"]', {
          text(t) { userScore += t.text; }
        })
        .on('div.text.numReviews', {
          element() {
            numReviewsCount++;
          },
          text(t) {
            if (numReviewsCount === 1) criticReviewsRaw += t.text;
            if (numReviewsCount === 2) userReviewsRaw += t.text;
          }
        })
        .on("div.albumReviewRow", {
          element() {
            currentReview = { score: "", publication: "", author: "", text: "", image: "" };
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
          element() { inPublication = true; },
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
        });

      await rewriter.transform(albumRes).arrayBuffer();

      const extractNumbers = (str) => {
        const match = str.match(/[\d,]+/);
        return match ? match[0] : "N/A";
      };

      return new Response(JSON.stringify({
        artist: artistQuery,
        album: albumQuery,
        url: albumPageUrl,
        critic: {
          score: criticScore.trim() || "N/A",
          count: extractNumbers(criticReviewsRaw),
          reviews: reviews.slice(0, 50).filter(r => r.publication.trim()).map(r => ({
            score: r.score.trim(),
            publication: r.publication.trim(),
            author: r.author.trim(),
            text: r.text.trim(),
            image: r.image || ""
          }))
        },
        user: {
          score: userScore.trim() || "N/A",
          count: extractNumbers(userReviewsRaw)
        }
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};