import { describe, it, expect } from "bun:test";
import { scrapeUserProfile, scrapeUserReviewBlocks, scrapeUsersCommunity } from "../src/scrapers/user.js";
import { scrapeNewsPage } from "../src/scrapers/news.js";
import { scrapeRatingsChart, scrapeTopArtists } from "../src/scrapers/charts.js";
import { scrapeListDetail } from "../src/scrapers/lists.js";
import { scrapeCriticPage, scrapeLabelPage, scrapePublicationPage } from "../src/scrapers/entities.js";
import { scrapeSiteUpdates } from "../src/scrapers/social.js";
import { mockFetch } from "./test_utils.js";

describe("user profile activity rails", () => {
  const html = `
    <h1 class="headline profile"><span>teamrhi</span></h1>
    <div class="profileImage"><img src="https://cdn.aoty.org/avatar.jpg" /></div>
    <div class="profileStatContainer"><a href="/user/teamrhi/ratings/"><div class="profileStat">100</div><div class="profileStatName">Ratings</div></a></div>
    <div class="profileStatContainer"><a href="/user/teamrhi/reviews/"><div class="profileStat">5</div><div class="profileStatName">Reviews</div></a></div>
    <div class="profileStatContainer"><a href="/user/teamrhi/lists/"><div class="profileStat">2</div><div class="profileStatName">Lists</div></a></div>
    <div class="profileStatContainer"><a href="/user/teamrhi/following/"><div class="profileStat">3</div><div class="profileStatName">Following</div></a></div>
    <div class="profileStatContainer"><a href="/user/teamrhi/followers/"><div class="profileStat">4</div><div class="profileStatName">Followers</div></a></div>
    <h2 class="sectionHeading"><a href="/user/teamrhi/ratings/">Recently Rated</a></h2>
    <div class="albumBlock five"><div class="image"><a href="/album/197171-oliver-tree-ugly-is-beautiful.php"><img src="https://cdn2.aoty.org/200x0/album/ugly.jpg" /></a></div>
    <a href="/artist/39619-oliver-tree/"><div class="artistTitle">Oliver Tree</div></a>
    <div class="albumTitle">Ugly Is Beautiful</div>
    <div class="type functions">2020 • LP</div>
    <div class="ratingRowContainer"><div class="ratingBlock"><div class="rating">91</div></div><div class="ratingText">Jun 15</div>
    <a href="/user/teamrhi/album/197171-ugly-is-beautiful/"><div class="icon"><i class="fa-regular fa-file-lines"></i></div></a>
    <a href="/user/teamrhi/liked/albums/"><div class="icon"><i class="fas fa-heart"></i></div></a>
    </div></div>
    <h2 class="sectionHeading"><a href="/user/teamrhi/ratings/highest/?y=2026">Best of 2026</a></h2>
    <div class="albumBlock five"><div class="image"><a href="/album/1211507-oliver-tree-love-you-madly.php"><img src="https://cdn2.aoty.org/200x0/album/love.jpg" /></a></div>
    <a href="/artist/39619-oliver-tree/"><div class="artistTitle">Oliver Tree</div></a>
    <div class="albumTitle">Love You Madly</div>
    <div class="type functions">2026 • LP</div>
    <div class="ratingRowContainer"><div class="ratingBlock"><div class="rating">94</div></div><div class="ratingText">Jun 22</div></div></div>
    <h2 class="sectionHeading"><a href="/user/teamrhi/reviews/">Recent Reviews</a></h2>
    <div class="albumReviewRow" id="review_9542948">
    <div class="userReviewImage square"><a href="/user/teamrhi/album/197171-ugly-is-beautiful/"><img src="https://cdn.aoty.org/ugly.jpg" /></a></div>
    <div class="artistTitle"><a href="/artist/39619-oliver-tree/">Oliver Tree</a></div>
    <div class="albumTitle"><a href="/album/197171-ugly-is-beautiful.php">Ugly Is Beautiful</a></div>
    <div class="ratingBlock"><div class="rating">91</div></div>
    <div class="albumReviewText profile"><p>Great pop album <a class="gray" href="/user/teamrhi/album/197171-ugly-is-beautiful/">read more</a></p></div>
    <div class="review_likes">1</div>
    <div class="actionContainer" style="font-size: 14px;" title="16 Jun 2026 07:51:03 GMT">2mo</div>
    </div>
    <h2 class="sectionHeading"><a href="/user/teamrhi/lists/">Recent Lists</a></h2>
    <div class="userListRow profile"><div class="listTitle"><div><a href="/user/teamrhi/list/165632/best-albums-of-2023/">Best Albums of 2023</a></div></div>
    <a href="/user/teamrhi/list/165632/best-albums-of-2023/"><div class="covers"><img src="https://cdn2.aoty.org/100x0/album/a.jpg" /><img src="https://cdn2.aoty.org/100x0/album/b.jpg" /></div></a>
    <div class="listInfo">Updated 2y ago<span>25 albums</span><span>Ranked</span></div>
    <div class="listDescription">Greatest pop albums.</div></div>
    <div class="rightBox"><h2 class="sectionHeading"><a href="/user/teamrhi/tags/">Tags</a></h2><div class="tag"><a href="/user/teamrhi/tag/cringe/">cringe</a></div><div class="tag"><a href="/user/teamrhi/tag/underrated/">underrated</a></div></div>
    <div class="rightBox"><h2 class="sectionHeading"><a href="/user/teamrhi/following/">Following (3)</a></h2><a href="/user/anno/"><img src="https://cdn.aoty.org/user/thumbs/anno_1.jpg" alt="Anno" title="Anno" /></a><a href="/user/bob/"><img src="https://cdn.aoty.org/user/thumbs/bob_2.jpg" alt="Bob" /></a></div>
  `;

  it("parses rails and right-rail previews", async () => {
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const profile = await scrapeUserProfile("teamrhi");
      expect(profile.username).toBe("teamrhi");
      expect(profile.recentlyRated.length).toBe(1);
      expect(profile.recentlyRated[0]?.title).toBe("Ugly Is Beautiful");
      expect(profile.recentlyRated[0]?.userRating).toBe(91);
      expect(profile.recentlyRated[0]?.ratedDate).toBe("Jun 15");
      expect(profile.recentlyRated[0]?.reviewUrl).toBe("https://www.albumoftheyear.org/user/teamrhi/album/197171-ugly-is-beautiful/");
      expect(profile.recentlyRated[0]?.liked).toBe(true);
      expect(profile.recentlyRated[0]?.albumId).toBe(197171);
      expect(profile.bestOfYear?.year).toBe(2026);
      expect(profile.bestOfYear?.ratings.length).toBe(1);
      expect(profile.bestOfYear?.ratings[0]?.userRating).toBe(94);
      expect(profile.bestOfYear?.ratings[0]?.liked).toBe(false);
      expect(profile.recentReviews.length).toBe(1);
      expect(profile.recentReviews[0]?.username).toBe("teamrhi");
      expect(profile.recentReviews[0]?.artist).toBe("Oliver Tree");
      expect(profile.recentReviews[0]?.album).toBe("Ugly Is Beautiful");
      expect(profile.recentReviews[0]?.cover).toBe("https://cdn.aoty.org/ugly.jpg");
      expect(profile.recentReviews[0]?.rating).toBe(91);
      expect(profile.recentReviews[0]?.likes).toBe(1);
      expect(profile.recentReviews[0]?.date).toBe("16 Jun 2026 07:51:03 GMT");
      expect(profile.recentLists.length).toBe(1);
      expect(profile.recentLists[0]?.title).toBe("Best Albums of 2023");
      expect(profile.recentLists[0]?.username).toBe("teamrhi");
      expect(profile.recentLists[0]?.covers).toEqual(["https://cdn2.aoty.org/album/a.jpg", "https://cdn2.aoty.org/album/b.jpg"]);
      expect(profile.recentLists[0]?.description).toBe("Greatest pop albums.");
      expect(profile.recentLists[0]?.updatedAgo).toBe("2y ago");
      expect(profile.recentLists[0]?.albumCount).toBe(25);
      expect(profile.recentLists[0]?.ranked).toBe(true);
      expect(profile.tagsPreview).toEqual(["cringe", "underrated"]);
      expect(profile.followingPreview.length).toBe(2);
      expect(profile.followingPreview[0]).toEqual({ url: "https://www.albumoftheyear.org/user/anno/", name: "Anno", image: "https://cdn.aoty.org/user/thumbs/anno_1.jpg" });
    } finally {
      restore();
    }
  });
});

describe("review block exact dates", () => {
  it("reads actionContainer title timestamps", async () => {
    const html = `
      <div class="userReviewBlock">
        <div class="cover"><a href="/user/fan/album/1-x/"><img src="https://cdn.aoty.org/c.jpg" /></a></div>
        <div class="artistTitle"><a href="/artist/1-a/">A</a></div>
        <div class="albumTitle"><a href="/album/1-x/">X</a></div>
        <div class="userName"><a href="/user/fan/">fan</a></div>
        <div class="rating">90</div>
        <div class="reviewText">Nice</div>
        <div class="albumReviewLinks"><div class="actionContainer" title="04 Sep 2026 04:01:03 GMT">5d</div></div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const reviews = await scrapeUserReviewBlocks(new Response(html));
      expect(reviews.length).toBe(1);
      expect(reviews[0]?.date).toBe("04 Sep 2026 04:01:03 GMT");
    } finally {
      restore();
    }
  });
});

describe("news submitters", () => {
  it("splits submitter from postDate", async () => {
    const html = `
      <div class="mediaContainer" id="link123">
        <div class="content">
          <div class="title"><a href="/l/123-news/">Some News</a></div>
          <div class="source"><a href="https://pitchfork.com">Pitchfork</a></div>
          <div class="postDate">1d ago by <a href="/user/comboplanet/">comboplanet</a></div>
          <div class="points">10</div>
          <div class="comment_count">5</div>
        </div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const items = await scrapeNewsPage("http://mock/l/newsworthy/1/");
      expect(items.length).toBe(1);
      expect(items[0]?.date).toBe("1d ago");
      expect(items[0]?.submittedBy).toBe("comboplanet");
      expect(items[0]?.submittedByUrl).toBe("https://www.albumoftheyear.org/user/comboplanet/");
    } finally {
      restore();
    }
  });
});

