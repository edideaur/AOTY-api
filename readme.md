# AOTY Worker

A Cloudflare Workers API for Album of the Year (aoty.com).

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | API documentation |
| `/lists` | Get all year end lists (optional `?y=2025` for specific year) |
| `/list?slug=<slug>` | Get a specific list by slug |
| `/album?artist=<artist>&album=<album>` | Get album details with critics and user reviews |
| `/discover` | Get discover/popular albums with reviews |
| `/discover/albums` | Same as /discover |
| `/discover/singles` | Get discover singles with reviews |
| `/discover/top-rated` | Get top rated albums |
| `/discover/under-radar` | Get under the radar albums |
| `/discover/anticipated` | Get highly anticipated albums |

## Examples

```bash
# Get all lists
curl "https://aotyworker.edideaur.workers.dev/lists"

# Get 2025 lists only
curl "https://aotyworker.edideaur.workers.dev/lists?y=2025"

# Get a specific list
curl "https://aotyworker.edideaur.workers.dev/list?slug=2618-the-needle-drops-top-50-albums-of-2025"

# Get album details
curl "https://aotyworker.edideaur.workers.dev/album?artist=Kanye+West&album=Late+Registration"

# Get top rated albums
curl "https://aotyworker.edideaur.workers.dev/discover/top-rated"
```

## Development

```bash
bun install
bun run dev
```

## Deployment

```bash
bun run deploy
```