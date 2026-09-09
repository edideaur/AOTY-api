# AOTY API

Unofficial REST API for [albumoftheyear.org](https://www.albumoftheyear.org). Scrapes public pages and returns structured JSON. Built with Bun, TypeScript, and Cloudflare Workers.

<a href="https://www.postman.com/edideaur-8096189/aoty-api"><img src="https://run.pstmn.io/button.svg" height="32"/></a> <a href="https://aoty.prigoana.com"><img src="https://img.shields.io/badge/API-Docs-blue?style=for-the-badge" height="32"/></a>

## Setup

```bash
bun install
```

## Development

```bash
bun run dev
```

## Tests

```bash
bun test
```

## Type check

```bash
bun run typecheck
```

## Deploy

```bash
bun run deploy
```

## API reference

Interactive docs are served at `/` via [Scalar](https://scalar.com). The raw OpenAPI 3.0.3 spec is at `/openapi.json`.

## Endpoints

| Method | Path | Params | Description |
| ------ | ---- | ------ | ----------- |
| GET | `/` | | Scalar API reference UI |
| GET | `/openapi.json` | | OpenAPI 3.1.0 spec (JSON) |
| GET | `/openapi.yaml` | | OpenAPI 3.1.0 spec (YAML) |
| GET | `/postman.json` | | Postman collection v2.1.0 |
| GET | `/health` | | Health check (`{"status":"ok"}`, never cached) |
| GET | `/status` | | API status, version & endpoint count (never cached) |
| GET | `/batch` | `paths` (max 10, comma-separated) | Fetch multiple API paths in one request (never cached) |
| POST | `/batch` | JSON body `{ "paths": [...] }` (max 10, 8KB) | Same as GET batch, for longer path lists (never cached) |
| GET | `/album` | `slug` or (`artist`, `name`), `minimal` | Full album detail |
| GET | `/album/similar` | `slug`, `page` | Albums similar to this album |
| GET | `/album/summary` | `slug` or (`artist`, `name`), `minimal` | Lightweight album header (scores + meta, no reviews/comments/tracklist) |
| GET | `/album/user-reviews` | `slug`, `sort` (popular, recent, worst), `type` (reviews, ratings), `page` | User reviews and ratings for an album |
| GET | `/album/comments` | `slug`, `page` | Comments on an album |
| GET | `/comments` | `type`, `itemId`, `albumId` | Full comment thread without truncation |
| GET | `/review/comments` | `id` or `reviewId`, `albumId` | Full comment thread for a user review |
| GET | `/list/comments` | `id` or `listId` | Full comment thread for a user list |
| GET | `/news-item/comments` | `id` or `newsId` | Full comment thread for a news item |
| GET | `/album/comments/replies` | `albumId`, `commentId` | Replies to an album comment |
| GET | `/list/comments/replies` | `listId`, `commentId` | Replies to a user list comment |
| GET | `/album/critic-reviews` | `slug`, `sort` (highest, lowest, newest, oldest) | Critic reviews, sorted |
| GET | `/album/reviews` | `slug`, `type` (critic, user), `sort`, `page` | Critic or user reviews for an album |
| GET | `/album/tags` | `slug` | Complete tag list for an album |
| GET | `/album/tags/autocomplete` | `q` | Album tag search / autocomplete |
| GET | `/random/filters` | | Available filter options & bounds for random generation |
| GET | `/random/album` | `type`, `yearFrom`, `yearTo`, `genre`, score/review filters | Random album with optional criteria (never cached) |
| GET | `/random/release` | `type`, `yearFrom`, `yearTo`, `genre`, score/review filters | Alias for `/random/album` (never cached) |
| GET | `/album/rating-history` | `albumId` or `slug` | Rating milestones score trend |
| GET | `/album/distribution` | `albumId` or `slug`, `format` (all, following) | Rating score distribution histogram |
| GET | `/album/credits` | `albumId` or `slug` | Album performer, songwriter & production credits |
| GET | `/album/stats` | `albumId` or `slug` | Album community statistics (favorites, listens, etc.) |
| GET | `/album/tracklist` | `slug` or (`artist`, `name`) | Tracklist with ratings, lengths, features |
| GET | `/album/streaming` | `slug` or (`artist`, `name`) | Streaming service links (Spotify, Apple, Tidal, etc.) |
| GET | `/album/likes` | `albumId` or `slug`, `start` | Users who liked an album |
| GET | `/album/in-library` | `albumId` or `slug`, `start` | Users who added an album to their library |
| GET | `/album/images` | `albumId` or `slug` | Cover art and alternate images/scans |
| GET | `/album/corrections` | `albumId` or `slug` | Album submission and correction history |
| GET | `/corrections` | `type` (album, artist, song), `id` | Unified submission and correction history |
| GET | `/album/user-lists` | `slug`, `page` | User lists containing an album |
| GET | `/album/critic-lists` | `slug`, `page` | Year-end critic lists ranking an album |
| GET | `/artist` | `slug`, `type`, `sort`, `page` | Artist details + discography |
| GET | `/artist/discography` | `slug`, `type`, `sort`, `page` | Artist discography sections |
| GET | `/artist/similar` | `slug`, `page` | Similar artists |
| GET | `/artist/songs` | `slug`, `page` | Community's top songs by artist (alias `/artist/top-songs`) |
| GET | `/artist/news` | `slug`, `type`, `page` | News about an artist |
| GET | `/artist/credits` | `slug`, `role`, `sort` | Credited albums (omit `role` to list roles) |
| GET | `/artist/corrections` | `slug` | Artist submission and correction history |
| GET | `/artist/aka` | `slug` | Artist alias / Also Known As names |
| GET | `/artist/comments/replies` | `artistId`, `commentId` | Replies to an artist comment |
| GET | `/artist/tags/autocomplete` | `q` | Artist tag autocomplete (alias `/artists/tags/autocomplete`) |
| GET | `/artists` | | Artists overview |
| GET | `/random/artist` | | Random artist (never cached) |
| GET | `/random/genre` | | Random genre with sample albums (never cached) |
| GET | `/random/song` | `period` | Random popular song (never cached) |
| GET | `/random/must-hear` | `year`, `decade` | Random essential must-hear album (never cached) |
| GET | `/label` | `slug`, `page`, `sort` | Label details + releases |
| GET | `/label/singles` | `slug`, `page`, `sort` | Label single releases |
| GET | `/labels/autocomplete` | `q` | Label search / autocomplete |
| GET | `/genres` | | All genres with sample albums |
| GET | `/genres/autocomplete` | `q` | Musical genre autocomplete |
| GET | `/genre` | `slug`, `period`, `page`, `sort`, `minReviews` | Genre best albums / recent (`period`: year, `all`, `recent`) |
| GET | `/subgenres` | `genreId`, `breadIds` | Subgenres list for a genre |
| GET | `/genre/name` | `id` | Resolve numeric genre ID to its name |
| GET | `/tag` | `tag`, `type`, `year`, `sort`, `page` | Albums, singles, artists or media by tag |
| GET | `/publication` | `slug` | Publication details + reviews + top albums |
| GET | `/publication/reviews` | `slug`, `page` | Recent reviews by a publication |
| GET | `/publication/lists` | `slug`, `page` | Year-end lists by a publication |
| GET | `/publication/perfect` | `slug` | Perfect scores by decade |
| GET | `/critic` | `slug`, `page` | Critic details + reviews |
| GET | `/song` | `slug` | Song details, credits, ratings |
| GET | `/song/ratings` | `slug`, `page` | All user ratings for a song |
| GET | `/song/critic-lists` | `slug` | Year-end critic lists ranking a song |
| GET | `/song/corrections` | `songId` or `slug` | Song submission and correction history |
| GET | `/songs/top` | `period` (year, decade, `all`), `page` | Users' best songs |
| GET | `/songs/best` | `year`, `sort` (points, lists) | Aggregated best songs of the year |
| GET | `/songs/best/lists` | `year`, `sort` (points, lists) | Per-publication song lists + scoring methodology |
| GET | `/user` | `username` | User profile + stats |
| GET | `/user/stats` | `username` | User overview metrics & score distribution |
| GET | `/user/stats/popup` | `username` or `userId` | User statistics modal popup (alias `/user/stats-popup`) |
| GET | `/user/contributions` | `username` or `userId` | User site contributions & submissions popup |
| GET | `/user/favorites` | `username` | Favorite albums pinned to user profile |
| GET | `/user/ratings` | `username`, `page`, `type`, `decade`, `sort`, `year`, `genre` | Albums rated by a user |
| GET | `/user/perfect` | `username`, `page` | User's perfect 100-rated releases |
| GET | `/user/reviews` | `username`, `page` | Reviews written by a user |
| GET | `/user/listened` | `username`, `page` | Albums a user listened to |
| GET | `/user/library` | `username`, `t`, `s`, `page` | A user's library |
| GET | `/user/liked-albums` | `username`, `page` | Albums a user has liked |
| GET | `/user/spin-list` | `username`, `page` | Albums on a user's spin list |
| GET | `/user/tags` | `username`, `scope`, `sort` | Tags a user applied |
| GET | `/user/tag` | `username`, `tag`, `sort`, `page` | A user's albums with a tag |
| GET | `/user/lists` | `username`, `page` | Lists created by a user |
| GET | `/user/list` | `username`, `slug`, `sort`, `page` | A specific user list + comments |
| GET | `/user/year-end` | `username`, `year` | User's personal year-end album list |
| GET | `/user/distribution` | `username`, `format` (albums, singles, videos, tracks) | Rating score distribution histogram for a user |
| GET | `/user/artist-ratings` | `username`, `artistId` | All ratings given by a user for a specific artist |
| GET | `/user/track-ratings` | `username`, `albumId` or `slug` | User's track-by-track ratings for an album |
| GET | `/user/review` | `username`, `slug` | A single user review of an album |
| GET | `/user/followers` | `username`, `page` | A user's followers |
| GET | `/user/following` | `username`, `page` | Users a user follows |
| GET | `/user/following-artists` | `username`, `page` | Artists a user follows (with follower counts) |
| GET | `/user/genres` | `username` | User genre statistics and breakdown |
| GET | `/user/badges` | `username` | User badges and achievements |
| GET | `/users` | | Community updates (reviews + lists) |
| GET | `/user-reviews` | `period` (all, popular, month, year), `page` | Popular user reviews |
| GET | `/faq` | `section` (general, community, all) | Site FAQ categorized by facet |
| GET | `/guidelines` | `type` (review, comment) | Community guidelines & rules |
| GET | `/changelog` | | Site changelog |
| GET | `/stats` | | Site statistics & community leaderboards |
| GET | `/stats/refresh` | `key` | Live-refresh a site stats module counter |
| GET | `/ratings` | `source`, `period`, `page`, `genre` (user charts), `sort`, `minReviews` | Album charts (critic/user/publication/genre) |
| GET | `/ratings/sources` | `year` | Available publication rating sources |
| GET | `/ratings/genres` | `year`, `type` | Available genres for chart filtering |
| GET | `/top-artists` | `genre`, `scope`, `page` | Highest rated artists (`scope`: critics, users) |
| GET | `/releases` | `page`, `type` | New album releases |
| GET | `/releases/singles` | `page` | New single releases |
| GET | `/releases/this-week` | `page` | This week's releases |
| GET | `/releases/this-week/singles` | `page` | This week's new single releases |
| GET | `/releases/by-date` | `year`, `month`, `week`, `decade`, `genre`, `page` | Browse releases by date |
| GET | `/releases/year` | `year`, `genre`, `page` | Releases in a specific year |
| GET | `/releases/decade` | `decade`, `genre`, `page` | Releases in a decade |
| GET | `/releases/month` | `year`, `month`, `genre`, `page` | Releases in a specific month |
| GET | `/releases/week` | `year`, `week`, `genre`, `page` | Releases in a specific week |
| GET | `/releases/vibe` | `vibe`, `year`, `sort`, `type`, `page` | Releases tagged with a vibe/mood |
| GET | `/recently-added` | `page` | Recently added albums |
| GET | `/on-this-day` | | Album anniversaries for today |
| GET | `/upcoming` | `page` | Upcoming releases |
| GET | `/discover` | | Discover albums |
| GET | `/discover/singles` | | Discover singles |
| GET | `/discover/anticipated` | | Anticipated releases |
| GET | `/discover/under-radar` | | Under the radar |
| GET | `/discover/top-rated` | | Recent best music |
| GET | `/discover/people` | | What people are talking about |
| GET | `/must-hear` | `year`, `decade`, `page` | Must-hear albums |
| GET | `/news` | `page`, `type` | News feed |
| GET | `/news-item` | `slug` | Single news item + comments |
| GET | `/news-item/embed` | `id` | Inline embed fragment for a news link |
| GET | `/lists` | `year`, `sort`, `page` | Publication lists |
| GET | `/list/summary` | `year`, `genre` | Critic year-end list aggregate |
| GET | `/year-end` | `year` | Community year-end list aggregate |
| GET | `/lists/users` | `page` | Latest user-created lists |
| GET | `/list/:slug` | | List detail |
| GET | `/updates` | `filter`, `page` | Latest site updates |
| GET | `/home` | | Homepage sections |
| GET | `/search` | `q` | Search albums, artists, labels, lists, news, tags, users |
| GET | `/search/albums` | `q`, `page` | Search albums |
| GET | `/search/artists` | `q`, `page` | Search artists |
| GET | `/search/labels` | `q`, `page` | Search labels |
| GET | `/search/lists` | `q`, `page` | Search user lists |
| GET | `/search/news` | `q`, `page` | Search news |
| GET | `/search/tags` | `q`, `page` | Search tags |
| GET | `/search/users` | `q`, `page` | Search users |
| GET | `/search/autocomplete` | `q` | Search typeahead autocomplete |

## Notes

The `/album` endpoint calls two additional PHP endpoints for stats (favorites, likes, listens, library count, lists) and credits (performers, songwriters, producers), plus one artist page fetch for the full-size `artistImage` (AOTY serves `/sq/` square thumbnails, which the API strips). Pass `minimal=true` to skip those and return only album-page HTML-scraped data (`stats`, `credits` and `artistImage` will be null).

Both PHP endpoints require same-origin session cookies to return data. Without auth cookies they will return null for `stats` and `credits`.