describe("chart enrichment", () => {
  it("parses secondary genres, streaming links and must-hear scope", async () => {
    const html = `
      <div class="albumListRow" id="rank-1">
        <div class="albumListCover mustHear both"><img src="https://cdn.aoty.org/cov1.jpg" /></div>
        <div class="albumListTitle"><a itemprop="url" href="/album/1-x.php">Artist - Album</a></div>
        <div class="albumListDate">2026</div>
        <div class="albumListGenre"><a href="/genre/16-indie-folk/">Indie Folk</a>, <a href="/genre/37-singer-songwriter/">Singer-Songwriter</a> <div class="secondary-genres"><span class="secondary"><a href="/genre/104-folktronica/">Folktronica</a></span></div></div>
        <div class="albumListLinks"><a href="https://open.spotify.com/album/abc" rel="nofollow" data-track-action="Spotify"><div class="spotify"><span>Spotify</span></div></a><a href="https://music.apple.com/x" rel="nofollow" data-track-action="Apple Music">Apple Music</a></div>
        <div class="albumListScoreContainer"><div class="scoreValueContainer"><div class="scoreValue">85</div></div><div class="scoreText">1,000 ratings</div></div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const items = await scrapeRatingsChart("/ratings/6-highest-rated/2026/1");
      expect(items.length).toBe(1);
      expect(items[0]?.genres).toEqual(["Indie Folk", "Singer-Songwriter"]);
      expect(items[0]?.secondaryGenres).toEqual(["Folktronica"]);
      expect(items[0]?.mustHear).toBe(true);
      expect(items[0]?.mustHearScope).toBe("both");
      expect(items[0]?.streamingLinks).toEqual([
        { platform: "Spotify", url: "https://open.spotify.com/album/abc" },
        { platform: "Apple Music", url: "https://music.apple.com/x" },
      ]);
    } finally {
      restore();
    }
  });

  it("parses top artist scores", async () => {
    const html = `
      <div class="artistBlock"><div class="image"><a href="/artist/1-radiohead/"><img src="https://cdn.aoty.org/rh.jpg" /></a></div><div class="name"><a href="/artist/1-radiohead/">Radiohead</a></div><div class="ratingRow"><div class="ratingBlock"><div class="rating">90</div></div></div></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const artists = await scrapeTopArtists(null, "critics");
      expect(artists.length).toBe(1);
      expect(artists[0]?.name).toBe("Radiohead");
      expect(artists[0]?.score).toBe(90);
    } finally {
      restore();
    }
  });
});

describe("list detail enrichment", () => {
  it("parses streaming links, secondary genres, scope and unranked rows", async () => {
    const html = `
      <div class="listHeader"><h1 class="headline">Best of 2026</h1><a href="https://example.com/list">Source</a></div>
      <div class="albumListRow">
        <div class="albumListRank"><span itemprop="position">1</span></div>
        <div class="albumListCover mustHear user"><img src="https://cdn.aoty.org/c.jpg" /></div>
        <div class="albumListTitle"><a itemprop="url" href="/album/1-x.php">A - B</a></div>
        <div class="albumListDate">Jan 2026</div>
        <div class="albumListGenre"><a href="/genre/1-rock/">Rock</a> <div class="secondary-genres"><span class="secondary"><a href="/genre/2-alt/">Alt</a></span></div></div>
        <div class="albumListLinks"><a href="https://open.spotify.com/album/x" data-track-action="Spotify"><span>Spotify</span></a></div>
        <div class="albumListScoreContainer"><div class="scoreValue">90</div><div class="scoreText">100 ratings</div></div>
      </div>
      <div class="albumListRow">
        <div class="albumListTitle"><a itemprop="url" href="/album/2-y.php">C - D</a></div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const detail = await scrapeListDetail("http://mock/list/1-x/");
      expect(detail.items.length).toBe(2);
      expect(detail.items[0]?.rank).toBe(1);
      expect(detail.items[0]?.mustHearScope).toBe("user");
      expect(detail.items[0]?.secondaryGenres).toEqual(["Alt"]);
      expect(detail.items[0]?.streamingLinks).toEqual([{ platform: "Spotify", url: "https://open.spotify.com/album/x" }]);
      expect(detail.items[1]?.rank).toBeNull();
      expect(detail.items[1]?.mustHearScope).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("critic enrichment", () => {
  it("parses review URLs, exact dates and total pages", async () => {
    const html = `
      <h1 class="headline">Anthony Fantano</h1>
      <div class="userReviewBlock">
        <div class="cover"><a href="/album/1-x.php"><img src="https://cdn.aoty.org/c.jpg" /></a></div>
        <div class="artistTitle"><a href="/artist/1-a/">A</a></div>
        <div class="albumTitle"><a href="/album/1-x.php">X</a></div>
        <div class="userName"><a href="/publication/57-the-needle-drop/">The Needle Drop</a></div>
        <div class="rating">90</div>
        <div class="reviewText">Great</div>
        <div class="albumReviewLinks"><div class="actionContainer"><div class="extLinkIcon"><a href="https://www.youtube.com/watch?v=abc">icon</a></div></div><div class="extLink"><a href="https://www.youtube.com/watch?v=abc">Full Review</a></div></div>
        <div class="actionContainer" title="09 Sep 2026 03:06:35 GMT"><div class="date">11h</div></div>
      </div>
      <div class="pageSelectRow"><div class="pageSelectSmall current">1</div><a href="/critic/2-anthony-fantano/2/"><div class="pageSelectSmall">2</div></a><a href="/critic/2-anthony-fantano/137/"><div class="pageSelectSmall">137</div></a></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const critic = await scrapeCriticPage("https://www.albumoftheyear.org/critic/2-anthony-fantano/", "2-anthony-fantano");
      expect(critic.page).toBe(1);
      expect(critic.totalPages).toBe(137);
      expect(critic.reviews.length).toBe(1);
      expect(critic.reviews[0]?.reviewUrl).toBe("https://www.youtube.com/watch?v=abc");
      expect(critic.reviews[0]?.date).toBe("11h");
      expect(critic.reviews[0]?.dateExact).toBe("09 Sep 2026 03:06:35 GMT");
    } finally {
      restore();
    }
  });
});

describe("label enrichment", () => {
  it("parses genres, aka, country and total pages", async () => {
    const html = `
      <h1 class="headline">XL Recordings</h1>
      <div class="publicationHeader label"><div class="pubSubHeadline label">
      <div class="detailRow">Art Pop, Art Rock<span> / genres</span></div>
      <div style="display: inline-flex;"><img class="flag" src="https://cdn.albumoftheyear.org/images/flags/gb.webp" /> United Kingdom</div>
      <div><i class="fab fa-twitter"></i> <a class="twitter" href="//www.twitter.com/XLRECORDINGS">XL</a></div>
      </div></div>
      <div class="pageSelectRow"><div class="pageSelectSmall current">1</div><a href="/label/13-xl/7/"><div class="pageSelectSmall">7</div></a></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const label = await scrapeLabelPage("https://www.albumoftheyear.org/label/13-xl/", {}, 1);
      expect(label.genres).toEqual(["Art Pop", "Art Rock"]);
      expect(label.country).toBe("United Kingdom");
      expect(label.countryCode).toBe("gb");
      expect(label.website).toBe("https://www.twitter.com/XLRECORDINGS");
      expect(label.totalPages).toBe(7);
      expect(label.albums).toEqual([]);
    } finally {
      restore();
    }
  });
});

describe("publication split", () => {
  it("separates 2026 and all-time top albums", async () => {
    const html = `
      <h1>Pitchfork</h1>
      <div class="albumBlock">
        <a href="/artist/1-artist/"><div class="artistTitle">Artist 1</div></a>
        <a href="/album/1-recent.php"><div class="albumTitle">Recent Album</div></a>
        <div class="rating">80</div>
      </div>
      Pitchfork's Highest Rated Albums of 2026
      <div class="albumBlock">
        <a href="/artist/2-artist/"><div class="artistTitle">Artist 2</div></a>
        <a href="/album/2-top2026.php"><div class="albumTitle">Top 2026</div></a>
        <div class="rating">95</div>
      </div>
      Pitchfork's Highest Rated Albums of All time
      <div class="albumBlock">
        <a href="/artist/3-artist/"><div class="artistTitle">Artist 3</div></a>
        <a href="/album/3-topall.php"><div class="albumTitle">Top All Time</div></a>
        <div class="rating">100</div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const pub = await scrapePublicationPage("https://www.albumoftheyear.org/publication/1-pitchfork/", "1-pitchfork");
      expect(pub.recentReviews.length).toBe(1);
      expect(pub.topAlbums.length).toBe(2);
      expect(pub.highest2026.length).toBe(1);
      expect(pub.highest2026[0]?.album).toBe("Top 2026");
      expect(pub.highestAllTime.length).toBe(1);
      expect(pub.highestAllTime[0]?.album).toBe("Top All Time");
    } finally {
      restore();
    }
  });
});

