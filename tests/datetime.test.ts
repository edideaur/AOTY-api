import { describe, it, expect } from "bun:test";
import { parseDateToTimestamp, parseDurationToSeconds } from "../src/constants.js";
import { scrapeAlbumPage } from "../src/scrapers/album.js";
import { scrapeSongPage } from "../src/scrapers/song.js";
import { mockFetch } from "./test_utils.js";

describe("parseDurationToSeconds", () => {
  it("parses m:ss format", () => {
    expect(parseDurationToSeconds("3:45")).toBe(225);
    expect(parseDurationToSeconds("0:05")).toBe(5);
    expect(parseDurationToSeconds("10:00")).toBe(600);
  });

  it("parses h:mm:ss format", () => {
    expect(parseDurationToSeconds("1:02:03")).toBe(3723);
    expect(parseDurationToSeconds("2:00:00")).toBe(7200);
  });

  it("parses written format with hours and minutes", () => {
    expect(parseDurationToSeconds("1 hour, 8 minutes")).toBe(4080);
    expect(parseDurationToSeconds("1 hour, 14 minutes")).toBe(4440);
    expect(parseDurationToSeconds("23 minutes")).toBe(1380);
    expect(parseDurationToSeconds("2 hours")).toBe(7200);
    expect(parseDurationToSeconds("45 seconds")).toBe(45);
    expect(parseDurationToSeconds("Total Length: 1 hour, 8 minutes")).toBe(4080);
  });

  it("returns null for invalid inputs", () => {
    expect(parseDurationToSeconds("")).toBeNull();
    expect(parseDurationToSeconds(null)).toBeNull();
    expect(parseDurationToSeconds(undefined)).toBeNull();
    expect(parseDurationToSeconds("unknown")).toBeNull();
  });
});

describe("parseDateToTimestamp", () => {
  it("parses ISO dates", () => {
    expect(parseDateToTimestamp("1998-09-29")).toBe(Math.trunc(Date.parse("1998-09-29") / 1000));
    expect(parseDateToTimestamp("2026-09-09T03:12:29")).toBe(Math.trunc(Date.parse("2026-09-09T03:12:29") / 1000));
  });

  it("parses long human dates", () => {
    expect(parseDateToTimestamp("January 27, 2025")).toBe(Math.trunc(Date.parse("January 27, 2025") / 1000));
    expect(parseDateToTimestamp("16 Sep 2022 20:21:34 GMT")).toBe(Math.trunc(Date.parse("16 Sep 2022 20:21:34 GMT") / 1000));
  });

  it("parses 4-digit year strings into Jan 1 UTC seconds", () => {
    expect(parseDateToTimestamp("2024")).toBe(Math.trunc(Date.UTC(2024, 0, 1) / 1000));
  });

  it("returns null for relative dates and yearless dates", () => {
    expect(parseDateToTimestamp("2y ago")).toBeNull();
    expect(parseDateToTimestamp("11h")).toBeNull();
    expect(parseDateToTimestamp("5 minutes ago")).toBeNull();
    expect(parseDateToTimestamp("Jun 15")).toBeNull();
    expect(parseDateToTimestamp(null)).toBeNull();
  });
});

describe("Scraper integration with durationSeconds and dateTimestamps", () => {
  it("extracts durationSeconds and datePublishedTimestamp on album pages", async () => {
    const albumHtml = `
      <script type="application/ld+json">{"@type":"MusicAlbum","name":"Aquemini","byArtist":{"name":"OutKast","url":"https://www.albumoftheyear.org/artist/1-outkast/"},"image":"cover.jpg","datePublished":"1998-09-29"}</script>
      <div id="albumHeader"><div class="albumTitle">Aquemini</div></div>
      <div class="totalLength">Total Length: 1 hour, 14 minutes</div>
      <table class="trackListTable">
        <tr><td class="trackNumber">1.</td><td class="trackTitle"><a href="/song/1-intro/">Hold On</a><span class="length">4:31</span></td></tr>
      </table>
    `;
    const restore = mockFetch(async () => new Response(albumHtml, { status: 200 }));
    try {
      const album = await scrapeAlbumPage("https://www.albumoftheyear.org/album/2915-outkast-aquemini/");
      expect(album.datePublished).toBe("1998-09-29");
      expect(album.datePublishedTimestamp).toBe(Math.trunc(Date.parse("1998-09-29") / 1000));
      expect(album.totalLength).toBe("1 hour, 14 minutes");
      expect(album.totalLengthSeconds).toBe(4440);
      expect(album.tracklist[0]?.length).toBe("4:31");
      expect(album.tracklist[0]?.lengthSeconds).toBe(271);
    } finally {
      restore();
    }
  });

  it("extracts durationSeconds on song pages", async () => {
    const songHtml = `
      <h1 class="songTitle">Rosa Parks</h1>
      <div class="albumHeader song"><div class="artist"><a href="/artist/1-outkast/">OutKast</a></div></div>
      <div class="detailRow">4:31 / duration</div>
      <div class="totalLength">Total Length: 53:21</div>
    `;
    const restore = mockFetch(async () => new Response(songHtml, { status: 200 }));
    try {
      const song = await scrapeSongPage("https://www.albumoftheyear.org/song/1234-outkast-rosa-parks/");
      expect(song.duration).toBe("4:31");
      expect(song.durationSeconds).toBe(271);
      expect(song.tracklistTotalLength).toBe("53:21");
      expect(song.tracklistTotalLengthSeconds).toBe(3201);
    } finally {
      restore();
    }
  });
});
