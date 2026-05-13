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
| GET | `/openapi.json` | | OpenAPI 3.0.3 spec |
| GET | `/album` | `slug` or (`artist`, `name`), `minimal` | Full album detail |
| GET | `/releases` | `page` | New album releases |
| GET | `/releases/singles` | `page` | New single releases |
| GET | `/upcoming` | `page` | Upcoming releases |
| GET | `/discover` | | Discover albums |
| GET | `/discover/singles` | | Discover singles |
| GET | `/discover/anticipated` | | Anticipated releases |
| GET | `/discover/under-radar` | | Under the radar |
| GET | `/must-hear` | `year`, `decade`, `page` | Must-hear albums |
| GET | `/news` | `page`, `type` | News feed |
| GET | `/lists` | `year` | Publication lists |
| GET | `/list/:slug` | | List detail |
| GET | `/search` | `q` | Search albums, artists, labels |
| GET | `/search/albums` | `q` | Search albums |
| GET | `/search/artists` | `q` | Search artists |
| GET | `/search/labels` | `q` | Search labels |

## Notes

The `/album` endpoint calls two additional PHP endpoints for stats (favorites, likes, listens, library count, lists) and credits (performers, songwriters, producers). Pass `minimal=true` to skip those and return only HTML-scraped data.

Both PHP endpoints require same-origin session cookies to return data. Without auth cookies they will return null for `stats` and `credits`.