describe("site updates enrichment", () => {
  it("parses publication, excerpt and source URL on reviews", async () => {
    const html = `
      <div class="upd">
        <div class="updHead">Review</div>
        <div class="updText"><div><strong><a href="/album/1860843-x/">Café Paradiso</a></strong> by <strong><a href="/artist/2911-y/">Mykki Blanco</a></strong></div><div><img src="https://cdn.aoty.org/publication/pitchfork-2.jpg" /> <span>Pitchfork</span></div><div style="margin: 10px 0;">The shapeshifting artist swerves.</div><div class="gray-font"><span class="small-font">12m ago</span><span class="small-font"> - <a class="gray" href="https://pitchfork.com/reviews/albums/x">Source</a></span></div></div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeSiteUpdates({}, null, 1);
      expect(res.updates.length).toBe(1);
      expect(res.updates[0]?.kind).toBe("Review");
      expect(res.updates[0]?.title).toBe("Café Paradiso");
      expect(res.updates[0]?.artist).toBe("Mykki Blanco");
      expect(res.updates[0]?.publication).toBe("Pitchfork");
      expect(res.updates[0]?.publicationLogo).toBe("https://cdn.aoty.org/publication/pitchfork-2.jpg");
      expect(res.updates[0]?.excerpt).toBe("The shapeshifting artist swerves.");
      expect(res.updates[0]?.sourceUrl).toBe("https://pitchfork.com/reviews/albums/x");
    } finally {
      restore();
    }
  });
});

describe("community discussions", () => {
  it("parses the recent album discussion table", async () => {
    const html = `
      <div class="subHeadline"><a href="/discussion/albums/">Recent Album Discussion</a></div>
      <table class="discussion"><thead><tr><th></th><th>Album</th><th>Comments</th><th>Last Post</th></tr></thead>
      <tbody><tr><td class="coverart"><a href="/album/690-x/comments/"><img src="https://cdn.aoty.org/c.jpg" /></a></td><td class="title"><a href="/album/690-x/comments/"><div>Flying Lotus</div><div>Los Angeles</div></a></td><td class="comments">27</td><td class="lastPost"><div><a href="/user/anklebike404/">ANKLEBIKE404</a></div><div class="date" title="09 Sep 2026 14:31:07 GMT">54s ago</div></td></tr></tbody>
      </table>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeUsersCommunity({});
      expect(res.discussions.length).toBe(1);
      expect(res.discussions[0]).toEqual({
        artist: "Flying Lotus",
        album: "Los Angeles",
        albumUrl: "https://www.albumoftheyear.org/album/690-x/comments/",
        cover: "https://cdn.aoty.org/c.jpg",
        commentCount: 27,
        lastUser: "ANKLEBIKE404",
        lastUserUrl: "https://www.albumoftheyear.org/user/anklebike404/",
        lastPostAgo: "54s ago",
        lastPostExact: "09 Sep 2026 14:31:07 GMT",
      });
    } finally {
      restore();
    }
  });
});

describe("genre releases by year", () => {
  it("parses the By Year sidebar and total", async () => {
    const { scrapeGenrePage } = await import("../src/scrapers/entities.js");
    const html = `
      <h1>Hip Hop</h1>
      <div class="rightBox"><div class="sectionHeading">By Year</div><table class="dist">
      <tr class="distRow"><td class="distLabel"><a href="/1968/releases/?genre=3">1968</a></td><td class="distCount"><a href="/1968/releases/?genre=3">1</a></td></tr>
      <tr class="distRow"><td class="distLabel"><a href="/2026/releases/?genre=3">2026</a></td><td class="distCount"><a href="/2026/releases/?genre=3">5,249</a></td></tr>
      </table><div class="distEnd"><br />62,887 releases</div></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const genre = await scrapeGenrePage("https://www.albumoftheyear.org/genre/3-hip-hop/", "3-hip-hop");
      expect(genre.name).toBe("Hip Hop");
      expect(genre.totalReleases).toBe(62887);
      expect(genre.releasesByYear.length).toBe(2);
      expect(genre.releasesByYear[0]).toEqual({ year: 1968, count: 1, url: "https://www.albumoftheyear.org/1968/releases/?genre=3" });
      expect(genre.releasesByYear[1]?.count).toBe(5249);
    } finally {
      restore();
    }
  });
});

describe("label sort and singles", () => {
  it("echoes sort and release type from the page URL", async () => {
    const html = `<h1 class="headline">XL Recordings</h1>`;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const sorted = await scrapeLabelPage("https://www.albumoftheyear.org/label/13-xl/?sort=oldest", {}, 1);
      expect(sorted.sort).toBe("oldest");
      expect(sorted.releaseType).toBe("albums");
      const singles = await scrapeLabelPage("https://www.albumoftheyear.org/label/13-xl/singles/", {}, 1);
      expect(singles.sort).toBeNull();
      expect(singles.releaseType).toBe("singles");
    } finally {
      restore();
    }
  });

  it("serves /label/singles and rejects bad sort values", async () => {
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();
    const albumHtml = `<div class="albumBlock"><div class="albumTitle">Test</div></div>`;
    const restore = mockFetch(async () => new Response(`<h1 class="headline">XL</h1>${albumHtml}`, { status: 200 }));
    try {
      const res = await worker.fetch(new Request("http://localhost/label/singles?slug=13-xl"), env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { releaseType: string; albums: unknown[] };
      expect(json.releaseType).toBe("singles");
      expect(json.albums.length).toBe(1);
      const bad = await worker.fetch(new Request("http://localhost/label?slug=13-xl&sort=bogus"), env);
      expect(bad.status).toBe(400);
    } finally {
      restore();
    }
  });
});

describe("chart and news pagination", () => {
  it("returns totalPages for charts and hasNextPage for news", async () => {
    const { scrapeRatingsChartPage } = await import("../src/scrapers/charts.js");
    const { scrapeNewsPageMeta } = await import("../src/scrapers/news.js");
    const chartHtml = `
      <div class="albumListRow" id="rank-1">
        <div class="albumListTitle"><a itemprop="url" href="/album/1-x.php">A - B</a></div>
      </div>
      <div class="pageSelectRow"><div class="pageSelectSmall current">1</div><a href="/ratings/6-highest-rated/2026/2/"><div class="pageSelectSmall">2</div></a><a href="/ratings/6-highest-rated/2026/19/"><div class="pageSelectSmall">19</div></a></div>
    `;
    const newsHtml = `
      <div class="mediaContainer" id="link1"><div class="content"><div class="title"><a href="/l/1-x/">X</a></div></div></div>
      <div><a href="/l/newsworthy/2/"><div class="pageSelect next">OLDER</div></a></div>
    `;
    const newsLastHtml = `
      <div class="mediaContainer" id="link1"><div class="content"><div class="title"><a href="/l/1-x/">X</a></div></div></div>
    `;
    let mode = "chart";
    const restore = mockFetch(async () => new Response(mode === "chart" ? chartHtml : mode === "news" ? newsHtml : newsLastHtml, { status: 200 }));
    try {
      const chart = await scrapeRatingsChartPage("/ratings/6-highest-rated/2026/1", {});
      expect(chart.items.length).toBe(1);
      expect(chart.totalPages).toBe(19);
      mode = "news";
      const news = await scrapeNewsPageMeta("http://mock/l/newsworthy/1/", {});
      expect(news.items.length).toBe(1);
      expect(news.hasNextPage).toBe(true);
      mode = "last";
      const last = await scrapeNewsPageMeta("http://mock/l/newsworthy/9/", {});
      expect(last.hasNextPage).toBe(false);
    } finally {
      restore();
    }
  });
});

describe("publication tabs", () => {
  it("parses tab navigation with selection state", async () => {
    const html = `
      <h1>Pitchfork</h1>
      <div class="selectRow"><div class="selectBox selected">Overview</div><a href="/ratings/1-pitchfork-highest-rated/2026/1"><div class="selectBox">Best Albums</div></a><a href="/publication/1-pitchfork/reviews/"><div class="selectBox">Reviews</div></a></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const pub = await scrapePublicationPage("https://www.albumoftheyear.org/publication/1-pitchfork/", "1-pitchfork");
      expect(pub.tabs.length).toBe(3);
      expect(pub.tabs[0]).toEqual({ label: "Overview", url: null, selected: true });
      expect(pub.tabs[1]).toEqual({ label: "Best Albums", url: "https://www.albumoftheyear.org/ratings/1-pitchfork-highest-rated/2026/1", selected: false });
    } finally {
      restore();
    }
  });
});

