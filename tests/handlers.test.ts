import { describe, it, expect } from "bun:test";
import worker from "../src/index.ts";
import { createMockEnv, mockFetch } from "./test_utils.js";

function req(path: string, method = "GET"): Request {
  return new Request(`http://localhost${path}`, { method });
}

describe("HTTP Methods & Cache HIT/MISS", () => {
  it("HEAD request returns empty body with headers", async () => {
    const env = createMockEnv();
    const res = await worker.fetch(req("/health", "HEAD"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("POST request returns 405 Method Not Allowed", async () => {
    const env = createMockEnv();
    const res = await worker.fetch(req("/health", "POST"), env);
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toContain("GET");
  });

  it("DELETE request returns 405 Method Not Allowed", async () => {
    const env = createMockEnv();
    const res = await worker.fetch(req("/health", "DELETE"), env);
    expect(res.status).toBe(405);
  });

  it("serves from cache on HIT", async () => {
    const cachedData = JSON.stringify({ cached: true });
    const env = createMockEnv({
      "/discover": cachedData,
    });

    const res = await worker.fetch(req("/discover"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    const json = (await res.json()) as { cached: boolean };
    expect(json.cached).toBe(true);
  });

  it("bypasses cache when cache=false", async () => {
    const cachedData = JSON.stringify({ cached: true });
    const env = createMockEnv({
      "/discover": cachedData,
    });

    const restore = mockFetch(async () => new Response('<div class="albumBlock"><div class="albumTitle">Fresh</div></div>', { status: 200 }));
    try {
      const res = await worker.fetch(req("/discover?cache=false"), env);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache")).toBe("MISS");
    } finally {
      restore();
    }
  });
});

describe("Query parameter routing & response shapes", () => {
  const env = createMockEnv();

  it("handles /songs/top with year alias and period", async () => {
    const songHtml = `
      <div class="songRow">
        <div class="songTitle"><a href="/song/1-runaway/">Runaway</a></div>
        <div class="artistTitle"><a href="/artist/1-kanye/">Kanye West</a></div>
        <div class="scoreValue">96</div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(songHtml, { status: 200 }));

    try {
      const resYear = await worker.fetch(req("/songs/top?year=2025"), env);
      expect(resYear.status).toBe(200);
      const jsonYear = (await resYear.json()) as { period: string; page: number; songs: unknown[] };
      expect(jsonYear.period).toBe("2025");
      expect(jsonYear.page).toBe(1);

      const resPeriod = await worker.fetch(req("/songs/top?period=2024&page=2"), env);
      expect(resPeriod.status).toBe(200);
      const jsonPeriod = (await resPeriod.json()) as { period: string; page: number; songs: unknown[] };
      expect(jsonPeriod.period).toBe("2024");
      expect(jsonPeriod.page).toBe(2);
    } finally {
      restore();
    }
  });

  it("handles /releases/by-date with week, month, decade, and genre", async () => {
    const albumHtml = `<div class="albumBlock"><div class="albumTitle">Test</div></div>`;
    const restore = mockFetch(async () => new Response(albumHtml, { status: 200 }));

    try {
      const resWeek = await worker.fetch(req("/releases/by-date?year=2025&week=10&genre=rock"), env);
      expect(resWeek.status).toBe(200);
      const jsonWeek = (await resWeek.json()) as { year: number; week: number | null; page: number };
      expect(jsonWeek.year).toBe(2025);
      expect(jsonWeek.week).toBe(10);

      const resMonth = await worker.fetch(req("/releases/by-date?year=2025&month=january&page=2"), env);
      expect(resMonth.status).toBe(200);
      const jsonMonth = (await resMonth.json()) as { year: number; month: string | null; page: number };
      expect(jsonMonth.year).toBe(2025);
      expect(jsonMonth.month).toBe("january");
      expect(jsonMonth.page).toBe(2);

      const resDecade = await worker.fetch(req("/releases/by-date?decade=2010s"), env);
      expect(resDecade.status).toBe(200);
      const jsonDecade = (await resDecade.json()) as { decade: string | null };
      expect(jsonDecade.decade).toBe("2010s");
    } finally {
      restore();
    }
  });

  it("handles /releases/vibe with valid parameters", async () => {
    const albumHtml = `<div class="albumBlock"><div class="albumTitle">Vibe Album</div></div>`;
    const restore = mockFetch(async () => new Response(albumHtml, { status: 200 }));

    try {
      const res = await worker.fetch(req("/releases/vibe?vibe=chill&year=2024&sort=user&page=2"), env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { vibe: string; year: string; sort: string; page: number; albums: unknown[] };
      expect(json.vibe).toBe("chill");
      expect(json.year).toBe("2024");
      expect(json.sort).toBe("user");
      expect(json.page).toBe(2);
    } finally {
      restore();
    }
  });

  it("handles /must-hear with period combinations", async () => {
    const albumHtml = `<div class="albumBlock"><div class="albumTitle">Must Hear</div></div>`;
    const restore = mockFetch(async () => new Response(albumHtml, { status: 200 }));

    try {
      const resDecade = await worker.fetch(req("/must-hear?decade=2010s&page=2"), env);
      expect(resDecade.status).toBe(200);
      const jsonDecade = (await resDecade.json()) as { year: string; page: number };
      expect(jsonDecade.year).toBe("2010s");
      expect(jsonDecade.page).toBe(2);

      const resYear = await worker.fetch(req("/must-hear?year=2024"), env);
      expect(resYear.status).toBe(200);
      const jsonYear = (await resYear.json()) as { year: string; page: number };
      expect(jsonYear.year).toBe("2024");

      const resAll = await worker.fetch(req("/must-hear"), env);
      expect(resAll.status).toBe(200);
      const jsonAll = (await resAll.json()) as { year: string; page: number };
      expect(jsonAll.year).toBe("all");
    } finally {
      restore();
    }
  });

  it("decodes HTML entities in /must-hear both on fresh scrape and on cache hit", async () => {
    const rawAlbumHtml = `
      <div class="albumBlock" data-type="">
        <div class="image mustHear">
          <a href="/album/1785197-akriila-lucy-miro-al-mundo-y-noto-que-esta-girando.php">
            <div class="mustHear"></div>
            <img src="https://cdn2.albumoftheyear.org/200x0/album/1785197-lucy-miro-al-mundo-y-noto-que-esta-girando_200643.jpg" />
          </a>
        </div>
        <div class="artistTitle">AKRIILA</div>
        <div class="albumTitle">lucy mir&oacute; al mundo y not&oacute; que est&aacute; girando</div>
        <div class="type">2026</div>
        <div class="ratingRow">
          <div class="ratingBlock"><div class="rating">84</div></div>
          <div class="ratingText">user score</div>
          <div class="ratingText">(1,717)</div>
        </div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(rawAlbumHtml, { status: 200 }));

    try {
      // 1. Fresh scrape decodes entities
      const freshEnv = createMockEnv();
      const resFresh = await worker.fetch(req("/must-hear?year=2026&cache=false"), freshEnv);
      expect(resFresh.status).toBe(200);
      const jsonFresh = (await resFresh.json()) as { albums: Array<{ title: string; artist: string }> };
      expect(jsonFresh.albums[0]?.title).toBe("lucy miró al mundo y notó que está girando");
      expect(jsonFresh.albums[0]?.artist).toBe("AKRIILA");

      // 2. Cache HIT with stale/un-decoded entities in KV is sanitized on return
      const staleCached = JSON.stringify({
        year: "2026",
        page: 1,
        albums: [
          {
            url: "https://www.albumoftheyear.org/album/1785197-akriila-lucy-miro-al-mundo-y-noto-que-esta-girando.php",
            artist: "AKRIILA",
            title: "lucy mir&oacute; al mundo y not&oacute; que est&aacute; girando",
            mustHear: true,
          },
        ],
      });
      const cachedEnv = createMockEnv({
        "/must-hear?year=2026": staleCached,
      });
      const resCached = await worker.fetch(req("/must-hear?year=2026"), cachedEnv);
      expect(resCached.status).toBe(200);
      expect(resCached.headers.get("X-Cache")).toBe("HIT");
      const jsonCached = (await resCached.json()) as { albums: Array<{ title: string }> };
      expect(jsonCached.albums[0]?.title).toBe("lucy miró al mundo y notó que está girando");
    } finally {
      restore();
    }
  });

  it("handles /news and /lists with query filters", async () => {
    const newsHtml = `<div class="mediaContainer" id="link1"><div class="content"><div class="title"><a href="/l/1/">News</a></div></div></div>`;
    const listHtml = `<div class="listColumn"><div class="listPub"><a href="/list/1/">List</a></div></div>`;
    const restore = mockFetch(async (input) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      if (url.includes("/lists.php")) return new Response(listHtml, { status: 200 });
      return new Response(newsHtml, { status: 200 });
    });

    try {
      const resNews = await worker.fetch(req("/news?type=new&page=2"), env);
      expect(resNews.status).toBe(200);
      const jsonNews = (await resNews.json()) as { page: number; type: string };
      expect(jsonNews.type).toBe("new");
      expect(jsonNews.page).toBe(2);

      const resLists = await worker.fetch(req("/lists?year=2024&sort=newest&page=3"), env);
      expect(resLists.status).toBe(200);
      const jsonLists = (await resLists.json()) as { year: number | null; sort: string | null; page: number };
      expect(jsonLists.year).toBe(2024);
      expect(jsonLists.sort).toBe("newest");
      expect(jsonLists.page).toBe(3);
    } finally {
      restore();
    }
  });

  it("handles /guidelines type parameter", async () => {
    const guideHtml = `<div class="heading">Comment Guidelines</div><div class="rules">Rule 1</div>`;
    const restore = mockFetch(async () => new Response(guideHtml, { status: 200 }));

    try {
      const res = await worker.fetch(req("/guidelines?type=comment"), env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { title: string };
      expect(json.title).toContain("Comment Guidelines");
    } finally {
      restore();
    }
  });

  it("handles /list/summary, /year-end, and /songs/best routes", async () => {
    const summaryHtml = `
      <div class="grayBox">These numbers are obtained from the <strong>113</strong> lists</div>
      <div class="listSummaryRow">
        <div class="listSummaryRank">1</div>
        <h2 class="albumTitle listSummary"><a href="/album/1-lux.php">LUX</a></h2>
        <h3 class="artistTitle listSummary"><a href="/artist/1-rosalia/">ROSALÍA</a></h3>
        <div class="summaryPoints"><a href="#">400 Points</a></div>
        <div class="pointsTable"><div class="summaryPointsMisc"><div class="head">1st Place</div><div class="count">10</div></div></div>
      </div>
    `;
    const songsHtml = `
      <div class="listSummaryRow">
        <div class="listSummaryRank song">1</div>
        <h2 class="artistTitle listSummary song"><a href="/artist/1/">Artist</a></h2>
        <h3 class="albumTitle listSummary song"><a href="/song/1/">Song</a></h3>
        <div class="pointsTable song"><div class="summaryPointsMisc"><div class="head">Points</div><div class="count">50</div></div></div>
      </div>
    `;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/songs/best/")) return new Response(songsHtml, { status: 200 });
      return new Response(summaryHtml, { status: 200 });
    });

    try {
      const resSum = await worker.fetch(req("/list/summary?year=2025&genre=hip-hop"), env);
      expect(resSum.status).toBe(200);
      const jsonSum = (await resSum.json()) as { year: number; genre: string; items: unknown[] };
      expect(jsonSum.year).toBe(2025);
      expect(jsonSum.genre).toBe("hip-hop");
      expect(jsonSum.items.length).toBe(1);

      const resYe = await worker.fetch(req("/year-end?year=2025"), env);
      expect(resYe.status).toBe(200);
      const jsonYe = (await resYe.json()) as { year: number; items: unknown[] };
      expect(jsonYe.year).toBe(2025);
      expect(jsonYe.items.length).toBe(1);

      const resSongs = await worker.fetch(req("/songs/best?year=2025&sort=lists"), env);
      expect(resSongs.status).toBe(200);
      const jsonSongs = (await resSongs.json()) as { year: number; sort: string; songs: unknown[] };
      expect(jsonSongs.year).toBe(2025);
      expect(jsonSongs.sort).toBe("lists");
      expect(jsonSongs.songs.length).toBe(1);
    } finally {
      restore();
    }
  });

  it("handles /user/year-end and /user/distribution routes", async () => {
    const userYearEndHtml = `
      <div class="userName"><a title="testuser">Test User</a></div>
      <ol class="ranked"><li data-album-index="0"><a href="/album/1/">Artist - Album</a></li></ol>
      <section class="moreInfo"><div><span class="category">genres</span> / pop</div></section>
    `;
    const distHtml = `<table class="dist"><tr class="distRow"><td class="distLabel">100</td><td class="distCount">10</td></tr></table>`;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("changeDistribution.php")) return new Response(distHtml, { status: 200 });
      return new Response(userYearEndHtml, { status: 200 });
    });

    try {
      const resYe = await worker.fetch(req("/user/year-end?username=testuser&year=2025"), env);
      expect(resYe.status).toBe(200);
      const jsonYe = (await resYe.json()) as { username: string; year: number; albums: unknown[] };
      expect(jsonYe.username).toBe("testuser");
      expect(jsonYe.year).toBe(2025);
      expect(jsonYe.albums.length).toBe(1);

      const resDist = await worker.fetch(req("/user/distribution?username=12345&format=singles"), env);
      expect(resDist.status).toBe(200);
      const jsonDist = (await resDist.json()) as { username: string; format: string; rows: unknown[] };
      expect(jsonDist.username).toBe("12345");
      expect(jsonDist.format).toBe("singles");
      expect(jsonDist.rows.length).toBe(1);
    } finally {
      restore();
    }
  });

  it("handles /genre/name, /user/artist-ratings, /album/likes, /album/in-library, and /album/images", async () => {
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("getGenreName.php")) return new Response("Rock", { status: 200 });
      if (url.includes("showArtistRatings.php")) {
        return new Response('<table><tr><td class="rank">1</td><td class="albumInfo"><div class="largeTitle"><a href="/album/1/">Album</a></div></td></tr></table>', { status: 200 });
      }
      if (url.includes("showMore.php")) {
        return new Response('<div class="userBlock ten"><a href="/user/u/"><div class="userName"><a href="/user/u/">User</a></div></div>', { status: 200 });
      }
      if (url.includes("showImage.php")) {
        return new Response('<div id="curImage"><img src="main.jpg" /></div><div id="img_0" class="thumbnail selected"><img src="t.jpg" alt="Cover" title="Cover" /></div>', { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    try {
      const resGenre = await worker.fetch(req("/genre/name?id=7"), env);
      expect(resGenre.status).toBe(200);
      const jsonGenre = (await resGenre.json()) as { id: string; name: string };
      expect(jsonGenre.id).toBe(7);
      expect(jsonGenre.name).toBe("Rock");

      const resArtist = await worker.fetch(req("/user/artist-ratings?username=123&artistId=10"), env);
      expect(resArtist.status).toBe(200);
      const jsonArtist = (await resArtist.json()) as { username: string; artistId: number; ratings: unknown[] };
      expect(jsonArtist.ratings.length).toBe(1);

      const resLikes = await worker.fetch(req("/album/likes?albumId=100"), env);
      expect(resLikes.status).toBe(200);
      const jsonLikes = (await resLikes.json()) as { users: unknown[] };
      expect(jsonLikes.users.length).toBe(1);

      const resLib = await worker.fetch(req("/album/in-library?albumId=100"), env);
      expect(resLib.status).toBe(200);
      const jsonLib = (await resLib.json()) as { users: unknown[] };
      expect(jsonLib.users.length).toBe(1);

      const resImg = await worker.fetch(req("/album/images?albumId=100"), env);
      expect(resImg.status).toBe(200);
      const jsonImg = (await resImg.json()) as { mainImage: string; images: unknown[] };
      expect(jsonImg.mainImage).toBe("main.jpg");
      expect(jsonImg.images.length).toBe(1);
    } finally {
      restore();
    }
  });

  it("handles /user/track-ratings, /comments, and corrections routes", async () => {
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("showUserTrackRatings.php")) {
        return new Response('<div class="albumHeadline small"><h1 class="albumTitle"><a href="#">Artist - Album</a></h1></div><table><tr><td class="trackNumber">1</td><td class="trackTitle"><a href="/song/1/">T1</a></td><td class="trackRating">100</td></tr></table>', { status: 200 });
      }
      if (url.includes("viewAllComments.php")) {
        return new Response('<div id="reply1" class="commentRow"><div class="commentUserName"><a href="#">User</a></div><div class="commentText">Comment</div></div>', { status: 200 });
      }
      if (url.includes("corrections")) {
        return new Response('<h1 class="albumTitle"><a href="#">Title</a></h1><div>Added on <strong>2024</strong></div>', { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    try {
      const resTrack = await worker.fetch(req("/user/track-ratings?username=123&albumId=456"), env);
      expect(resTrack.status).toBe(200);
      const jsonTrack = (await resTrack.json()) as { username: string; albumId: string; tracks: unknown[] };
      expect(jsonTrack.tracks.length).toBe(1);

      const resComm = await worker.fetch(req("/comments?type=user_review&itemId=999"), env);
      expect(resComm.status).toBe(200);
      const jsonComm = (await resComm.json()) as { type: string; itemId: string; comments: unknown[] };
      expect(jsonComm.comments.length).toBe(1);

      const resAlbCorr = await worker.fetch(req("/album/corrections?albumId=123"), env);
      expect(resAlbCorr.status).toBe(200);
      const jsonAlb = (await resAlbCorr.json()) as { title: string; addedOn: string };
      expect(jsonAlb.title).toBe("Title");

      const resArtCorr = await worker.fetch(req("/artist/corrections?slug=1-artist"), env);
      expect(resArtCorr.status).toBe(200);

      const resSongCorr = await worker.fetch(req("/song/corrections?songId=789"), env);
      expect(resSongCorr.status).toBe(200);
    } finally {
      restore();
    }
  });

  it("handles /releases/this-week/singles, /releases/decade, /releases/month, /releases/week, /user/perfect, and /critic/reviews", async () => {
    const albumHtml = `<div class="albumBlock"><div class="albumTitle">Test</div></div>`;
    const ratingHtml = `<div class="albumBlock" data-type="LP"><div class="artistTitle">Artist</div><div class="albumTitle">Album</div><div class="ratingRow"><div class="rating">100</div></div></div>`;
    const criticHtml = `<h1 class="headline">Critic Name</h1><div class="albumReviewRow"><div class="rating">90</div></div>`;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/user/")) return new Response(ratingHtml, { status: 200 });
      if (url.includes("/critic/")) return new Response(criticHtml, { status: 200 });
      return new Response(albumHtml, { status: 200 });
    });

    try {
      const resSingles = await worker.fetch(req("/releases/this-week/singles"), env);
      expect(resSingles.status).toBe(200);
      const jsonSingles = (await resSingles.json()) as { albums: unknown[] };
      expect(jsonSingles.albums.length).toBe(1);

      const resDecade = await worker.fetch(req("/releases/decade?decade=2020s"), env);
      expect(resDecade.status).toBe(200);
      const jsonDecade = (await resDecade.json()) as { decade: string; albums: unknown[] };
      expect(jsonDecade.decade).toBe("2020s");

      const resMonth = await worker.fetch(req("/releases/month?month=september-09"), env);
      expect(resMonth.status).toBe(200);
      const jsonMonth = (await resMonth.json()) as { month: string; albums: unknown[] };
      expect(jsonMonth.month).toBe("september-09");

      const resWeek = await worker.fetch(req("/releases/week?week=36"), env);
      expect(resWeek.status).toBe(200);
      const jsonWeek = (await resWeek.json()) as { week: number; albums: unknown[] };
      expect(jsonWeek.week).toBe(36);

      const resPerf = await worker.fetch(req("/user/perfect?username=testuser"), env);
      expect(resPerf.status).toBe(200);
      const jsonPerf = (await resPerf.json()) as { username: string; ratings: unknown[] };
      expect(jsonPerf.username).toBe("testuser");
      expect(jsonPerf.ratings.length).toBe(1);

      const resCrit = await worker.fetch(req("/critic/reviews?slug=1-critic"), env);
      expect(resCrit.status).toBe(200);
      const jsonCrit = (await resCrit.json()) as { name: string };
      expect(jsonCrit.name).toBe("Critic Name");
    } finally {
      restore();
    }
  });

  it("handles /ratings/sources and /ratings/genres routes", async () => {
    const sourcesHtml = `<div class="columns"><div><a href="/ratings/12-av-club/2026/1">AV Club</a></div></div>`;
    const genresHtml = `<div id="results"><div class="columns"><div><a href="/genre/7-rock/2026/">Rock</a></div></div></div>`;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("sourceSelect.php")) return new Response(sourcesHtml, { status: 200 });
      if (url.includes("genreSelect.php")) return new Response(genresHtml, { status: 200 });
      return new Response("{}", { status: 200 });
    });

    try {
      const resSrc = await worker.fetch(req("/ratings/sources?year=2026"), env);
      expect(resSrc.status).toBe(200);
      const jsonSrc = (await resSrc.json()) as { year: string; sources: unknown[] };
      expect(jsonSrc.year).toBe(2026);
      expect(jsonSrc.sources.length).toBe(1);

      const resGen = await worker.fetch(req("/ratings/genres?year=2026"), env);
      expect(resGen.status).toBe(200);
      const jsonGen = (await resGen.json()) as { year: number; genres: unknown[] };
      expect(jsonGen.year).toBe(2026);
      expect(jsonGen.genres.length).toBe(1);
    } finally {
      restore();
    }
  });

  it("handles /genres/autocomplete and /genre/autocomplete routes", async () => {
    const mockSuggestions = [{ id: "7", value: "Rock", link: "/genre/7-rock/" }];
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("albumGenreAutocomplete.php")) {
        return new Response(JSON.stringify(mockSuggestions), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    });

    try {
      const res = await worker.fetch(req("/genres/autocomplete?q=rock"), env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { query: string; suggestions: Array<{ id: string; name: string; slug: string; url: string }> };
      expect(json.query).toBe("rock");
      expect(json.suggestions.length).toBe(1);
      expect(json.suggestions[0]?.name).toBe("Rock");
      expect(json.suggestions[0]?.slug).toBe("7-rock");

      const resAlias = await worker.fetch(req("/genre/autocomplete?q=rock"), env);
      expect(resAlias.status).toBe(200);

      const resMissing = await worker.fetch(req("/genres/autocomplete"), env);
      expect(resMissing.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("handles /releases/year route and /releases with type filter", async () => {
    const albumHtml = `<div class="albumBlock"><div class="albumTitle">Year Album</div><div class="artistTitle">Artist</div><div class="type">2024</div></div>`;
    let requestedUrl = "";
    const restore = mockFetch(async (input) => {
      requestedUrl = String(input);
      return new Response(albumHtml, { status: 200 });
    });

    try {
      const res = await worker.fetch(req("/releases/year?year=2024&genre=rock&page=2"), env);
      expect(res.status).toBe(200);
      expect(requestedUrl).toContain("/2024/releases/2/");
      expect(requestedUrl).toContain("genre=rock");
      const json = (await res.json()) as { year: number; genre: string; page: number; albums: unknown[] };
      expect(json.year).toBe(2024);
      expect(json.genre).toBe("rock");
      expect(json.page).toBe(2);
      expect(json.albums.length).toBe(1);

      const resInvalid = await worker.fetch(req("/releases/year?year=24"), env);
      expect(resInvalid.status).toBe(400);

      const resMissing = await worker.fetch(req("/releases/year"), env);
      expect(resMissing.status).toBe(400);

      const resReleases = await worker.fetch(req("/releases?page=1&type=ep"), env);
      expect(resReleases.status).toBe(200);
      expect(requestedUrl).toContain("/releases/1/?type=ep");
      const jsonReleases = (await resReleases.json()) as { page: number; type: string; albums: unknown[] };
      expect(jsonReleases.type).toBe("ep");
      expect(jsonReleases.albums.length).toBe(1);
    } finally {
      restore();
    }
  });

  it("handles /artist/discography route", async () => {
    const artistHtml = `
      <h1 class="headline">Artist Name</h1>
      <div class="albumBlock" data-type="LP">
        <div class="artistTitle">Artist Name</div>
        <div class="albumTitle">Great Album</div>
        <div class="type">2020</div>
      </div>
    `;
    let requestedUrl = "";
    const restore = mockFetch(async (input) => {
      requestedUrl = String(input);
      return new Response(artistHtml, { status: 200 });
    });

    try {
      const res = await worker.fetch(req("/artist/discography?slug=30-radiohead&type=lp&sort=critic&page=1"), env);
      expect(res.status).toBe(200);
      expect(requestedUrl).toContain("/artist/30-radiohead/");
      expect(requestedUrl).toContain("type=lp");
      expect(requestedUrl).toContain("s=critic");
      const json = (await res.json()) as { slug: string; type: string; sort: string; page: number; sections: unknown[] };
      expect(json.slug).toBe("30-radiohead");
      expect(json.type).toBe("lp");
      expect(json.sort).toBe("critic");
      expect(json.sections).toBeDefined();

      const resMissing = await worker.fetch(req("/artist/discography"), env);
      expect(resMissing.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("handles /random/release as alias for /random/album", async () => {
    const albumHtml = `<script type="application/ld+json">{"@type":"MusicAlbum","name":"Kid A","byArtist":{"name":"Radiohead"}}</script>`;
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/random/")) {
        return new Response('<html><head><meta http-equiv="refresh" content="0; url=https://www.albumoftheyear.org/album/2-kid-a/"></head></html>', { status: 200 });
      }
      return new Response(albumHtml, { status: 200 });
    });

    try {
      const res = await worker.fetch(req("/random/release"), env);
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const json = (await res.json()) as { title: string; artist: string };
      expect(json.title).toBe("Kid A");
      expect(json.artist).toBe("Radiohead");
    } finally {
      restore();
    }
  });

  it("handles /album/credits and /album/stats routes", async () => {
    const creditsHtml = `<div class="sectionTitle">Production</div><div class="credit"><div class="name"><a href="/artist/1-producer/">Producer</a></div></div>`;
    const statsHtml = `<table><tr><td>Favorites</td><td>123</td></tr></table>`;
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("showAlbumCredits.php")) return new Response(creditsHtml, { status: 200 });
      if (url.includes("moreStatsAlbum.php")) return new Response(statsHtml, { status: 200 });
      return new Response("{}", { status: 200 });
    });

    try {
      const resCredits = await worker.fetch(req("/album/credits?albumId=2915"), env);
      expect(resCredits.status).toBe(200);
      const jsonCredits = (await resCredits.json()) as { albumId: number; credits: unknown[] };
      expect(jsonCredits.albumId).toBe(2915);
      expect(jsonCredits.credits).toBeDefined();

      const resCreditsSlug = await worker.fetch(req("/album/credits?slug=2915-outkast-aquemini"), env);
      expect(resCreditsSlug.status).toBe(200);

      const resCreditsMissing = await worker.fetch(req("/album/credits"), env);
      expect(resCreditsMissing.status).toBe(400);

      const resStats = await worker.fetch(req("/album/stats?albumId=2915"), env);
      expect(resStats.status).toBe(200);
      const jsonStats = (await resStats.json()) as { albumId: number; stats: unknown };
      expect(jsonStats.albumId).toBe(2915);
      expect(jsonStats.stats).toBeDefined();
    } finally {
      restore();
    }
  });
  it("handles /album minimal flag for stats, credits and artistImage", async () => {
    const albumHtml = `
      <script type="application/ld+json">{"@type":"MusicAlbum","name":"Aquemini","byArtist":{"name":"OutKast","url":"https://www.albumoftheyear.org/artist/1-outkast/"},"image":"https://cdn.albumoftheyear.org/album/2915.jpg","datePublished":"1998-09-29"}</script>
      <button class="showImage" data-id="2915"></button>
    `;
    const artistHtml = `
      <meta property="og:image" content="https://cdn.albumoftheyear.org/artists/outkast_1.jpg" />
      <meta property="og:url" content="https://www.albumoftheyear.org/artist/1-outkast/" />
      <h1 class="artistHeadline">OutKast</h1>
    `;
    const restore = mockFetch(async (input) => {
      const u = String(input);
      if (u.includes("/artist/")) return new Response(artistHtml, { status: 200 });
      return new Response(albumHtml, { status: 200 });
    });

    try {
      const resFull = await worker.fetch(req("/album?slug=2915-outkast-aquemini"), env);
      expect(resFull.status).toBe(200);
      const jsonFull = (await resFull.json()) as { artistImage: string | null };
      expect(jsonFull.artistImage).toBe("https://cdn.albumoftheyear.org/artists/outkast_1.jpg");

      const resMinimal = await worker.fetch(req("/album?slug=2915-outkast-aquemini&minimal=true"), env);
      expect(resMinimal.status).toBe(200);
      const jsonMinimal = (await resMinimal.json()) as { artistImage: string | null; stats: unknown; credits: unknown };
      expect(jsonMinimal.artistImage).toBeNull();
      expect(jsonMinimal.stats).toBeNull();
      expect(jsonMinimal.credits).toBeNull();
    } finally {
      restore();
    }
  });

  it("fills producer images on /album from credit photos by artist URL", async () => {
    const albumHtml = `
      <script type="application/ld+json">{"@type":"MusicAlbum","name":"My Beautiful Dark Twisted Fantasy","byArtist":{"name":"Kanye West","url":"https://www.albumoftheyear.org/artist/183-kanye-west/"},"image":"https://cdn.albumoftheyear.org/album/1998.jpg","datePublished":"2010-11-22"}</script>
      <button class="showImage" data-id="1998"></button>
      <div class="albumTopBox info">
        <div class="detailRow"><a href="/artist/183-kanye-west/">Kanye West</a> / Producer</div>
      </div>
    `;
    const artistHtml = `
      <meta property="og:image" content="https://cdn.albumoftheyear.org/artists/kanye-west_1586101900.jpg" />
      <meta property="og:url" content="https://www.albumoftheyear.org/artist/183-kanye-west/" />
      <h1 class="artistHeadline">Kanye West</h1>
    `;
    const creditsHtml = `
      <div class="sectionTitle">Producer</div>
      <div class="credit">
        <div class="photo"><img src="https://cdn.albumoftheyear.org/artists/sq/kanye-west_1586101900.jpg" /></div>
        <div class="name"><a href="/artist/183-kanye-west/">Kanye West</a></div>
        <div class="songs"><a>Production</a></div>
      </div>
    `;
    const restore = mockFetch(async (input, init) => {
      const u = String(input);
      if (u.includes("showAlbumCredits.php")) return new Response(creditsHtml, { status: 200 });
      if (u.includes("moreStatsAlbum.php")) return new Response("1,2,3,4,5", { status: 200 });
      if (u.includes("/artist/")) return new Response(artistHtml, { status: 200 });
      return new Response(albumHtml, { status: 200 });
    });

    try {
      const env = createMockEnv();
      const res = await worker.fetch(req("/album?slug=1998-kanye-west-mbdtf"), env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        artistImage: string | null;
        producers: Array<{ name: string; url: string; image: string | null }>;
      };
      expect(json.artistImage).toBe("https://cdn.albumoftheyear.org/artists/kanye-west_1586101900.jpg");
      expect(json.producers.length).toBe(1);
      // credit photo matched by artist URL, /sq/ stripped
      expect(json.producers[0]).toEqual({
        name: "Kanye West",
        url: "https://www.albumoftheyear.org/artist/183-kanye-west/",
        image: "https://cdn.albumoftheyear.org/artists/kanye-west_1586101900.jpg",
      });
    } finally {
      restore();
    }
  });

  it("handles /album/tracklist and /album/streaming routes", async () => {
    const albumHtml = `
      <script type="application/ld+json">{"@type":"MusicAlbum","name":"Aquemini","byArtist":{"name":"OutKast","url":"https://www.albumoftheyear.org/artist/1-outkast/"}}</script>
      <div id="tracklist"><table class="trackListTable"><tr><td class="trackNumber">1.</td><td class="trackTitle"><a href="/song/1-hold-on/">Hold On</a></td><td class="trackLength">3:00</td></tr></table></div>
      <div class="albumLinksFlex"><a href="https://open.spotify.com/album/123" title="Spotify" rel="nofollow">Spotify</a></div>
    `;
    const artistHtml = `
      <meta property="og:image" content="https://cdn.albumoftheyear.org/artists/outkast_1.jpg" />
      <meta property="og:url" content="https://www.albumoftheyear.org/artist/1-outkast/" />
      <h1 class="artistHeadline">OutKast</h1>
    `;
    const restore = mockFetch(async (input) => {
      const u = String(input);
      if (u.includes("/artist/")) return new Response(artistHtml, { status: 200 });
      return new Response(albumHtml, { status: 200 });
    });

    try {
      const resTracklist = await worker.fetch(req("/album/tracklist?slug=2915-outkast-aquemini"), env);
      expect(resTracklist.status).toBe(200);
      const jsonTracklist = (await resTracklist.json()) as { title: string; artist: string; artistUrl: string; artistImage: string | null; tracklist: Array<{ title: string; number: string }> };
      expect(jsonTracklist.title).toBe("Aquemini");
      expect(jsonTracklist.artist).toBe("OutKast");
      expect(jsonTracklist.artistUrl).toBe("https://www.albumoftheyear.org/artist/1-outkast/");
      expect(jsonTracklist.artistImage).toBe("https://cdn.albumoftheyear.org/artists/outkast_1.jpg");
      expect(jsonTracklist.tracklist.length).toBe(1);
      expect(jsonTracklist.tracklist[0]?.title).toBe("Hold On");

      const resStreaming = await worker.fetch(req("/album/streaming?slug=2915-outkast-aquemini"), env);
      expect(resStreaming.status).toBe(200);
      const jsonStreaming = (await resStreaming.json()) as { title: string; artistUrl: string; artistImage: string | null; streamingLinks: Array<{ platform: string; url: string }> };
      expect(jsonStreaming.title).toBe("Aquemini");
      expect(jsonStreaming.artistUrl).toBe("https://www.albumoftheyear.org/artist/1-outkast/");
      expect(jsonStreaming.artistImage).toBe("https://cdn.albumoftheyear.org/artists/outkast_1.jpg");
      expect(jsonStreaming.streamingLinks.length).toBe(1);
      expect(jsonStreaming.streamingLinks[0]?.platform).toBe("Spotify");

      const resStreamingAlias = await worker.fetch(req("/album/streaming-links?slug=2915-outkast-aquemini"), env);
      expect(resStreamingAlias.status).toBe(200);

      const resMissing = await worker.fetch(req("/album/tracklist"), env);
      expect(resMissing.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("handles /artist/top-songs alias and /user/stats and /user/favorites routes", async () => {
    const songsHtml = `
      <table class="trackListTable">
        <tr>
          <td class="trackNumber">1.</td>
          <td class="songAlbum"><a href="/song/1-song/">Song 1</a></td>
          <td class="rating">90</td>
        </tr>
      </table>
    `;
    const userHtml = `
      <h1 class="headline profile"><span>MusicGeek</span></h1>
      <div class="profileStat">1,250</div><div class="profileStatName">Ratings</div>
      <div class="profileStat">120</div><div class="profileStatName">Reviews</div>
      <div id="favBlock"><div class="albumBlock" data-type="LP"><div class="albumTitle">Favorite Album</div></div></section></div>
    `;
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/best-songs/")) return new Response(songsHtml, { status: 200 });
      return new Response(userHtml, { status: 200 });
    });

    try {
      const resArtistSongs = await worker.fetch(req("/artist/top-songs?slug=284-radiohead"), env);
      expect(resArtistSongs.status).toBe(200);
      const jsonArtistSongs = (await resArtistSongs.json()) as { slug: string; songs: unknown[] };
      expect(jsonArtistSongs.slug).toBe("284-radiohead");
      expect(jsonArtistSongs.songs.length).toBe(1);

      const resUserStats = await worker.fetch(req("/user/stats?username=musicgeek"), env);
      expect(resUserStats.status).toBe(200);
      const jsonUserStats = (await resUserStats.json()) as { username: string; stats: { ratings: string; reviews: string } };
      expect(jsonUserStats.username).toBe("MusicGeek");
      expect(jsonUserStats.stats.ratings).toBe(1250);
      expect(jsonUserStats.stats.reviews).toBe(120);

      const resUserFavs = await worker.fetch(req("/user/favorites?username=musicgeek"), env);
      expect(resUserFavs.status).toBe(200);
      const jsonUserFavs = (await resUserFavs.json()) as { username: string; favorites: unknown[] };
      expect(jsonUserFavs.username).toBe("MusicGeek");
      expect(jsonUserFavs.favorites.length).toBe(1);

      const resMissingUser = await worker.fetch(req("/user/stats"), env);
      expect(resMissingUser.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("handles /album/reviews and /corrections routes", async () => {
    const criticReviewHtml = `<div class="albumReviewRow"><div class="albumReviewHeader"><div class="publication"><a href="/publication/1-p4k/">Pitchfork</a></div></div><div class="albumReviewRating">9.5</div></div>`;
    const userReviewHtml = `<div class="albumReviewRow" id="review_123"><div class="userReviewName"><a href="/user/reviewer/">Reviewer</a></div><div class="rating">90</div><div class="albumReviewText user"><p>Amazing!</div></div>`;
    const correctionsHtml = `<div class="correction"><div class="user"><a href="/user/editor/">Editor</a></div><div class="change">Updated track title</div></div>`;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/criticSort.php")) return new Response(criticReviewHtml, { status: 200 });
      if (url.includes("/user-reviews/")) return new Response(userReviewHtml, { status: 200 });
      if (url.includes("/corrections/")) return new Response(correctionsHtml, { status: 200 });
      return new Response("{}", { status: 200 });
    });

    try {
      const resCritic = await worker.fetch(req("/album/reviews?slug=1-album"), env);
      expect(resCritic.status).toBe(200);
      const jsonCritic = (await resCritic.json()) as { slug: string; sort: string; reviews: unknown[] };
      expect(jsonCritic.slug).toBe("1-album");
      expect(jsonCritic.sort).toBe("highest");
      expect(jsonCritic.reviews.length).toBe(1);

      const resUser = await worker.fetch(req("/album/reviews?slug=1-album&type=user"), env);
      expect(resUser.status).toBe(200);
      const jsonUser = (await resUser.json()) as { slug: string; sort: string; reviews: unknown[] };
      expect(jsonUser.slug).toBe("1-album");
      expect(jsonUser.reviews.length).toBe(1);

      const resCorrections = await worker.fetch(req("/corrections?type=album&id=1"), env);
      expect(resCorrections.status).toBe(200);
      const jsonCorr = (await resCorrections.json()) as { id: number };
      expect(jsonCorr.id).toBe(1);

      const resInvalidType = await worker.fetch(req("/corrections?type=invalid&id=1"), env);
      expect(resInvalidType.status).toBe(400);

      const resMissingId = await worker.fetch(req("/corrections?type=album"), env);
      expect(resMissingId.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("handles /random/genre, /random/song, and /random/must-hear routes", async () => {
    const genreHtml = `<h2><a href="/genre/7-rock/">Rock</a></h2><div class="albumBlock"><div class="albumTitle">Album</div></div>`;
    const songHtml = `<table class="trackListTable"><tr><td class="trackNumber">1.</td><td class="songAlbum"><a href="/song/1-song/">Song 1</a></td><td class="rating">90</td></tr></table>`;
    const mustHearHtml = `<div class="albumBlock"><div class="albumTitle">Must Hear Album</div></div>`;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/genre.php")) return new Response(genreHtml, { status: 200 });
      if (url.includes("/songs/") || url.includes("/best-songs/")) return new Response(songHtml, { status: 200 });
      if (url.includes("/must-hear/")) return new Response(mustHearHtml, { status: 200 });
      return new Response("{}", { status: 200 });
    });

    try {
      const resGenre = await worker.fetch(req("/random/genre"), env);
      expect(resGenre.status).toBe(200);
      expect(resGenre.headers.get("Cache-Control")).toBe("no-store");
      const jsonGenre = (await resGenre.json()) as { genre: { name: string } };
      expect(jsonGenre.genre.name).toBe("Rock");

      const resSong = await worker.fetch(req("/random/song?period=2024"), env);
      expect(resSong.status).toBe(200);
      expect(resSong.headers.get("Cache-Control")).toBe("no-store");
      const jsonSong = (await resSong.json()) as { period: string; song: { title: string } };
      expect(jsonSong.period).toBe("2024");
      expect(jsonSong.song.title).toBe("Song 1");

      const resMustHear = await worker.fetch(req("/random/must-hear?year=2020"), env);
      expect(resMustHear.status).toBe(200);
      expect(resMustHear.headers.get("Cache-Control")).toBe("no-store");
      const jsonMustHear = (await resMustHear.json()) as { album: { title: string } };
      expect(jsonMustHear.album.title).toBe("Must Hear Album");

      const resMustHearInvalid = await worker.fetch(req("/random/must-hear?year=20"), env);
      expect(resMustHearInvalid.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("handles /search/all and /news/{type} routes", async () => {
    const newsHtml = `<div class="mediaContainer" id="link1"><div class="content"><div class="title"><a href="/l/1-item/">News Title</a></div><div class="source"><a href="https://pitchfork.com">Pitchfork</a></div></div></div>`;
    const restore = mockFetch(async () => new Response(newsHtml, { status: 200 }));

    try {
      const resNewsNew = await worker.fetch(req("/news/new"), env);
      expect(resNewsNew.status).toBe(200);
      const jsonNewsNew = (await resNewsNew.json()) as { type: string; page: number; items: unknown[] };
      expect(jsonNewsNew.type).toBe("new");
      expect(jsonNewsNew.items.length).toBe(1);

      const resNewsComm = await worker.fetch(req("/news/comment"), env);
      expect(resNewsComm.status).toBe(200);
      const jsonNewsComm = (await resNewsComm.json()) as { type: string };
      expect(jsonNewsComm.type).toBe("comment");
    } finally {
      restore();
    }
  });
});