describe("lists index sections", () => {
  it("groups entries under their headings", async () => {
    const html = `
      <h2 class="subHeadline">2026 Featured Lists</h2>
      <div class="noResultsMessage">No lists currently available</div>
      <h2 class="subHeadline">Other 2026 Lists</h2>
      <div class="listColumn">
        <div class="listPub">
          <a href="/list/100-pitchfork-best-of-2026/"><div class="listLogo"><img src="https://cdn.aoty.org/p.png" alt="Pitchfork - 50 Best" /></div></a>
          <div class="listText"><a>Pitchfork</a></div>
        </div>
        <div class="listPub">
          <a href="/list/101-nme-best-of-2026/"><div class="listLogo"><img src="https://cdn.aoty.org/n.png" alt="NME - 50 Best" /></div></a>
          <div class="listText"><a>NME</a></div>
        </div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const { scrapeListsIndex } = await import("../src/scrapers/lists.js");
      const { lists, sections } = await scrapeListsIndex("https://www.albumoftheyear.org/lists.php");
      expect(lists.length).toBe(2);
      expect(sections.length).toBe(1);
      expect(sections[0]?.title).toBe("Other 2026 Lists");
      expect(sections[0]?.lists.length).toBe(2);
      expect(sections[0]?.lists[0]?.publication).toBe("Pitchfork");
    } finally {
      restore();
    }
  });
});

describe("genre tabs and artist rail links", () => {
  it("parses genre tabs and artist view-all URLs", async () => {
    const { scrapeGenrePage } = await import("../src/scrapers/entities.js");
    const { scrapeArtistPage } = await import("../src/scrapers/artist.js");
    const genreHtml = `
      <h1>Hip Hop</h1>
      <div class="selectRow"><div class="selectBox selected">Overview</div><a href="/genre/3-hip-hop/2026/"><div class="selectBox">Best Albums</div></a><a href="/bands/top-artists/hip-hop/"><div class="selectBox">Top Artists</div></a></div>
    `;
    const artistHtml = `
      <h1 class="artistHeadline">Kanye West</h1>
      <div class="sectionHeading"><h2><a href="/artist/183-kanye-west/best-songs/">Community's Top Songs</a></h2><div class="viewAll"><a href="/artist/183-kanye-west/best-songs/">View All</a></div></div>
      <div class="section relatedArtists"><div class="sectionHeading"><h2><a href="/artist/183-kanye-west/similar/">Similar Artists</a></h2></div></div>
    `;
    let mode = "genre";
    const restore = mockFetch(async () => new Response(mode === "genre" ? genreHtml : artistHtml, { status: 200 }));
    try {
      const genre = await scrapeGenrePage("https://www.albumoftheyear.org/genre/3-hip-hop/", "3-hip-hop");
      expect(genre.tabs.length).toBe(3);
      expect(genre.tabs[0]).toEqual({ label: "Overview", url: null, selected: true });
      expect(genre.tabs[2]).toEqual({ label: "Top Artists", url: "https://www.albumoftheyear.org/bands/top-artists/hip-hop/", selected: false });
      mode = "artist";
      const artist = await scrapeArtistPage("https://www.albumoftheyear.org/artist/183-kanye-west/");
      expect(artist.topSongsUrl).toBe("https://www.albumoftheyear.org/artist/183-kanye-west/best-songs/");
      expect(artist.similarArtistsUrl).toBe("https://www.albumoftheyear.org/artist/183-kanye-west/similar/");
    } finally {
      restore();
    }
  });
});

describe("homepage bottom rails", () => {
  it("parses best songs, popular genres and browse-by links", async () => {
    const { scrapeHomepage } = await import("../src/scrapers/social.js");
    const homeHtml = `
      <div class="section"><div class="sectionHeading">Users' Best Songs of 2026</div>
      <table class="trackListTable">
        <tr><td class="coverart"><a href="/song/1-x/"><img src="https://cdn2.aoty.org/50x0/album/a.jpg" /></a></td><td class="songAlbum"><div><a href="/song/1-x/">Hit Song</a></div><div class="gray-font">Famous Artist</div></td><td class="trackRating"><span class="green-font" title="551 Ratings">96</span></td></tr>
        <tr><td class="coverart"><a href="/song/2-y/"><div class="noCoverContainer"></div></a></td><td class="songAlbum"><div><a href="/song/2-y/">Other Song</a></div><div class="gray-font">Other Artist</div></td><td class="trackRating"><span class="green-font">90</span></td></tr>
      </table></div>
      <div class="section"><div class="sectionHeading">Popular Genres</div><a href="/genre/3-hip-hop/">Hip Hop</a><a href="/genre/6-electronic/">Electronic</a></div>
      <div class="section"><div class="sectionHeading">Browse By</div><a href="/decade/2020s/releases/">2020s</a><a href="/2026/releases/">2026</a><a href="/week/2026/36/releases/">This Week</a></div>
    `;
    const empty = `<div></div>`;
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url === "https://www.albumoftheyear.org/") return new Response(homeHtml, { status: 200 });
      return new Response(empty, { status: 200 });
    });
    try {
      const home = await scrapeHomepage({});
      expect(home.bestSongs.length).toBe(2);
      expect(home.bestSongs[0]).toEqual({
        title: "Hit Song",
        url: "https://www.albumoftheyear.org/song/1-x/",
        artist: "Famous Artist",
        cover: "https://cdn2.aoty.org/album/a.jpg",
        score: 96,
        ratingCount: 551,
      });
      expect(home.bestSongs[1]?.cover).toBeNull();
      expect(home.bestSongs[1]?.ratingCount).toBeNull();
      expect(home.popularGenres).toEqual([
        { name: "Hip Hop", url: "https://www.albumoftheyear.org/genre/3-hip-hop/" },
        { name: "Electronic", url: "https://www.albumoftheyear.org/genre/6-electronic/" },
      ]);
      expect(home.browseBy).toEqual([
        { name: "2020s", url: "https://www.albumoftheyear.org/decade/2020s/releases/" },
        { name: "2026", url: "https://www.albumoftheyear.org/2026/releases/" },
        { name: "This Week", url: "https://www.albumoftheyear.org/week/2026/36/releases/" },
      ]);
    } finally {
      restore();
    }
  });
});

describe("profile correctness fixes", () => {
  it("reads Listens stat, Listened rail and artist favorites", async () => {
    const { scrapeUserProfile } = await import("../src/scrapers/user.js");
    const html = `
      <h1 class="headline profile"><span>huxslay</span></h1>
      <div class="profileImage"><img src="https://cdn.aoty.org/avatar.jpg" /></div>
      <div class="profileStatContainer"><a href="/user/huxslay/listened/"><div class="profileStat">158</div><div class="profileStatName">Listens</div></a></div>
      <div class="profileStatContainer"><a href="/user/huxslay/reviews/"><div class="profileStat">12</div><div class="profileStatName">Reviews</div></a></div>
      <div class="profileStatContainer"><a href="/user/huxslay/lists/"><div class="profileStat">4</div><div class="profileStatName">Lists</div></a></div>
      <div class="profileStatContainer"><a href="/user/huxslay/following/"><div class="profileStat">616</div><div class="profileStatName">Following</div></a></div>
      <div class="profileStatContainer"><a href="/user/huxslay/followers/"><div class="profileStat">365</div><div class="profileStatName">Followers</div></a></div>
      <h2 class="sectionHeading"><a href="/user/huxslay/listened/">Recently Listened</a></h2>
      <div class="albumBlock five"><div class="image"><a href="/album/197171-x.php"><img src="https://cdn.aoty.org/x.jpg" /></a></div>
      <a href="/artist/1-a/"><div class="artistTitle">A</div></a>
      <div class="albumTitle">X</div>
      <div class="type functions">2026 • LP</div>
      <div class="ratingRowContainer"><div class="ratingBlock"><div class="rating">88</div></div><div class="ratingText">Sep 1</div>
      <button class="showUserTrackRatings" data-album-id="197171" data-user-id="833743"><i class="fa-regular fa-list-ol"></i></button>
      </div></div>
      <div id="favBlock"><div class="artistBlock small"><div class="image"><a href="/artist/1-gorillaz/"><img src="https://cdn.aoty.org/g.jpg" /></a></div><div class="name"><a href="/artist/1-gorillaz/">Gorillaz</a></div></div></div></section>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const profile = await scrapeUserProfile("huxslay");
      expect(profile.stats.listens).toBe(158);
      expect(profile.stats.ratings).toBe(158);
      expect(profile.stats.following).toBe(616);
      expect(profile.recentlyRated.length).toBe(1);
      expect(profile.recentlyRated[0]?.userRating).toBe(88);
      expect(profile.recentlyRated[0]?.albumId).toBe(197171);
      expect(profile.recentlyRated[0]?.hasTrackRatings).toBe(true);
      expect(profile.favorites).toEqual([]);
      expect(profile.favoriteArtists.length).toBe(1);
      expect(profile.favoriteArtists[0]?.name).toBe("Gorillaz");
    } finally {
      restore();
    }
  });
});

describe("parseCount compact suffixes", () => {
  it("scales K/M/B", async () => {
    const { parseCount } = await import("../src/constants.js");
    expect(parseCount("11.1K")).toBe(11100);
    expect(parseCount("(40.5K)")).toBe(40500);
    expect(parseCount("10K")).toBe(10000);
    expect(parseCount("2.3M")).toBe(2300000);
    expect(parseCount("4,257")).toBe(4257);
    expect(parseCount("100")).toBe(100);
    expect(parseCount("NR")).toBeNull();
  });
});

describe("comment row ids and badges", () => {
  it("parses comment/reply ids and donor badges", async () => {
    const { scrapeCommentRows } = await import("../src/scrapers/commentRow.js");
    const html = `
      <div id="comment69957" class="commentRow">
        <div class="commentImage"><a href="/user/u1/"><img src="https://cdn.aoty.org/u.jpg" /></a></div>
        <div class="commentUserName"><a href="/user/u1/" style="color:#ED1700" title="u1">User1</a><div class="donor"><a href="/donate/"><i class="fas fa-check-circle"></i></a></div></div>
        <div class="commentDate">1h</div>
        <div class="commentText">Hi</div>
      </div>
      <div id="reply206495" class="commentRow">
        <div class="commentUserName"><a href="/user/u2/">User2</a></div>
        <div class="commentDate" title="16 Sep 2022 20:21:34 GMT">3y</div>
        <div class="commentText">Yo</div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const comments = await scrapeCommentRows(new Response(html));
      expect(comments.length).toBe(2);
      expect(comments[0]?.id).toBe(69957);
      expect(comments[0]?.subscriber).toBe(true);
      expect(comments[0]?.usernameColor).toBe("#ED1700");
      expect(comments[0]?.dateExact).toBe("");
      expect(comments[1]?.id).toBe(206495);
      expect(comments[1]?.dateExact).toBe("16 Sep 2022 20:21:34 GMT");
      expect(comments[1]?.subscriber).toBe(false);
    } finally {
      restore();
    }
  });
});

describe("review row enrichment", () => {
  it("captures ids, exact dates, edits, links and badges", async () => {
    const { parseAlbumUserReviewRows } = await import("../src/scrapers/album.js");
    const html = `
      <div class="albumReviewRow" id="review_997831">
        <div class="userReviewImage"><a href="/user/rollo-p/"><img src="https://cdn.aoty.org/r.jpg" /></a></div>
        <div class="userReviewName"><a href="/user/rollo-p/">Rollo_P</a><div class="donor userReview"><a href="/donate/">x</a></div></div>
        <div class="rating">99</div>
        <div class="albumReviewText user"><p>Amazing <a class="gray" href="/user/rollo-p/album/2915-aquemini/">read more</a></p></div>
        <div class="review_likes">174</div>
        <a class="gray" href="/user/rollo-p/album/2915-aquemini/"><div class="comment_count">6</div></a>
        <div class="review_date">4y*</div>
        <div class="actionContainer" title="28 Sep 2021 00:25:55 GMT"></div>
      </div>
    `;
    const reviews = parseAlbumUserReviewRows(html);
    expect(reviews.length).toBe(1);
    expect(reviews[0]?.reviewId).toBe(997831);
    expect(reviews[0]?.subscriber).toBe(true);
    expect(reviews[0]?.isTruncated).toBe(true);
    expect(reviews[0]?.text).toBe("Amazing");
    expect(reviews[0]?.comments).toBe(6);
    expect(reviews[0]?.commentsUrl).toBe("https://www.albumoftheyear.org/user/rollo-p/album/2915-aquemini/");
    expect(reviews[0]?.date).toBe("4y");
    expect(reviews[0]?.dateExact).toBe("28 Sep 2021 00:25:55 GMT");
    expect(reviews[0]?.edited).toBe(true);
  });
});

describe("list row bare counts", () => {
  it("reads likes/comments from listInfo markup", async () => {
    const { scrapeUserListRows } = await import("../src/scrapers/userListRow.js");
    const html = `
      <div class="userListRow profile"><div class="listTitle"><div><a href="/user/u/list/1/x/">X</a></div></div>
      <div class="listInfo">Updated 4d ago<span>10 albums</span><span>Ranked</span><span><div><a href="/user/u/list/1/x/#comments"><i class="far fa-comment"></i> 4</a></div><i class="far fa-heart"></i> 7</span></div></div>
    `;
    const lists = await scrapeUserListRows(new Response(html));
    expect(lists.length).toBe(1);
    expect(lists[0]?.comments).toBe(4);
    expect(lists[0]?.likes).toBe(7);
    expect(lists[0]?.updatedAgo).toBe("4d ago");
    expect(lists[0]?.albumCount).toBe(10);
    expect(lists[0]?.ranked).toBe(true);
  });
});

describe("follow rows and artists", () => {
  it("splits username/display and flags subscribers", async () => {
    const { scrapeFollowList, scrapeFollowArtists } = await import("../src/scrapers/user.js");
    const html = `
      <div class="listRow users">
        <div class="profilePic"><a href="/user/grapeshotave/"><img src="https://cdn.aoty.org/g.jpg" /></a></div>
        <a href="/user/grapeshotave/" style="color: #9D0000;" title="grapeshotave"><div class="userName">Steve Lacy's Twink BF</div></a>
        <div class="donor userList"><a href="/donate/">x</a></div>
      </div>
    `;
    const artistHtml = `
      <div class="listRow users">
        <div class="profilePic"><a href="/artist/1-kali/"><img src="https://cdn.aoty.org/k.jpg" /></a></div>
        <a href="/artist/1-kali/"><div class="userName">Kali Uchis</div></a>
        <div class="followStat list">1,119 Followers</div>
      </div>
      <div class="listRow users">
        <a href="/artist/2-hic/"><div class="noCoverContainer"></div><div class="userName">Hi-C</div></a>
      </div>
    `;
    let mode = "users";
    const restore = mockFetch(async () => new Response(mode === "users" ? html : artistHtml, { status: 200 }));
    try {
      const follows = await scrapeFollowList("huxslay", "following", 1);
      expect(follows.users.length).toBe(1);
      expect(follows.users[0]?.username).toBe("grapeshotave");
      expect(follows.users[0]?.name).toBe("Steve Lacy's Twink BF");
      expect(follows.users[0]?.subscriber).toBe(true);
      mode = "artists";
      const artists = await scrapeFollowArtists("huxslay", 1);
      expect(artists.artists.length).toBe(2);
      expect(artists.artists[0]?.followers).toBe(1119);
      expect(artists.artists[0]?.hasImage).toBe(true);
      expect(artists.artists[1]?.hasImage).toBe(false);
      expect(artists.artists[1]?.followers).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("user list detail meta", () => {
  it("parses blurbs, creator ratings, likes, likers and ids", async () => {
    const { scrapeUserListDetail } = await import("../src/scrapers/user.js");
    const html = `
      <h1 class="headline">2026 Ranking</h1>
      <div class="listDescription">My ranking.</div>
      <div class="likes">4</div>
      <div class="byLine"><img src="https://cdn.aoty.org/hux.jpg" /><div class="updated">Updated 4d ago</div></div>
      <div class="userListRow"><div class="rank">1</div><div class="userCover"><a href="/album/1-x.php"><img src="https://cdn.aoty.org/c.jpg" /></a></div>
      <div class="artistName"><a href="/artist/1-a/">A</a></div><div class="albumTitle"><a href="/album/1-x.php">X</a></div>
      <div class="blurb">I'm crying rn</div><div class="ratingBlock"><div class="rating">100</div></div></div>
      <div class="sectionHeading"><i class="fas fa-heart"></i> Likes (4)</div>
      <div class="userBlock"><a href="/user/nightswim/"><img src="https://cdn.aoty.org/n.jpg" alt="Nightswim" title="Nightswim" /></a></div>
      <a href="/user/huxslay/list/578841/2026-ranking/grid/">grid</a>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const detail = await scrapeUserListDetail("huxslay", "578841/2026-ranking");
      expect(detail.listId).toBe(578841);
      expect(detail.likes).toBe(4);
      expect(detail.likers.length).toBe(1);
      expect(detail.likers[0]?.name).toBe("Nightswim");
      expect(detail.updatedAgo).toBe("Updated 4d ago");
      expect(detail.authorAvatar).toBe("https://cdn.aoty.org/hux.jpg");
      expect(detail.gridUrl).toBe("https://www.albumoftheyear.org/user/huxslay/list/578841/2026-ranking/grid/");
      expect(detail.items[0]?.blurb).toBe("I'm crying rn");
      expect(detail.items[0]?.creatorRating).toBe(100);
    } finally {
      restore();
    }
  });
});

describe("review detail embeds and nav", () => {
  it("parses listenOn links, legacy arrows, JSON-LD and related", async () => {
    const { scrapeUserReviewDetail } = await import("../src/scrapers/user.js");
    const html = `
      <h2 class="artist"><a href="/artist/10-artist/">Great Artist</a></h2>
      <h1 class="albumTitle"><a href="/album/100-album/">Great Album</a></h1>
      <div class="userReviewHeader"><div class="cover"><img src="https://cdn.aoty.org/cover.jpg" /></div></div>
      <div class="userReviewByline"><div class="image"><img src="https://cdn.aoty.org/avatar.jpg" /></div></div>
      <div class="userReviewScoreBox"><div class="albumCriticScore">95</div></div>
      <div class="userReviewText">Great.</div>
      <div class="review_likes">42</div>
      <div class="reviewDate"><span title="September 9, 2026">7h ago</span></div>
      <script type="application/ld+json">{"@type":"Review","datePublished":"2026-09-09T03:12:29","dateModified":"2026-09-09T04:00:00"}</script>
      <div class="listenOn"><div class="title">Play This On</div><div class="spotify"><a href="https://open.spotify.com/album/abc"><span>Spotify</span></a></div><div class="vinyl"><a href="https://shop.com/vinyl">Buy Vinyl</a></div></div>
      <div class="sectionHeading">Related Content</div><div class="relatedRow"><a href="/ratings/user-highest-rated/1998/">Best Albums of 1998 - User Score</a></div>
      « <a href="/user/musicgeek/album/99-prev/" title="Previous Album"><img src="https://cdn.aoty.org/p.jpg" /></a>
      » <a href="/user/musicgeek/album/101-next/" title="Next Album"><img src="https://cdn.aoty.org/n.jpg" /></a>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const detail = await scrapeUserReviewDetail("musicgeek", "100-great-album");
      expect(detail.streamingLinks?.length).toBe(2);
      expect(detail.streamingLinks?.[0]).toEqual({ platform: "Spotify", url: "https://open.spotify.com/album/abc" });
      expect(detail.streamingLinks?.[1]?.platform).toBe("Vinyl");
      expect(detail.previousReview?.title).toBe("Previous Album");
      expect(detail.nextReview?.title).toBe("Next Album");
      expect(detail.datePublished).toBe("2026-09-09T03:12:29");
      expect(detail.dateModified).toBe("2026-09-09T04:00:00");
      expect(detail.relatedLinks.length).toBe(1);
      expect(detail.relatedLinks[0]?.name).toBe("Best Albums of 1998 - User Score");
    } finally {
      restore();
    }
  });
});

describe("album user-reviews header", () => {
  it("parses header context, pages and comment count", async () => {
    const { scrapeAlbumUserReviews } = await import("../src/scrapers/user.js");
    const html = `
      <div class="albumHeader"><div class="albumHeaderCover"><img src="https://cdn.aoty.org/cover.jpg" /></div>
      <div class="artist"><a href="/artist/562-outkast/">OutKast</a></div>
      <div class="rating">90</div><div class="ratingText">User Score (11,326)</div></div>
      <div class="userReviewCounter">showing 1 - 25 of 2,279 user reviews</div>
      <div class="pageSelectRow"><div class="pageSelectSmall current">1</div><a href="/album/2915-outkast-aquemini/user-reviews/?p=92"><div class="pageSelectSmall">92</div></a></div>
      <div class="selectBox selected">Comments (192)</div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeAlbumUserReviews("2915-outkast-aquemini", "popular", 1);
      expect(res.totalRatings).toBe(2279);
      expect(res.totalPages).toBe(92);
      expect(res.commentCount).toBe(192);
      expect(res.header?.artist).toBe("OutKast");
      expect(res.header?.userScore).toBe(90);
      expect(res.header?.userScoreCount).toBe(11326);
      expect(res.header?.cover).toBe("https://cdn.aoty.org/cover.jpg");
    } finally {
      restore();
    }
  });
});

describe("news detail entities", () => {
  it("parses artist/album/label/tags", async () => {
    const { scrapeNewsDetail } = await import("../src/scrapers/social.js");
    const html = `
      <div class="mediaHeader"><h1><a href="https://youtube.com/x">War on Drugs share new song</a></h1></div>
      <div class="mediaByline"><div class="mediaDate">3h ago</div></div>
      <div class="mediaDetailsRow"><span>Artist / </span> <a href="/artist/1632-the-war-on-drugs/">The War on Drugs</a></div>
      <div class="mediaDetailsRow"><span>Album / </span> <a href="/album/2020376-the-war-on-drugs-whos-that.php">Who's That</a></div>
      <div class="mediaDetailsRow"><span>Label / </span> Super High Quality</div>
      <div class="tag"><a href="/tag/new track/media/">new track</a></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const news = await scrapeNewsDetail("35670-x");
      expect(news.artist).toEqual({ name: "The War on Drugs", url: "https://www.albumoftheyear.org/artist/1632-the-war-on-drugs/" });
      expect(news.album?.name).toBe("Who's That");
      expect(news.label).toBe("Super High Quality");
      expect(news.tags).toEqual([{ name: "new track", url: "https://www.albumoftheyear.org/tag/new track/media/" }]);
    } finally {
      restore();
    }
  });
});

describe("top songs exact scores and artists", () => {
  it("parses title scores and collabs", async () => {
    const { scrapeTopSongs } = await import("../src/scrapers/song.js");
    const html = `
      <table class="trackListTable">
        <tr><td class="coverart"><img src="https://cdn.aoty.org/c.jpg" /></td>
        <td class="songAlbum"><a href="/song/1-x/">X</a><div class="gray-font"><a href="/artist/7698-porter-robinson/">Porter Robinson</a> & <a href="/artist/89299-ninajirachi/">Ninajirachi</a></div></td>
        <td class="trackRating"><span class="green-font" title="95.3619">95</span><div class="gray-font">551 Ratings</div></td></tr>
      </table>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeTopSongs("2026", 1);
      expect(res.songs.length).toBe(1);
      expect(res.songs[0]?.score).toBe(95);
      expect(res.songs[0]?.exactScore).toBe(95.3619);
      expect(res.songs[0]?.artists.length).toBe(2);
      expect(res.songs[0]?.artists[1]?.name).toBe("Ninajirachi");
    } finally {
      restore();
    }
  });
});

describe("best songs individual lists", () => {
  it("parses methodology and per-publication lists", async () => {
    const { scrapeBestSongsLists } = await import("../src/scrapers/song.js");
    const html = `
      <div class="pointRow"><div class="left">1st Place:</div><div class="right">10 points</div></div>
      <div class="pointRow"><div class="left">Unranked:</div><div class="right">2 points</div></div>
      <div class="section"><div class="headline">The Individual Lists</div></div>
      <div class="songListContainer"><div class="songListTitle">Beats Per Minute</div>
      <ol><li class="songListRow"><span class="songListArtist">Wednesday</span> - "Elderberry Wine"</li>
      <li class="songListRow"><span class="songListArtist">ROSALÍA</span> - "Berghain"</li></ol>
      <div class="songListSource"><a href="https://bpm.com/list">Full List →</a></div></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeBestSongsLists(2025, "points");
      expect(res.methodology).toEqual([{ place: "1st Place:", points: "10 points" }, { place: "Unranked:", points: "2 points" }]);
      expect(res.individualLists.length).toBe(1);
      expect(res.individualLists[0]?.publication).toBe("Beats Per Minute");
      expect(res.individualLists[0]?.sourceUrl).toBe("https://bpm.com/list");
      expect(res.individualLists[0]?.entries).toEqual([
        { artist: "Wednesday", title: "Elderberry Wine" },
        { artist: "ROSALÍA", title: "Berghain" },
      ]);
    } finally {
      restore();
    }
  });
});

describe("tag tabs and stats", () => {
  it("parses singles tab, headline, usage and tabs", async () => {
    const { scrapeTagPage } = await import("../src/scrapers/entities.js");
    const html = `
      <h1 class="headline"><i class="fa-regular fa-tag"></i> Radiohead</h1>
      <div style="margin-bottom:15px; font-size:11px;">Used by 79 people 289 times</div>
      <div class="selectRow"><div class="selectBox selected">Albums</div>
      <a href="/tag/radiohead/singles/"><div class="selectBox">Singles</div></a>
      <a href="/tag/radiohead/artists/"><div class="selectBox">Artists</div></a>
      <a href="/tag/radiohead/media/"><div class="selectBox">Media</div></a></div>
      <div class="albumBlock"><div class="image"><a href="/album/1-x.php"><img src="https://cdn.aoty.org/c.jpg" /></a></div>
      <div class="artistTitle">A</div><div class="albumTitle">X</div></div>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeTagPage("radiohead", "albums", null);
      expect(res.headline).toBe("Radiohead");
      expect(res.usedBy).toBe(79);
      expect(res.useCount).toBe(289);
      expect(res.tabs.length).toBe(4);
      expect(res.tabs[1]).toEqual({ label: "Singles", url: "https://www.albumoftheyear.org/tag/radiohead/singles/", selected: false });
      expect(res.albums.length).toBe(1);
    } finally {
      restore();
    }
  });
});

describe("changelog split entries", () => {
  it("splits multi-update sections and keeps links", async () => {
    const { scrapeChangelog } = await import("../src/scrapers/social.js");
    const html = `
      <section class="changeSection"><div class="changeDate">July 10, 2025</div>
      <div class="changeType update">Update</div><h2 class="changeTitle">Library</h2><div class="changeText"><p>Added a setting. See <a href="/subscribe/">here</a>.</p></div>
      <div class="changeType new">New</div><h2 class="changeTitle">Spin List</h2><div class="changeText"><p>Spin List is back.</p></div></section>
    `;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const entries = await scrapeChangelog();
      expect(entries.length).toBe(2);
      expect(entries[0]?.type).toBe("Update");
      expect(entries[0]?.title).toBe("Library");
      expect(entries[0]?.links).toEqual([{ name: "here", url: "https://www.albumoftheyear.org/subscribe/" }]);
      expect(entries[1]?.type).toBe("New");
      expect(entries[1]?.title).toBe("Spin List");
    } finally {
      restore();
    }
  });
});

describe("year-end drill links", () => {
  it("captures critic-list urls per placement", async () => {
    const { parseListSummaryRows } = await import("../src/scrapers/lists.js");
    const html = `
      <div>based on <strong>113</strong> lists</div>
      <div class="listSummaryRow"><div class="listSummaryRank">1</div>
      <div class="listSummaryCover"><img src="https://cdn.aoty.org/c.jpg" /></div>
      <h2 class="albumTitle"><a href="/album/1507961-rosalia-lux/">LUX</a></h2>
      <h3 class="artistTitle"><a href="/artist/30805-rosalia/">ROSALÍA</a></h3>
      <div class="summaryPoints"><a rel="nofollow" href="/album/1507961-rosalia-lux/critic-lists/?f=all&y=2025">413 Points</a></div>
      <div class="pointsTable"><a rel="nofollow" href="/album/1507961-rosalia-lux/critic-lists/?f=one&y=2025"><div class="summaryPointsMisc"><div class="head">1st Place</div><div class="count">11</div></div></a></div>
      </div>
    `;
    const { totalLists, items } = parseListSummaryRows(html);
    expect(totalLists).toBe(113);
    expect(items.length).toBe(1);
    expect(items[0]?.criticListsUrl).toBe("https://www.albumoftheyear.org/album/1507961-rosalia-lux/critic-lists/?f=all&y=2025");
    expect(items[0]?.breakdownUrls.firstPlace).toBe("https://www.albumoftheyear.org/album/1507961-rosalia-lux/critic-lists/?f=one&y=2025");
    expect(items[0]?.breakdownUrls.all).toBe("https://www.albumoftheyear.org/album/1507961-rosalia-lux/critic-lists/?f=all&y=2025");
    expect(items[0]?.breakdown.firstPlace).toBe(11);
  });
});

describe("new routes", () => {
  it("serves following-artists and spin-list", async () => {
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();
    const artistHtml = `
      <div class="listRow users">
        <div class="profilePic"><a href="/artist/1-kali/"><img src="https://cdn.aoty.org/k.jpg" /></a></div>
        <a href="/artist/1-kali/"><div class="userName">Kali Uchis</div></a>
        <div class="followStat list">1,119 Followers</div>
      </div>`;
    const spinHtml = `<div class="albumBlock"><div class="albumTitle">Spin Me</div></div>`;
    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/following/artists/")) return new Response(artistHtml, { status: 200 });
      return new Response(spinHtml, { status: 200 });
    });
    try {
      const fa = await worker.fetch(new Request("http://localhost/user/following-artists?username=huxslay"), env);
      expect(fa.status).toBe(200);
      const faJson = (await fa.json()) as { artists: Array<{ name: string; followers: number }> };
      expect(faJson.artists[0]?.name).toBe("Kali Uchis");
      expect(faJson.artists[0]?.followers).toBe(1119);
      const sp = await worker.fetch(new Request("http://localhost/user/spin-list?username=huxslay"), env);
      expect(sp.status).toBe(200);
      const spJson = (await sp.json()) as { ratings: unknown[] };
      expect(spJson.ratings.length).toBe(1);
    } finally {
      restore();
    }
  });
});

describe("tag artists tab (live markup)", () => {
  it("parses artists, tabs, sort, usage, pagination and popular tags", async () => {
    const { scrapeTagPage } = await import("../src/scrapers/entities.js");
    const html = `<div class="fullWidth"><div class="selectRow"><a href="/tag/radiohead/"><div class="selectBox">Overview</div></a><a href="/tag/radiohead/albums/"><div class="selectBox">Albums</div></a><div class="selectBox selected">Artists</div><a href="/tag/radiohead/media/"><div class="selectBox">Media</div></a></div><h1 class="headline">Artists Tagged Radiohead</h1><div class="filterRow"><div class="menuDropFloatRight"><div class="menuDropText">Sort</div><ul class="menuDrop"><li id="sort" class="menuDropSelected"><div style="padding-left:8px;">Popularity<div class="menuDropArrow"> </div></div><ul><li class="current">Popularity</li><li><a href="/tag/radiohead/artists/?s=critic-score" rel="nofollow">Critic Score</a></li><li><a href="/tag/radiohead/artists/?s=user-score" rel="nofollow">User Score</a></li></ul></li></ul></div></div><div style="margin-bottom:40px; font-size:11px;">Used by 44 people 79 times</div><div class="artistBlock six"><div class="image"><a href="/artist/62-coldplay/"><img src="https://cdn.albumoftheyear.org/artists/sq/coldplay_1718723546.jpg" alt="Coldplay" loading="lazy"></a></div><div class="name"><a href="/artist/62-coldplay/">Coldplay</a></div></div><div class="artistBlock six"><div class="image"><a href="/artist/284-radiohead/"><img src="https://cdn.albumoftheyear.org/artists/sq/radiohead_1570894846.jpg" alt="Radiohead" loading="lazy"></a></div><div class="name"><a href="/artist/284-radiohead/">Radiohead</a></div></div><div class="pageRow"><a href="/tag/radiohead/artists/2/"><div class="pageSelect next">Next</div></a><div class="clear"></div></div><div class="section"><div class="sectionHeading">Popular Artist Tags</div><div class="tag"><a href="/tag/british/artists/">british</a></div><div class="tag"><a href="/tag/rock/artists/">rock</a></div></div></div>`;
    const restore = mockFetch(async () => new Response(html, { status: 200 }));
    try {
      const res = await scrapeTagPage("radiohead", "artists", null, {}, 1, "critic-score");
      expect(res.artists.length).toBe(2);
      expect(res.artists[0]).toEqual({
        url: "https://www.albumoftheyear.org/artist/62-coldplay/",
        name: "Coldplay",
        image: "https://cdn.albumoftheyear.org/artists/coldplay_1718723546.jpg",
      });
      expect(res.headline).toBe("Artists Tagged Radiohead");
      expect(res.usedBy).toBe(44);
      expect(res.useCount).toBe(79);
      expect(res.tabs.length).toBe(4);
      expect(res.tabs[2]).toEqual({ label: "Artists", url: null, selected: true });
      expect(res.tabs[0]?.url).toBe("https://www.albumoftheyear.org/tag/radiohead/");
      expect(res.sort).toBe("critic-score");
      expect(res.hasNextPage).toBe(true);
      expect(res.popularTags).toEqual([
        { name: "british", url: "https://www.albumoftheyear.org/tag/british/artists/" },
        { name: "rock", url: "https://www.albumoftheyear.org/tag/rock/artists/" },
      ]);
    } finally {
      restore();
    }
  });
});

describe("verified live endpoints: artist/aka, news-item/embed, list/comments/replies, stats/refresh", () => {
  it("parses artist alsoKnownAs with link rows and plain text fallback", async () => {
    const { scrapeArtistAka } = await import("../src/scrapers/artist.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const linkHtml = `<div class="content"><a href="/artist/183-kanye-west/">Ye</a><a href="/artist/183-kanye-west/">Yeezy</a><a href="/artist/183-kanye-west/">Ye</a></div>`;
    let restore = mockFetch(async () => new Response(linkHtml, { status: 200 }));
    try {
      const res = await scrapeArtistAka("183-kanye-west");
      expect(res.artistId).toBe(183);
      expect(res.slug).toBe("183-kanye-west");
      expect(res.alsoKnownAs).toEqual(["Ye", "Yeezy"]);

      const workerRes = await worker.fetch(new Request("http://localhost/artist/aka?slug=183-kanye-west"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { alsoKnownAs: string[]; artistId: number; slug: string };
      expect(json.alsoKnownAs).toEqual(["Ye", "Yeezy"]);
    } finally {
      restore();
    }

    const textHtml = `<div>Ye, Yeezy, Kanye Omari West, +13 more...</div>`;
    restore = mockFetch(async () => new Response(textHtml, { status: 200 }));
    try {
      const res = await scrapeArtistAka("183-kanye-west");
      expect(res.alsoKnownAs).toEqual(["Ye", "Yeezy", "Kanye Omari West"]);
    } finally {
      restore();
    }

    expect(scrapeArtistAka("kanye-west")).rejects.toThrow("numeric artist ID");
    const badReq = await worker.fetch(new Request("http://localhost/artist/aka"), env);
    expect(badReq.status).toBe(400);
  });

  it("fetches raw news embed markup and serves /news-item/embed", async () => {
    const { scrapeNewsEmbed } = await import("../src/scrapers/social.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const embedHtml = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0"></iframe>`;
    const restore = mockFetch(async () => new Response(embedHtml, { status: 200 }));
    try {
      const res = await scrapeNewsEmbed("12342");
      expect(res.id).toBe(12342);
      expect(res.html).toBe(embedHtml);

      const workerRes = await worker.fetch(new Request("http://localhost/news-item/embed?id=12342"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { id: number; html: string };
      expect(json.id).toBe(12342);
      expect(json.html).toBe(embedHtml);

      const badReq = await worker.fetch(new Request("http://localhost/news-item/embed"), env);
      expect(badReq.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("fetches list comment replies and serves /list/comments/replies", async () => {
    const { scrapeListCommentReplies } = await import("../src/scrapers/social.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const replyHtml = `
      <div class="commentRow" id="reply123">
        <div class="commentImage"><a href="/user/reviewer/"><img src="https://cdn.aoty.org/u.jpg" /></a></div>
        <div class="commentUserName"><a href="/user/reviewer/">reviewer</a></div>
        <div class="commentDate">2d ago</div>
        <div class="commentText">Great list!</div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(replyHtml, { status: 200 }));
    try {
      const res = await scrapeListCommentReplies("555", "123");
      expect(res.listId).toBe(555);
      expect(res.commentId).toBe(123);
      expect(res.replies.length).toBe(1);
      expect(res.replies[0]?.username).toBe("reviewer");
      expect(res.replies[0]?.text).toBe("Great list!");

      const workerRes = await worker.fetch(new Request("http://localhost/list/comments/replies?listId=555&commentId=123"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { listId: number; commentId: number; replies: Array<{ username: string }> };
      expect(json.listId).toBe(555);
      expect(json.commentId).toBe(123);
      expect(json.replies[0]?.username).toBe("reviewer");

      const bad1 = await worker.fetch(new Request("http://localhost/list/comments/replies?listId=555"), env);
      expect(bad1.status).toBe(400);
      const bad2 = await worker.fetch(new Request("http://localhost/list/comments/replies?commentId=123"), env);
      expect(bad2.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("fetches stats-refresh JSON or text and serves /stats/refresh", async () => {
    const { scrapeStatsRefresh } = await import("../src/scrapers/social.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const jsonPayload = JSON.stringify({ html: "1,973,103</div>", timestamp: "0s ago" });
    let restore = mockFetch(async () => new Response(jsonPayload, { status: 200 }));
    try {
      const res = await scrapeStatsRefresh("stats:total_albums");
      expect(res.key).toBe("stats:total_albums");
      expect(res.html).toBe("1,973,103</div>");
      expect(res.timestamp).toBe("0s ago");

      const workerRes = await worker.fetch(new Request("http://localhost/stats/refresh?key=stats%3Atotal_albums"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { key: string; html: string; timestamp: string | null };
      expect(json.key).toBe("stats:total_albums");
      expect(json.html).toBe("1,973,103</div>");
      expect(json.timestamp).toBe("0s ago");
    } finally {
      restore();
    }

    const rawText = "<span>42</span>";
    restore = mockFetch(async () => new Response(rawText, { status: 200 }));
    try {
      const res = await scrapeStatsRefresh("stats:custom");
      expect(res.key).toBe("stats:custom");
      expect(res.html).toBe("<span>42</span>");
      expect(res.timestamp).toBe(null);
    } finally {
      restore();
    }

    const badReq = await worker.fetch(new Request("http://localhost/stats/refresh"), env);
    expect(badReq.status).toBe(400);
  });
});

describe("artist comment replies, artist tag autocomplete, and user contributions/stats popups", () => {
  it("fetches artist comment replies and serves /artist/comments/replies", async () => {
    const { scrapeArtistCommentReplies } = await import("../src/scrapers/social.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const replyHtml = `
      <div class="commentRow" id="reply789">
        <div class="commentImage"><a href="/user/fan/"><img src="https://cdn.aoty.org/fan.jpg" /></a></div>
        <div class="commentUserName"><a href="/user/fan/">fan</a></div>
        <div class="commentDate">1d ago</div>
        <div class="commentText">Classic artist!</div>
      </div>
    `;
    const restore = mockFetch(async () => new Response(replyHtml, { status: 200 }));
    try {
      const res = await scrapeArtistCommentReplies("183-kanye-west", "789");
      expect(res.artistId).toBe(183);
      expect(res.commentId).toBe(789);
      expect(res.replies.length).toBe(1);
      expect(res.replies[0]?.username).toBe("fan");
      expect(res.replies[0]?.text).toBe("Classic artist!");

      const workerRes = await worker.fetch(new Request("http://localhost/artist/comments/replies?artistId=183&commentId=789"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { artistId: number; commentId: number; replies: Array<{ username: string }> };
      expect(json.artistId).toBe(183);
      expect(json.commentId).toBe(789);
      expect(json.replies[0]?.username).toBe("fan");

      const bad1 = await worker.fetch(new Request("http://localhost/artist/comments/replies?artistId=183"), env);
      expect(bad1.status).toBe(400);
      const bad2 = await worker.fetch(new Request("http://localhost/artist/comments/replies?commentId=789"), env);
      expect(bad2.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("fetches artist tag autocomplete and serves /artist/tags/autocomplete", async () => {
    const { scrapeArtistTagAutocomplete } = await import("../src/scrapers/artist.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const json = [{ value: "hip hop" }, { value: "hardcore hip hop" }];
    const restore = mockFetch(async () => new Response(JSON.stringify(json), { status: 200 }));
    try {
      const res = await scrapeArtistTagAutocomplete("hip");
      expect(res).toEqual(["hip hop", "hardcore hip hop"]);

      const workerRes = await worker.fetch(new Request("http://localhost/artist/tags/autocomplete?q=hip"), env);
      expect(workerRes.status).toBe(200);
      const data = (await workerRes.json()) as { query: string; tags: string[] };
      expect(data.query).toBe("hip");
      expect(data.tags).toEqual(["hip hop", "hardcore hip hop"]);

      const aliasRes = await worker.fetch(new Request("http://localhost/artists/tags/autocomplete?q=hip"), env);
      expect(aliasRes.status).toBe(200);

      const bad = await worker.fetch(new Request("http://localhost/artist/tags/autocomplete"), env);
      expect(bad.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("fetches user contributions and stats popups via /user/contributions and /user/stats/popup", async () => {
    const { scrapeUserPopup } = await import("../src/scrapers/user.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const profileHtml = `
      <h1 class="headline profile"><span>patton</span></h1>
      <button class="userPop" data-type="contributions" data-user-id="175">Contributions</button>
      <div class="profileImage"><img src="https://cdn.aoty.org/patton.jpg" /></div>
    `;
    const popupHtml = `
      <div class="statRow">
        <a href="/album/123-test.php">Test Album</a> (Submitted LP) Sep 10, 2026
      </div>
      <div class="statRow">
        <a href="/artist/456-band/">Band Name</a> (Added Artist) Aug 15, 2026
      </div>
    `;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/user/patton/")) return new Response(profileHtml, { status: 200 });
      return new Response(popupHtml, { status: 200 });
    });
    try {
      const resById = await scrapeUserPopup(175, "contributions");
      expect(resById.userId).toBe(175);
      expect(resById.popType).toBe("contributions");
      expect(resById.items.length).toBe(2);
      expect(resById.items[0]?.title).toBe("Test Album");
      expect(resById.items[0]?.type).toBe("album");
      expect(resById.items[0]?.date).toBe("Sep 10, 2026");
      expect(resById.items[1]?.title).toBe("Band Name");
      expect(resById.items[1]?.type).toBe("artist");

      const resByUsername = await scrapeUserPopup("patton", "contributions");
      expect(resByUsername.userId).toBe(175);
      expect(resByUsername.username).toBe("patton");

      const workerRes = await worker.fetch(new Request("http://localhost/user/contributions?username=patton"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { userId: number; items: unknown[] };
      expect(json.userId).toBe(175);
      expect(json.items.length).toBe(2);

      const workerIdRes = await worker.fetch(new Request("http://localhost/user/contributions?userId=175"), env);
      expect(workerIdRes.status).toBe(200);

      const statsRes = await worker.fetch(new Request("http://localhost/user/stats/popup?username=patton"), env);
      expect(statsRes.status).toBe(200);

      const aliasStatsRes = await worker.fetch(new Request("http://localhost/user/stats-popup?userId=175"), env);
      expect(aliasStatsRes.status).toBe(200);

      const bad = await worker.fetch(new Request("http://localhost/user/contributions"), env);
      expect(bad.status).toBe(400);
    } finally {
      restore();
    }
  });
});

describe("faq facets, random filters metadata, and review id extraction", () => {
  it("scrapes faq by section (general, community, all)", async () => {
    const { scrapeFaq } = await import("../src/scrapers/social.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const genHtml = `
      <div class="faqPageTitle">Frequently Asked Questions</div>
      <div class="faqQuestion">Why aren't my ratings showing up?</div>
      <div class="faqAnswer">It hasn't leaked or streamed yet.</div>
    `;
    const comHtml = `
      <div class="faqPageTitle">Community Rules</div>
      <div class="faqQuestion">Multiple Accounts</div>
      <div class="faqAnswer">Multiple accounts are not allowed.</div>
      <div class="faqQuestion">Conduct</div>
      <div class="faqAnswer">Treat each other with respect.</div>
    `;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("/faq/community.php")) return new Response(comHtml, { status: 200 });
      return new Response(genHtml, { status: 200 });
    });
    try {
      const gen = await scrapeFaq("general");
      expect(gen.length).toBe(1);
      expect(gen[0]?.section).toBe("Frequently Asked Questions");
      expect(gen[0]?.question).toBe("Why aren't my ratings showing up?");

      const com = await scrapeFaq("community");
      expect(com.length).toBe(2);
      expect(com[0]?.section).toBe("Community Rules");
      expect(com[0]?.question).toBe("Multiple Accounts");

      const all = await scrapeFaq("all");
      expect(all.length).toBe(3);

      const workerRes = await worker.fetch(new Request("http://localhost/faq?section=community"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as { items: Array<{ section: string; question: string }> };
      expect(json.items.length).toBe(2);
      expect(json.items[0]?.section).toBe("Community Rules");
    } finally {
      restore();
    }
  });

  it("scrapes random filters metadata via /random/filters", async () => {
    const { scrapeRandomFilters } = await import("../src/scrapers/album.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const filtersHtml = `
      <select id="randomType">
        <option value="">All</option>
        <option value="LP">LP</option>
        <option value="EP">EP</option>
        <option value="Single">Single</option>
      </select>
      <input type="number" id="randomYearFrom" min="1950" max="2026">
      <input type="number" id="randomCriticScoreMin" min="0" max="100">
      <input type="number" id="randomCriticReviewsMin" min="5">
      <input type="number" id="randomUserScoreMin" min="0" max="100">
      <input type="number" id="randomUserReviewsMin" min="10">
    `;

    const restore = mockFetch(async () => new Response(filtersHtml, { status: 200 }));
    try {
      const filters = await scrapeRandomFilters();
      expect(filters.types).toEqual(["LP", "EP", "Single"]);
      expect(filters.year.min).toBe(1950);
      expect(filters.year.max).toBe(2026);
      expect(filters.criticScore.min).toBe(0);
      expect(filters.criticScore.max).toBe(100);
      expect(filters.criticReviews.min).toBe(5);
      expect(filters.userReviews.min).toBe(10);

      const workerRes = await worker.fetch(new Request("http://localhost/random/filters"), env);
      expect(workerRes.status).toBe(200);
      const json = (await workerRes.json()) as typeof filters;
      expect(json.types).toEqual(["LP", "EP", "Single"]);
      expect(json.year.min).toBe(1950);
    } finally {
      restore();
    }
  });

  it("extracts reviewId and commentsUrl in user review detail", async () => {
    const { scrapeUserReviewDetail } = await import("../src/scrapers/user.js");

    const reviewHtml = `
      <h2 class="artist"><a href="/artist/437-arctic-monkeys/">Arctic Monkeys</a></h2>
      <h1 class="albumTitle"><a href="/album/505321-arctic-monkeys-the-car.php">The Car</a></h1>
      <div class="userReviewScoreBox"><div class="albumCriticScore">100</div></div>
      <div class="userReviewText"><p>Great album</p></div>
      <div class="review_likes_container" id="review_likes_1363027"><div class="review_likes">50</div></div>
    `;

    const restore = mockFetch(async () => new Response(reviewHtml, { status: 200 }));
    try {
      const res = await scrapeUserReviewDetail("patton", "505321-the-car");
      expect(res.reviewId).toBe(1363027);
      expect(res.commentsUrl).toContain("itemID=1363027");
    } finally {
      restore();
    }
  });
});

describe("convenience routes, subgenre breadcrumbs, and album distribution by slug", () => {
  it("supports slug on /album/distribution and /album/rating-history", async () => {
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const distHtml = `
      <table class="dist">
        <tr class="distRow"><td class="distLabel">100</td><td class="distCount">20</td></tr>
      </table>
    `;
    const histHtml = `
      <div class="scoreMilestoneRow">
        <div class="milestone">100 Ratings</div><div class="score">85</div>
      </div>
    `;

    const restore = mockFetch(async (input) => {
      const url = String(input);
      if (url.includes("ratingHistory.php")) return new Response(histHtml, { status: 200 });
      return new Response(distHtml, { status: 200 });
    });
    try {
      const distRes = await worker.fetch(new Request("http://localhost/album/distribution?slug=1998-kanye-west"), env);
      expect(distRes.status).toBe(200);
      const distJson = (await distRes.json()) as { albumId: number; rows: unknown[] };
      expect(distJson.albumId).toBe(1998);

      const histRes = await worker.fetch(new Request("http://localhost/album/rating-history?slug=1998-kanye-west"), env);
      expect(histRes.status).toBe(200);
      const histJson = (await histRes.json()) as { albumId: number; milestones: unknown[] };
      expect(histJson.albumId).toBe(1998);
    } finally {
      restore();
    }
  });

  it("passes breadIds in subgenres and returns favoriteArtists in /user/favorites", async () => {
    const { scrapeSubGenres } = await import("../src/scrapers/entities.js");
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    let capturedBody = "";
    const subHtml = `<div class="heading">Subgenres</div><a href="/genre/30-trap/">Trap</a>`;
    const profileHtml = `
      <h1 class="headline profile"><span>patton</span></h1>
      <div id="favBlock">
        <div class="albumBlock"><div class="albumTitle">Favorite Album</div></div>
      </div>
      <div id="favArtistsBlock">
        <div class="artistBlock"><div class="name"><a href="/artist/1-kanye/">Kanye</a></div></div>
      </div>
    `;

    const restore = mockFetch(async (input, init) => {
      const url = String(input);
      if (url.includes("showSubGenres.php")) {
        capturedBody = String(init?.body ?? "");
        return new Response(subHtml, { status: 200 });
      }
      return new Response(profileHtml, { status: 200 });
    });
    try {
      const sub = await scrapeSubGenres(3, ["1", "2"]);
      expect(sub.subgenres.length).toBe(1);
      expect(capturedBody).toContain("breadIDs=%5B1%2C2%5D");

      const subRoute = await worker.fetch(new Request("http://localhost/subgenres?genreId=3&breadIds=1,2"), env);
      expect(subRoute.status).toBe(200);

      const favRoute = await worker.fetch(new Request("http://localhost/user/favorites?username=patton"), env);
      expect(favRoute.status).toBe(200);
      const favJson = (await favRoute.json()) as { favorites: unknown[]; favoriteArtists: unknown[] };
      expect(Array.isArray(favJson.favorites)).toBe(true);
      expect(Array.isArray(favJson.favoriteArtists)).toBe(true);
    } finally {
      restore();
    }
  });

  it("serves /review/comments, /list/comments, and /news-item/comments convenience routes", async () => {
    const worker = (await import("../src/index.js")).default;
    const { createMockEnv } = await import("./test_utils.js");
    const env = createMockEnv();

    const commentsHtml = `
      <div class="commentRow" id="comment_1">
        <div class="commentUserName"><a href="/user/reviewer/">reviewer</a></div>
        <div class="commentText">Awesome!</div>
      </div>
    `;

    const restore = mockFetch(async () => new Response(commentsHtml, { status: 200 }));
    try {
      const revRes = await worker.fetch(new Request("http://localhost/review/comments?id=1363027"), env);
      expect(revRes.status).toBe(200);
      const revJson = (await revRes.json()) as { type: string; itemId: number; comments: unknown[] };
      expect(revJson.type).toBe("user_review");
      expect(revJson.itemId).toBe(1363027);
      expect(revJson.comments.length).toBe(1);

      const listRes = await worker.fetch(new Request("http://localhost/list/comments?id=555"), env);
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as { type: string; itemId: number };
      expect(listJson.type).toBe("user_list");
      expect(listJson.itemId).toBe(555);

      const newsRes = await worker.fetch(new Request("http://localhost/news-item/comments?id=12342"), env);
      expect(newsRes.status).toBe(200);
      const newsJson = (await newsRes.json()) as { type: string; itemId: number };
      expect(newsJson.type).toBe("news");
      expect(newsJson.itemId).toBe(12342);

      const badRev = await worker.fetch(new Request("http://localhost/review/comments"), env);
      expect(badRev.status).toBe(400);

      const badList = await worker.fetch(new Request("http://localhost/list/comments"), env);
      expect(badList.status).toBe(400);

      const badNews = await worker.fetch(new Request("http://localhost/news-item/comments"), env);
      expect(badNews.status).toBe(400);
    } finally {
      restore();
    }
  });
});
