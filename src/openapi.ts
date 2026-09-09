export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Album of the Year API",
    version: "1.0.0",
    description:
      "Unofficial REST API for albumoftheyear.org. Scrapes public pages and returns structured JSON. Free to use, but please provide credit.",
  },
  servers: [{ url: "/", description: "Production" }],
  paths: {
    "/album": {
      get: {
        summary: "Get album details",
        description:
          "Return full album details including scores, tracklist, reviews, streaming links, artist image, stats, and credits. Provide either slug (ID or full slug for direct lookup) or both artist and name (search-based lookup). Pass minimal=true to skip the PHP-based stats and credits calls and the artist image lookup.",
        operationId: "getAlbum",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "slug",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "AOTY album ID or full slug (e.g. '2915' or '2915-outkast-aquemini'). Use this or artist+name.",
            example: "2915",
          },
          {
            name: "artist",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "OutKast",
          },
          {
            name: "name",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "Aquemini",
          },
          {
            name: "minimal",
            in: "query",
            required: false,
            schema: { type: "boolean", default: false },
            description: "When true, skips moreStatsAlbum.php, showAlbumCredits.php and the artist image lookup. stats and credits will be null and artistImage will be null.",
          },
        ],
        responses: {
          "200": {
            description: "Album details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AlbumDetail" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/summary": {
      get: {
        summary: "Get lightweight album header",
        description:
          "Return album scores, metadata, streaming links and community stats without reviews, comments, tracklists or credits. Cheaper and faster than `/album`. Provide either slug or both artist and name. Pass minimal=true to skip the stats lookup.",
        operationId: "getAlbumSummary",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "slug",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "AOTY album ID or full slug (e.g. '2915' or '2915-outkast-aquemini'). Use this or artist+name.",
            example: "2915",
          },
          {
            name: "artist",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "OutKast",
          },
          {
            name: "name",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "Aquemini",
          },
          {
            name: "minimal",
            in: "query",
            required: false,
            schema: { type: "boolean", default: false },
            description: "When true, skips the stats lookup. stats will be null.",
          },
        ],
        responses: {
          "200": {
            description: "Album summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AlbumSummary" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/batch": {
      get: {
        summary: "Fetch multiple API paths in one request",
        description:
          "Execute up to 10 API paths in parallel and return each result (or per-item error) in a single response. Comma-separated list of API paths with optional query strings, e.g. `paths=/album?slug=2915,/artist?slug=30-radiohead`. `/batch` cannot be nested and static/docs/meta paths are rejected per item. Never cached.",
        operationId: "getBatch",
        parameters: [
          {
            name: "paths",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Comma-separated API paths (max 10), each with optional query string.",
            example: "/album?slug=2915,/artist?slug=30-radiohead",
          },
        ],
        responses: {
          "200": {
            description: "Batch results (per-item status included, overall 200)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        summary: "Fetch multiple API paths with a JSON body",
        description:
          "Same as `GET /batch` but accepts a JSON body `{ \"paths\": [...] }`, allowing longer path lists that would overflow URL length limits. Body max 8KB. Never cached.",
        operationId: "postBatch",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["paths"],
                properties: {
                  paths: {
                    type: "array",
                    minItems: 1,
                    maxItems: 10,
                    items: { type: "string" },
                    example: ["/album?slug=2915", "/artist?slug=30-radiohead"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Batch results (per-item status included, overall 200)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/status": {
      get: {
        summary: "API status and metadata",
        description: "Return API name, version, OpenAPI version, endpoint count and current timestamp. Never cached.",
        operationId: "getStatus",
        responses: {
          "200": {
            description: "API status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatusResult" },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/health": {
      get: {
        summary: "Health check",
        description: "Return `{\"status\":\"ok\"}`. Never cached.",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/releases": {
      get: {
        summary: "New album releases",
        operationId: "getReleases",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter releases by format/type (e.g. lp, ep, single, live, mixtape, compilation, etc.)",
          },
        ],
        responses: {
          "200": {
            description: "List of new releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    type: { type: ["string", "null"] },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/singles": {
      get: {
        summary: "New single releases",
        operationId: "getReleaseSingles",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "List of new singles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/upcoming": {
      get: {
        summary: "Upcoming album releases",
        operationId: "getUpcoming",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "List of upcoming releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/discover": {
      get: {
        summary: "Popular albums right now",
        operationId: "getDiscover",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Currently popular albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/discover/singles": {
      get: {
        summary: "Popular singles right now",
        operationId: "getDiscoverSingles",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Currently popular singles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/discover/anticipated": {
      get: {
        summary: "Highly anticipated upcoming albums",
        operationId: "getDiscoverAnticipated",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Most anticipated albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/discover/under-radar": {
      get: {
        summary: "Under the radar albums",
        operationId: "getDiscoverUnderRadar",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Hidden gem albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/must-hear": {
      get: {
        summary: "Must-hear albums",
        description:
          "Albums designated as must-hear. Use `year` for a specific year (e.g. 2026) or `decade` for a decade (e.g. 2020s). Paginated with `page`.",
        operationId: "getMustHear",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "year",
            in: "query",
            schema: { type: "integer" },
            example: 2026,
          },
          {
            name: "decade",
            in: "query",
            schema: { type: "string", enum: ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Must-hear albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "string" },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/news": {
      get: {
        summary: "Music news feed",
        operationId: "getNews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["newsworthy", "new", "comment"],
              default: "newsworthy",
            },
            description: "Feed type: newsworthy (top), new (latest), comment (most discussed)",
          },
        ],
        responses: {
          "200": {
            description: "News items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    type: { type: "string" },
                    hasNextPage: { type: "boolean" },
                    items: { type: "array", items: { $ref: "#/components/schemas/NewsItem" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/feed/news": {
      get: {
        summary: "Music news feed from RSS",
        operationId: "getNewsFeed",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["json", "xml"], default: "json" },
            description: "Response format: json (default) or xml",
          },
        ],
        responses: {
          "200": {
            description: "News feed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RssFeed" },
              },
              "application/xml": {
                schema: { type: "string" },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/feed/news.xml": {
      get: {
        summary: "Raw RSS 2.0 XML news feed",
        operationId: "getNewsFeedXml",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "RSS XML news feed",
            content: {
              "application/xml": {
                schema: { type: "string" },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/lists": {
      get: {
        summary: "Year-end critic lists index",
        operationId: "getLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "year",
            in: "query",
            schema: { type: "integer" },
            example: 2025,
          },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["newest"] },
            description: "Pass newest for recently added lists",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Critic list index",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "integer" },
                    sort: { type: ["string", "null"] },
                    page: { type: "integer" },
                    lists: { type: "array", items: { $ref: "#/components/schemas/ListEntry" } },
                    sections: { type: "array", items: { $ref: "#/components/schemas/ListIndexSection" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/list/summary": {
      get: {
        summary: "Year-end critic list aggregate",
        description: "Aggregated rankings across major publications' year-end best-of album lists",
        operationId: "getListSummary",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "year",
            in: "query",
            schema: { type: "integer" },
            example: 2025,
            description: "Year-end aggregate year (defaults to previous year)",
          },
          {
            name: "genre",
            in: "query",
            schema: { type: "string" },
            example: "hip-hop",
            description: "Filter by genre slug (e.g. hip-hop, electronic, rock, metal, pop)",
          },
        ],
        responses: {
          "200": {
            description: "Year-end critic aggregate rankings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "integer" },
                    genre: { type: ["string", "null"] },
                    totalLists: { type: ["integer", "null"] },
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/YearEndAggregateItem" },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/year-end": {
      get: {
        summary: "Community year-end list aggregate",
        description: "Aggregated consensus albums of the year compiled from thousands of community lists",
        operationId: "getCommunityYearEnd",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "year",
            in: "query",
            schema: { type: "integer" },
            example: 2025,
            description: "Year-end community list year (defaults to previous year)",
          },
        ],
        responses: {
          "200": {
            description: "Community year-end aggregate rankings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "integer" },
                    totalLists: { type: ["integer", "null"] },
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/YearEndAggregateItem" },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/list/{slug}": {
      get: {
        summary: "Get a specific critic list",
        operationId: "getList",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "2618-the-needle-drops-top-50-albums-of-2025",
          },
        ],
        responses: {
          "200": {
            description: "List detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    sourceUrl: { type: "string" },
                    items: { type: "array", items: { $ref: "#/components/schemas/ListDetailItem" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search": {
      get: {
        summary: "Search all content",
        operationId: "search",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "radiohead",
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                    labels: { type: "array", items: { $ref: "#/components/schemas/SearchLabel" } },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                    news: { type: "array", items: { $ref: "#/components/schemas/NewsSearchItem" } },
                    tags: { type: "array", items: { $ref: "#/components/schemas/TagItem" } },
                    users: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/all": {
      get: {
        summary: "Search all content (alias)",
        description: "Alias of `/search`.",
        operationId: "searchAll",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "radiohead",
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                    labels: { type: "array", items: { $ref: "#/components/schemas/SearchLabel" } },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                    news: { type: "array", items: { $ref: "#/components/schemas/NewsSearchItem" } },
                    tags: { type: "array", items: { $ref: "#/components/schemas/TagItem" } },
                    users: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/albums": {
      get: {
        summary: "Search albums",
        operationId: "searchAlbums",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Album search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/artists": {
      get: {
        summary: "Search artists",
        operationId: "searchArtists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Artist search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/labels": {
      get: {
        summary: "Search record labels",
        operationId: "searchLabels",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Label search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    labels: { type: "array", items: { $ref: "#/components/schemas/SearchLabel" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/lists": {
      get: {
        summary: "Search user lists",
        operationId: "searchLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User list search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    total: { type: ["integer", "null"] },
                    totalPages: { type: ["integer", "null"] },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/news": {
      get: {
        summary: "Search news",
        operationId: "searchNews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "News search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    news: { type: "array", items: { $ref: "#/components/schemas/NewsSearchItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/tags": {
      get: {
        summary: "Search tags",
        operationId: "searchTags",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Tag search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    tags: { type: "array", items: { $ref: "#/components/schemas/TagItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/users": {
      get: {
        summary: "Search users",
        operationId: "searchUsers",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    page: { type: "integer" },
                    users: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/search/autocomplete": {
      get: {
        summary: "Typeahead autocomplete suggestions across all entities",
        operationId: "getSearchAutocomplete",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Search query prefix" },
        ],
        responses: {
          "200": {
            description: "Search autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    suggestions: { type: "array", items: { $ref: "#/components/schemas/SearchAutocompleteItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/labels/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for record labels",
        operationId: "getLabelAutocomplete",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Label query prefix" },
        ],
        responses: {
          "200": {
            description: "Label autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    suggestions: { type: "array", items: { $ref: "#/components/schemas/LabelAutocompleteItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/label/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for record labels (alias)",
        description: "Alias of `/labels/autocomplete`.",
        operationId: "getLabelAutocompleteAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Label query prefix" },
        ],
        responses: {
          "200": {
            description: "Label autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    suggestions: { type: "array", items: { $ref: "#/components/schemas/LabelAutocompleteItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist": {
      get: {
        summary: "Get artist details and discography",
        operationId: "getArtist",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, description: "Artist slug, e.g. '183-kanye-west'", example: "183-kanye-west" },
          { name: "type", in: "query", required: false, schema: { type: "string" }, description: "Filter discography by release type (lp, ep, single, mixtape, ...)" },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["critic", "user", "popular"] }, description: "Sort discography (works best with type=featured)" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Artist details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ArtistDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/discography": {
      get: {
        summary: "Get artist discography sections",
        description: "Return only the discography sections (albums, EPs, singles, etc.) for an artist, with optional release type filtering and sorting.",
        operationId: "getArtistDiscography",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "slug",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "AOTY artist slug (e.g. '30-radiohead')",
            example: "30-radiohead",
          },
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter discography by release type (lp, ep, single, mixtape, ...)",
          },
          {
            name: "sort",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["critic", "user", "popular"] },
            description: "Sort discography (works best with type=featured)",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Artist discography sections",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    type: { type: ["string", "null"] },
                    sort: { type: ["string", "null"] },
                    page: { type: "integer" },
                    sections: { type: "array", items: { $ref: "#/components/schemas/DiscographySection" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/similar": {
      get: {
        summary: "Get similar artists",
        operationId: "getSimilarArtists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "183-kanye-west" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Similar artists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/songs": {
      get: {
        summary: "Get community's top songs by an artist",
        operationId: "getArtistSongs",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "183-kanye-west" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Top songs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    songs: { type: "array", items: { $ref: "#/components/schemas/TopSong" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/top-songs": {
      get: {
        summary: "Get community's top songs by an artist (alias)",
        description: "Alias of `/artist/songs`.",
        operationId: "getArtistTopSongs",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "183-kanye-west" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Top songs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    songs: { type: "array", items: { $ref: "#/components/schemas/TopSong" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/label": {
      get: {
        summary: "Get label details and releases",
        operationId: "getLabel",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "845-aap-worldwide" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["newest", "oldest", "critic-highest", "critic-lowest", "user-highest", "user-lowest", "artist-name", "album-name", "popularity", "likes"] }, description: "Release ordering (default newest first)" },
        ],
        responses: {
          "200": {
            description: "Label details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LabelDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/label/singles": {
      get: {
        summary: "Get label single releases",
        description: "Same as `/label` but for the label's Singles tab.",
        operationId: "getLabelSingles",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "13-xl" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["newest", "oldest", "critic-highest", "critic-lowest", "user-highest", "user-lowest", "artist-name", "album-name", "popularity", "likes"] }, description: "Release ordering (default newest first)" },
        ],
        responses: {
          "200": {
            description: "Label singles",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LabelDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/genres/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for musical genres",
        operationId: "getGenreAutocomplete",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Genre query prefix", example: "rock" },
        ],
        responses: {
          "200": {
            description: "Genre autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    suggestions: { type: "array", items: { $ref: "#/components/schemas/GenreAutocompleteItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/genre/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for musical genres (alias)",
        description: "Alias of `/genres/autocomplete`.",
        operationId: "getGenreAutocompleteAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Genre query prefix", example: "rock" },
        ],
        responses: {
          "200": {
            description: "Genre autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    suggestions: { type: "array", items: { $ref: "#/components/schemas/GenreAutocompleteItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/genres": {
      get: {
        summary: "List all genres with sample albums",
        operationId: "getGenres",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Genre index",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    genres: { type: "array", items: { $ref: "#/components/schemas/GenreIndexItem" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/genre": {
      get: {
        summary: "Get genre page (best albums, recent, top artists)",
        description: "Omit period for the genre overview. Use period=2026 for best of a year, period=all for all-time, period=recent for new releases.",
        operationId: "getGenre",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "3-hip-hop" },
          { name: "period", in: "query", required: false, schema: { type: "string" }, example: "2026" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["standard"] }, description: "Pass standard to disable weighted sorting (chart periods)" },
          { name: "minReviews", in: "query", required: false, schema: { type: "string", enum: ["5", "10", "15", "20"] }, description: "Minimum review count (chart periods)" },
        ],
        responses: {
          "200": {
            description: "Genre detail",
            content: { "application/json": { schema: { $ref: "#/components/schemas/GenreDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/subgenres": {
      get: {
        summary: "Get subgenres for a genre by ID via AJAX backend",
        operationId: "getSubGenres",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "genreId", in: "query", required: true, schema: { type: "string" }, example: "3" },
          { name: "breadIds", in: "query", required: false, schema: { type: "string" }, description: "Comma-separated ancestor genre IDs for breadcrumbs", example: "3,12" },
        ],
        responses: {
          "200": {
            description: "Subgenres list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    genreId: { type: "string" },
                    heading: { type: "string" },
                    subgenres: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/genre/name": {
      get: {
        summary: "Resolve genre name from ID",
        description: "Get the canonical genre name for a numeric genre ID",
        operationId: "getGenreName",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "id", in: "query", required: true, schema: { type: "string" }, example: "7" },
        ],
        responses: {
          "200": {
            description: "Genre name resolution",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/tag": {
      get: {
        summary: "Browse albums or media by tag",
        operationId: "getTag",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "tag", in: "query", required: true, schema: { type: "string" }, example: "hip hop" },
          { name: "type", in: "query", required: false, schema: { type: "string", enum: ["albums", "media", "singles", "artists"], default: "albums" } },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["popularity", "newest-first", "critic-score", "user-score"], default: "popularity" } },
          { name: "year", in: "query", required: false, schema: { type: "string" }, description: "Filter tag albums by year, e.g. 2026" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Tag results",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TagResults" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/publication": {
      get: {
        summary: "Get publication details, recent reviews and top albums",
        operationId: "getPublication",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1-pitchfork" },
        ],
        responses: {
          "200": {
            description: "Publication details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/PublicationDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/publication/reviews": {
      get: {
        summary: "Get recent reviews by a publication",
        operationId: "getPublicationReviews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1-pitchfork" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Publication reviews",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    reviews: { type: "array", items: { $ref: "#/components/schemas/PublicationReview" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/publication/lists": {
      get: {
        summary: "Get year-end lists by a publication",
        operationId: "getPublicationLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1-pitchfork" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Publication lists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    lists: { type: "array", items: { $ref: "#/components/schemas/ListEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/critic": {
      get: {
        summary: "Get critic details and reviews",
        operationId: "getCritic",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "2-anthony-fantano" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Critic details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CriticDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/critic/reviews": {
      get: {
        summary: "Get critic details and reviews (alias)",
        description: "Alias of `/critic`.",
        operationId: "getCriticAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "2-anthony-fantano" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Critic details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CriticDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/song": {
      get: {
        summary: "Get song details, credits and ratings",
        operationId: "getSong",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "2580-ghost-town" },
        ],
        responses: {
          "200": {
            description: "Song details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SongDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/song/ratings": {
      get: {
        summary: "All user ratings for a song, paginated",
        operationId: "getSongRatings",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "2580-ghost-town" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Song ratings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    totalPages: { type: ["integer", "null"] },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/SongRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/song/corrections": {
      get: {
        summary: "Song edit and correction history",
        description: "Submission source, change log, and submitted corrections for a song",
        operationId: "getSongCorrections",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "songId", in: "query", schema: { type: "string" }, description: "Numeric song ID", example: "811760" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Song slug", example: "811760-sandman" },
        ],
        responses: {
          "200": {
            description: "Song corrections and audit history",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EntityCorrectionsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/song/critic-lists": {
      get: {
        summary: "Year-end critic lists ranking a song",
        description: "Year-end list placements for a song, scraped from the Critic Lists table on the song page.",
        operationId: "getSongCriticLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "2580-ghost-town" },
        ],
        responses: {
          "200": {
            description: "Song critic list placements",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SongCriticListsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/home": {
      get: {
        summary: "Homepage sections (new releases, charts, trending, ...)",
        operationId: "getHome",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Homepage content",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    newReleases: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    news: { type: "array", items: { $ref: "#/components/schemas/NewsItem" } },
                    anticipated: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    criticsBest: { type: "array", items: { $ref: "#/components/schemas/ChartItem" } },
                    usersBest: { type: "array", items: { $ref: "#/components/schemas/ChartItem" } },
                    popular: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    popularReviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
                    underRadar: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    onThisDay: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    recentlyAdded: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    topSongs: { type: "array", items: { $ref: "#/components/schemas/TopSong" } },
                    bestSongs: { type: "array", items: { $ref: "#/components/schemas/HomepageSong" } },
                    popularGenres: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
                    browseBy: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/songs/top": {
      get: {
        summary: "Users' best songs of a year, decade, or all time",
        operationId: "getTopSongs",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "period", in: "query", schema: { type: "string" }, description: "Year (2026), decade (2020s) or all", example: "2026" },
          { name: "year", in: "query", schema: { type: "string" }, description: "Alias for period (e.g. 2026)", example: "2026" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Top songs chart",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    period: { type: "string" },
                    page: { type: "integer" },
                    totalPages: { type: ["integer", "null"] },
                    note: { type: ["string", "null"] },
                    years: { type: "array", items: { $ref: "#/components/schemas/PageTab" } },
                    songs: { type: "array", items: { $ref: "#/components/schemas/TopSong" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/songs/best": {
      get: {
        summary: "Best songs of the year aggregate",
        description: "Consensus best songs of the year compiled from critic year-end song lists",
        operationId: "getBestSongs",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "year",
            in: "query",
            schema: { type: "integer" },
            example: 2025,
            description: "Year-end list year (defaults to previous year)",
          },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["points", "lists"], default: "points" },
            description: "Sort criteria: total points or number of lists",
          },
        ],
        responses: {
          "200": {
            description: "Best songs aggregate rankings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "integer" },
                    sort: { type: "string" },
                    songs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/SongsBestItem" },
                    },
                    playlistUrl: { type: ["string", "null"] },
                    banner: { type: ["string", "null"] },
                    availableYears: { type: "array", items: { type: "integer" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/songs/best/lists": {
      get: {
        summary: "Per-publication song lists behind the aggregate",
        description: "Methodology and individual critic song lists compiled into the year-end aggregate",
        operationId: "getBestSongsLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", schema: { type: "integer" }, example: 2025 },
          { name: "sort", in: "query", schema: { type: "string", enum: ["points", "lists"], default: "points" } },
        ],
        responses: {
          "200": {
            description: "Individual song lists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "integer" },
                    sort: { type: "string" },
                    methodology: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          place: { type: "string" },
                          points: { type: "string" },
                        },
                      },
                    },
                    individualLists: { type: "array", items: { $ref: "#/components/schemas/IndividualSongList" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user": {
      get: {
        summary: "Get user profile and stats",
        operationId: "getUser",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "User profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfile" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/ratings": {
      get: {
        summary: "Get albums rated by a user",
        operationId: "getUserRatings",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "type", in: "query", required: false, schema: { type: "string" }, description: "Filter by release type (lp, ep, single, mixtape, compilation, reissue, soundtrack, perfect...)" },
          { name: "decade", in: "query", required: false, schema: { type: "string" }, description: "Filter by decade, e.g. 2020", example: "2020" },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["highest", "lowest", "release-date", "perfect"] } },
          { name: "year", in: "query", required: false, schema: { type: "string" }, description: "Filter by release year, e.g. 2026", example: "2026" },
          { name: "genre", in: "query", required: false, schema: { type: "string" }, description: "Filter by genre ID, e.g. 7", example: "7" },
        ],
        responses: {
          "200": {
            description: "User ratings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    type: { type: ["string", "null"] },
                    decade: { type: ["string", "null"] },
                    sort: { type: ["string", "null"] },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/perfect": {
      get: {
        summary: "User's perfect 100-rated releases",
        description: "Get all releases given a perfect 100 rating by a user",
        operationId: "getUserPerfect",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" }, example: "rbbaddie" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User perfect ratings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/reviews": {
      get: {
        summary: "Get reviews written by a user",
        operationId: "getUserReviews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User reviews",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    sort: { type: "string" },
                    reviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/listened": {
      get: {
        summary: "Get albums a user has listened to",
        operationId: "getUserListened",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Listened albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/library": {
      get: {
        summary: "Get a user's library",
        operationId: "getUserLibrary",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "t", in: "query", required: false, schema: { type: "string", enum: ["listened", "rated", "unrated"] }, description: "Filter: listened, rated or unrated" },
          { name: "s", in: "query", required: false, schema: { type: "string", enum: ["newest", "oldest", "critic", "user"] }, description: "Sort order" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Library albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    show: { type: ["string", "null"] },
                    sort: { type: ["string", "null"] },
                    page: { type: "integer" },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/liked-albums": {
      get: {
        summary: "Get albums a user has liked (favorited)",
        operationId: "getUserLikedAlbums",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User liked albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/tags": {
      get: {
        summary: "Get tags a user has applied",
        operationId: "getUserTags",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "scope", in: "query", schema: { type: "string", enum: ["albums", "artists"], default: "albums" } },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["popularity", "name"] } },
        ],
        responses: {
          "200": {
            description: "User tags",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    scope: { type: "string" },
                    sort: { type: ["string", "null"] },
                    tags: { type: "array", items: { $ref: "#/components/schemas/UserTagEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/tag": {
      get: {
        summary: "Get a user's albums with a specific tag",
        operationId: "getUserTag",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "tag", in: "query", required: true, schema: { type: "string" }, example: "masterpiece" },
          { name: "sort", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Tagged albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    tag: { type: "string" },
                    sort: { type: ["string", "null"] },
                    page: { type: "integer" },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/lists": {
      get: {
        summary: "Get lists created by a user",
        operationId: "getUserLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User lists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/list": {
      get: {
        summary: "Get a specific user list",
        operationId: "getUserList",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, description: "List id + slug, e.g. '4445/mu-essentials'", example: "4445/mu-essentials" },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["list-low-high", "artist-name", "recent", "popular", "creator-highest", "creator-lowest", "critic-highest", "critic-lowest", "user-highest", "user-lowest", "newest", "oldest"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User list detail",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserListDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/followers": {
      get: {
        summary: "Get a user's followers",
        operationId: "getUserFollowers",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Followers",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    kind: { type: "string" },
                    page: { type: "integer" },
                    users: { type: "array", items: { $ref: "#/components/schemas/FollowUser" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/following-artists": {
      get: {
        summary: "Get artists a user follows",
        description: "Artist rows on the following tab carry per-artist follower counts.",
        operationId: "getUserFollowingArtists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Followed artists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    artists: { type: "array", items: { $ref: "#/components/schemas/FollowArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/spin-list": {
      get: {
        summary: "Get a user's spin list",
        description: "Albums on the user's spin list. Same shape as the library endpoint.",
        operationId: "getUserSpinList",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Spin list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    page: { type: "integer" },
                    ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/following": {
      get: {
        summary: "Get users a user follows",
        operationId: "getUserFollowing",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Following",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    kind: { type: "string" },
                    page: { type: "integer" },
                    users: { type: "array", items: { $ref: "#/components/schemas/FollowUser" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/review": {
      get: {
        summary: "Get a single user review of an album",
        operationId: "getUserReview",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, description: "Album id + slug, e.g. '1998-my-beautiful-dark-twisted-fantasy'", example: "1998-my-beautiful-dark-twisted-fantasy" },
        ],
        responses: {
          "200": {
            description: "User review detail",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserReviewDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/genres": {
      get: {
        summary: "Get all genres a user has rated and listened to",
        operationId: "getUserGenres",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "User genres breakdown",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    genres: { type: "array", items: { $ref: "#/components/schemas/UserGenreItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/badges": {
      get: {
        summary: "Get all badges unlocked by a user",
        operationId: "getUserBadges",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "User unlocked badges",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    badges: { type: "array", items: { $ref: "#/components/schemas/UserBadgeItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/stats": {
      get: {
        summary: "User overview statistics",
        description: "Get user rating counts, review counts, list counts, follower counts, and score distribution.",
        operationId: "getUserStats",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" }, example: "rob" },
        ],
        responses: {
          "200": {
            description: "User statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    displayName: { type: "string" },
                    memberSince: { type: ["string", "null"] },
                    subscriber: { type: "boolean" },
                    stats: {
                      type: "object",
                      properties: {
                        ratings: { type: "string" },
                        reviews: { type: "string" },
                        lists: { type: "string" },
                        followers: { type: "string" },
                        following: { type: "string" },
                      },
                    },
                    ratingDistribution: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          count: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/contributions": {
      get: {
        summary: "User site contributions popup",
        description: "Fetch a user's submitted albums, corrections, and site contributions via userStats.php",
        operationId: "getUserContributions",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", schema: { type: "string" }, description: "Username (will resolve numeric ID)", example: "patton" },
          { name: "userId", in: "query", schema: { type: "string" }, description: "Numeric user ID", example: "175" },
        ],
        responses: {
          "200": {
            description: "User contributions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: { type: "integer" },
                    username: { type: ["string", "null"] },
                    popType: { type: "string" },
                    html: { type: "string" },
                    items: { type: "array", items: { $ref: "#/components/schemas/UserContributionEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/stats/popup": {
      get: {
        summary: "User statistics modal popup",
        description: "Fetch the detailed user stats popup via userStats.php",
        operationId: "getUserStatsPopup",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", schema: { type: "string" }, description: "Username (will resolve numeric ID)", example: "patton" },
          { name: "userId", in: "query", schema: { type: "string" }, description: "Numeric user ID", example: "175" },
        ],
        responses: {
          "200": {
            description: "User stats popup data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: { type: "integer" },
                    username: { type: ["string", "null"] },
                    popType: { type: "string" },
                    html: { type: "string" },
                    items: { type: "array", items: { $ref: "#/components/schemas/UserContributionEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/stats-popup": {
      get: {
        summary: "User statistics modal popup (alias)",
        description: "Alias of `/user/stats/popup`.",
        operationId: "getUserStatsPopupAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", schema: { type: "string" }, description: "Username (will resolve numeric ID)", example: "patton" },
          { name: "userId", in: "query", schema: { type: "string" }, description: "Numeric user ID", example: "175" },
        ],
        responses: {
          "200": {
            description: "User stats popup data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    userId: { type: "integer" },
                    username: { type: ["string", "null"] },
                    popType: { type: "string" },
                    html: { type: "string" },
                    items: { type: "array", items: { $ref: "#/components/schemas/UserContributionEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/favorites": {
      get: {
        summary: "User favorite albums",
        description: "Get favorite albums pinned to a user's profile.",
        operationId: "getUserFavorites",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" }, example: "rob" },
        ],
        responses: {
          "200": {
            description: "User favorites",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    favorites: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                    favoriteArtists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/year-end": {
      get: {
        summary: "User's personal year-end album list",
        description: "Get a specific user's ranked album of the year list for a given year",
        operationId: "getUserYearEnd",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "username",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "rbbaddie",
          },
          {
            name: "year",
            in: "query",
            required: true,
            schema: { type: "integer" },
            example: 2025,
          },
        ],
        responses: {
          "200": {
            description: "User year-end list detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserYearEndResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/distribution": {
      get: {
        summary: "User rating score distribution",
        description: "Get a user's rating distribution histogram by media format",
        operationId: "getUserDistribution",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "username",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "rbbaddie",
          },
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["albums", "singles", "videos", "tracks"], default: "albums" },
            description: "Media format to show distribution for",
          },
        ],
        responses: {
          "200": {
            description: "User rating distribution",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserDistributionResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/artist-ratings": {
      get: {
        summary: "User ratings for a specific artist",
        description: "Get all ratings given by a user for releases by a specific artist",
        operationId: "getUserArtistRatings",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" }, example: "rbbaddie" },
          { name: "artistId", in: "query", required: true, schema: { type: "string" }, example: "2255" },
        ],
        responses: {
          "200": {
            description: "User ratings for artist",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserArtistRatingsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user/track-ratings": {
      get: {
        summary: "User's track-by-track ratings for an album",
        description: "Get all individual track scores given by a user on an album",
        operationId: "getUserAlbumTrackRatings",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "username", in: "query", required: true, schema: { type: "string" }, example: "rbbaddie" },
          { name: "albumId", in: "query", schema: { type: "string" }, example: "1535377", description: "Numeric album ID" },
          { name: "slug", in: "query", schema: { type: "string" }, example: "1535377-hilary-duff-luck-or-something", description: "Album slug starting with ID" },
        ],
        responses: {
          "200": {
            description: "User album track ratings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserAlbumTrackRatingsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/users": {
      get: {
        summary: "Community updates (latest reviews, lists and discussions)",
        operationId: "getCommunity",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Community updates",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                    discussions: { type: "array", items: { $ref: "#/components/schemas/DiscussionEntry" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/user-reviews": {
      get: {
        summary: "Popular user reviews across the site",
        operationId: "getGlobalUserReviews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "period", in: "query", schema: { type: "string", enum: ["all", "popular", "month", "year"], default: "all" }, description: "all = default feed, popular = all-time popular, month = popular this month, year = popular this year" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User reviews",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    period: { type: "string" },
                    page: { type: "integer" },
                    reviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/ratings/sources": {
      get: {
        summary: "Available publication rating sources",
        description: "List all publication and critic aggregate sources available for charts for a given year",
        operationId: "getRatingSources",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", schema: { type: "string", default: "2026" }, example: "2026" },
        ],
        responses: {
          "200": {
            description: "Rating sources list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RatingSourcesResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/ratings/genres": {
      get: {
        summary: "Available genres for chart filtering",
        description: "List all genres available for rating chart filtering for a given year",
        operationId: "getRatingGenres",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", schema: { type: "string", default: "2026" }, example: "2026" },
          { name: "type", in: "query", schema: { type: "string", default: "criticHighestRated" } },
        ],
        responses: {
          "200": {
            description: "Chart genres list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RatingGenresResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/ratings": {
      get: {
        summary: "Album charts (highest/lowest rated, per publication, per genre)",
        description: "Source examples: 6-highest-rated, user-highest-rated, worst, 1-pitchfork-highest-rated. Period examples: 2026, 2020s, all.",
        operationId: "getRatings",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "source", in: "query", schema: { type: "string", default: "6-highest-rated" } },
          { name: "period", in: "query", schema: { type: "string", default: "2026" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
          { name: "genre", in: "query", required: false, schema: { type: "string" }, description: "Genre slug suffix, e.g. 'hip-hop' (only with source=user-highest-rated)" },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["standard"] }, description: "Pass standard to disable weighted sorting" },
          { name: "minReviews", in: "query", required: false, schema: { type: "string", enum: ["5", "10", "15", "20"] } },
        ],
        responses: {
          "200": {
            description: "Chart items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    source: { type: "string" },
                    period: { type: "string" },
                    page: { type: "integer" },
                    totalPages: { type: ["integer", "null"] },
                    items: { type: "array", items: { $ref: "#/components/schemas/ChartItem" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/top-artists": {
      get: {
        summary: "Highest rated artists, optionally by genre",
        operationId: "getTopArtists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "genre", in: "query", required: false, schema: { type: "string" }, example: "hip-hop" },
          { name: "scope", in: "query", schema: { type: "string", enum: ["critics", "users"], default: "critics" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Top artists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    genre: { type: ["string", "null"] },
                    scope: { type: "string" },
                    page: { type: "integer" },
                    artists: { type: "array", items: { $ref: "#/components/schemas/TopArtistEntry" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/this-week/singles": {
      get: {
        summary: "This week's new single releases",
        operationId: "getReleasesThisWeekSingles",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "This week's singles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/this-week": {
      get: {
        summary: "This week's new releases",
        operationId: "getReleasesThisWeek",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "This week's releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/year": {
      get: {
        summary: "Browse releases by year",
        description: "Browse album releases in a given year, optionally filtered by genre and paginated.",
        operationId: "getReleasesYear",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", required: true, schema: { type: "string" }, description: "4-digit release year", example: "2024" },
          { name: "genre", in: "query", required: false, schema: { type: "string" }, description: "Filter by genre slug" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Year releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "string" },
                    genre: { type: ["string", "null"] },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/decade": {
      get: {
        summary: "Browse releases by decade",
        operationId: "getReleasesDecade",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "decade", in: "query", required: true, schema: { type: "string" }, example: "2020s" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Filter by genre slug" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Decade releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    decade: { type: "string" },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/month": {
      get: {
        summary: "Browse releases by month",
        operationId: "getReleasesMonth",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", schema: { type: "string" }, example: "2026" },
          { name: "month", in: "query", required: true, schema: { type: "string" }, example: "september-09" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Filter by genre slug" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Month releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "string" },
                    month: { type: "string" },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/week": {
      get: {
        summary: "Browse releases by week",
        operationId: "getReleasesWeek",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", schema: { type: "string" }, example: "2026" },
          { name: "week", in: "query", required: true, schema: { type: "string" }, example: "36" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Filter by genre slug" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Week releases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "string" },
                    week: { type: "string" },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/by-date": {
      get: {
        summary: "Browse releases by year, month, week or decade",
        operationId: "getReleasesByDate",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "year", in: "query", schema: { type: "string" }, example: "2026" },
          { name: "month", in: "query", required: false, schema: { type: "string" }, description: "Month slug, e.g. 'september-09'", example: "september-09" },
          { name: "week", in: "query", required: false, schema: { type: "string" }, description: "ISO week number, e.g. '36'" },
          { name: "decade", in: "query", required: false, schema: { type: "string" }, example: "2020s" },
          { name: "genre", in: "query", required: false, schema: { type: "string" }, description: "Genre id filter, e.g. '3'" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Releases for the period",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    year: { type: "string" },
                    month: { type: ["string", "null"] },
                    week: { type: ["string", "null"] },
                    decade: { type: ["string", "null"] },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/releases/vibe": {
      get: {
        summary: "Releases by vibe mood/aesthetic tag",
        operationId: "getReleasesByVibe",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "vibe", in: "query", required: true, schema: { type: "string" }, example: "anthemic" },
          { name: "year", in: "query", required: false, schema: { type: "string" }, example: "2024" },
          { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["release", "critic", "user", "likes"], default: "release" } },
          { name: "type", in: "query", required: false, schema: { type: "string" }, example: "lp" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Releases for the vibe",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    vibe: { type: "string" },
                    year: { type: "string" },
                    sort: { type: "string" },
                    type: { type: ["string", "null"] },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/recently-added": {
      get: {
        summary: "Recently added albums",
        operationId: "getRecentlyAdded",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Recently added albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/on-this-day": {
      get: {
        summary: "Album anniversaries released on this day",
        operationId: "getOnThisDay",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "On-this-day albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/discover/top-rated": {
      get: {
        summary: "Recent best music",
        operationId: "getDiscoverTopRated",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Top rated recent albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/discover/people": {
      get: {
        summary: "Discover albums people are talking about",
        operationId: "getDiscoverPeople",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Trending albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/news-item": {
      get: {
        summary: "Get a single news item with comments",
        operationId: "getNewsItem",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "33593-converge-unleash-new-song-doom-in-bloom" },
        ],
        responses: {
          "200": {
            description: "News detail",
            content: { "application/json": { schema: { $ref: "#/components/schemas/NewsDetail" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/news-item/embed": {
      get: {
        summary: "Raw inline embed fragment for a news link",
        description: "Fetch embedded player or widget HTML for a news link via showContent.php",
        operationId: "getNewsEmbed",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "id", in: "query", required: true, schema: { type: "string" }, description: "News link ID", example: "12342" },
        ],
        responses: {
          "200": {
            description: "News embed HTML",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    html: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/similar": {
      get: {
        summary: "Albums similar to the given album",
        operationId: "getSimilarAlbums",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Similar albums",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/user-reviews": {
      get: {
        summary: "User reviews for an album",
        operationId: "getAlbumUserReviews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["popular", "recent", "worst"], default: "popular" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["reviews", "ratings"], default: "reviews" }, description: "Filter between text reviews and numeric ratings" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Album user reviews",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    sort: { type: "string" },
                    type: { type: "string" },
                    page: { type: "integer" },
                    totalRatings: { type: ["string", "null"] },
                    totalPages: { type: ["integer", "null"] },
                    commentCount: { type: ["integer", "null"] },
                    header: { type: ["object", "null"] },
                    likePercentage: { type: ["string", "null"] },
                    dislikePercentage: { type: ["string", "null"] },
                    distribution: { type: "array", items: { $ref: "#/components/schemas/AlbumDistributionRow" } },
                    reviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/comments": {
      get: {
        summary: "Comments on an album",
        operationId: "getAlbumComments",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Album comments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    comments: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
                    moreDiscussion: { type: "array", items: { $ref: "#/components/schemas/DiscussionEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/user-lists": {
      get: {
        summary: "User lists containing an album",
        operationId: "getAlbumUserLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User lists with this album",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/comments": {
      get: {
        summary: "All comments for any item via AJAX",
        description: "Get full comment thread for a user review, news article, user list, year-end list, or album without truncation",
        operationId: "getAllComments",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "type", in: "query", required: true, schema: { type: "string", enum: ["user_review", "news", "user_list", "yearEndList", "album"] }, example: "user_review" },
          { name: "itemId", in: "query", required: true, schema: { type: "string" }, example: "10497555" },
          { name: "albumId", in: "query", schema: { type: "string" }, example: "1931016" },
        ],
        responses: {
          "200": {
            description: "Full comment thread",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AllCommentsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/comments/all": {
      get: {
        summary: "All comments for any item via AJAX (alias)",
        description: "Alias of `/comments`: full comment thread for a user review, news article, user list, year-end list, or album without truncation.",
        operationId: "getAllCommentsAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "type", in: "query", required: true, schema: { type: "string", enum: ["user_review", "news", "user_list", "yearEndList", "album"] }, example: "user_review" },
          { name: "itemId", in: "query", required: true, schema: { type: "string" }, example: "10497555" },
          { name: "albumId", in: "query", schema: { type: "string" }, example: "1931016" },
        ],
        responses: {
          "200": {
            description: "Full comment thread",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AllCommentsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/review/comments": {
      get: {
        summary: "Full comment thread for a user review",
        description: "Convenience endpoint for review comments (calls viewAllComments.php with type=user_review)",
        operationId: "getReviewComments",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "id", in: "query", required: true, schema: { type: "string" }, description: "Numeric review ID", example: "1363027" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Optional numeric album ID", example: "505321" },
        ],
        responses: {
          "200": {
            description: "Review comment thread",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AllCommentsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/list/comments": {
      get: {
        summary: "Full comment thread for a user list",
        description: "Convenience endpoint for user list comments (calls viewAllComments.php with type=user_list)",
        operationId: "getListComments",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "id", in: "query", required: true, schema: { type: "string" }, description: "Numeric user list ID", example: "555" },
        ],
        responses: {
          "200": {
            description: "List comment thread",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AllCommentsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/news-item/comments": {
      get: {
        summary: "Full comment thread for a news item",
        description: "Convenience endpoint for news item comments (calls viewAllComments.php with type=news)",
        operationId: "getNewsItemComments",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "id", in: "query", required: true, schema: { type: "string" }, description: "Numeric news link ID", example: "12342" },
        ],
        responses: {
          "200": {
            description: "News comment thread",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AllCommentsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/critic-lists": {
      get: {
        summary: "Year-end critic lists ranking an album",
        operationId: "getAlbumCriticLists",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Critic lists containing this album",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    lists: { type: "array", items: { $ref: "#/components/schemas/CriticListRank" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/critic-reviews": {
      get: {
        summary: "Critic reviews for an album, sorted",
        operationId: "getAlbumCriticReviews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["highest", "lowest", "newest", "oldest"], default: "highest" } },
        ],
        responses: {
          "200": {
            description: "Sorted critic reviews",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    sort: { type: "string" },
                    reviews: { type: "array", items: { $ref: "#/components/schemas/CriticReview" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/reviews": {
      get: {
        summary: "Album reviews (critic or user)",
        description: "Get reviews for an album. Defaults to sorted critic reviews, or pass type=user for user reviews.",
        operationId: "getAlbumReviews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "type", in: "query", required: false, schema: { type: "string", enum: ["critic", "user"], default: "critic" } },
          { name: "sort", in: "query", required: false, schema: { type: "string" }, description: "Sort order ('highest', 'lowest', 'newest', 'oldest' for critic; 'popular', 'recent', 'worst' for user)" },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
        ],
        responses: {
          "200": {
            description: "Album reviews",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/tags": {
      get: {
        summary: "Complete tag list for an album",
        operationId: "getAlbumTags",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "564912-asap-rocky-dont-be-dumb" },
        ],
        responses: {
          "200": {
            description: "Album tags",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    tags: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/tags/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for album tags",
        operationId: "getAlbumTagAutocomplete",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, example: "hip" },
        ],
        responses: {
          "200": {
            description: "Tag autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/rating-history": {
      get: {
        summary: "Rating score trend at each ratings milestone",
        operationId: "getAlbumRatingHistory",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID (see id in /album)", example: "1998" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug with numeric ID prefix", example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
        ],
        responses: {
          "200": {
            description: "Album rating score trend milestones",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    headline: { type: "string" },
                    milestones: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          milestone: { type: "string" },
                          date: { type: ["string", "null"] },
                          score: { type: "string" },
                          exactScore: { type: ["string", "null"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/distribution": {
      get: {
        summary: "Score distribution histogram for an album",
        operationId: "getAlbumDistribution",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID (see id in /album)", example: "1998" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug with numeric ID prefix", example: "1998-kanye-west-my-beautiful-dark-twisted-fantasy" },
          { name: "format", in: "query", required: false, schema: { type: "string", enum: ["all", "following"], default: "all" } },
        ],
        responses: {
          "200": {
            description: "Album ratings distribution",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    format: { type: "string" },
                    rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          count: { type: "integer" },
                          percentage: { type: ["string", "null"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/credits": {
      get: {
        summary: "Album credits",
        description: "Get performer, songwriter, and production credits for an album.",
        operationId: "getAlbumCredits",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "2915" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "2915-outkast-aquemini" },
        ],
        responses: {
          "200": {
            description: "Album credits",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    credits: { oneOf: [{ type: "array", items: { $ref: "#/components/schemas/CreditSection" } }, { type: "null" }] },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/stats": {
      get: {
        summary: "Album community statistics",
        description: "Get favorites, likes, listens, library count, and list appearances for an album.",
        operationId: "getAlbumStats",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "2915" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "2915-outkast-aquemini" },
        ],
        responses: {
          "200": {
            description: "Album statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    stats: { oneOf: [{ $ref: "#/components/schemas/AlbumStats" }, { type: "null" }] },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/tracklist": {
      get: {
        summary: "Album tracklist",
        description: "Get only the tracklist with ratings, lengths, and features for an album.",
        operationId: "getAlbumTracklist",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album ID or slug", example: "2915-outkast-aquemini" },
          { name: "artist", in: "query", schema: { type: "string" }, example: "OutKast" },
          { name: "name", in: "query", schema: { type: "string" }, example: "Aquemini" },
        ],
        responses: {
          "200": {
            description: "Album tracklist",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: ["string", "null"] },
                    artist: { type: "string" },
                    artistUrl: { type: "string" },
                    artistImage: { type: ["string", "null"] },
                    title: { type: "string" },
                    url: { type: "string" },
                    tracklist: { type: "array", items: { $ref: "#/components/schemas/Track" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/streaming": {
      get: {
        summary: "Album streaming links",
        description: "Get streaming service links (Spotify, Apple Music, Tidal, Amazon, etc.) for an album.",
        operationId: "getAlbumStreaming",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album ID or slug", example: "2915-outkast-aquemini" },
          { name: "artist", in: "query", schema: { type: "string" }, example: "OutKast" },
          { name: "name", in: "query", schema: { type: "string" }, example: "Aquemini" },
        ],
        responses: {
          "200": {
            description: "Album streaming links",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: ["string", "null"] },
                    artist: { type: "string" },
                    artistUrl: { type: "string" },
                    artistImage: { type: ["string", "null"] },
                    title: { type: "string" },
                    url: { type: "string" },
                    streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/streaming-links": {
      get: {
        summary: "Album streaming links (alias)",
        description: "Alias of `/album/streaming`.",
        operationId: "getAlbumStreamingAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album ID or slug", example: "2915-outkast-aquemini" },
          { name: "artist", in: "query", schema: { type: "string" }, example: "OutKast" },
          { name: "name", in: "query", schema: { type: "string" }, example: "Aquemini" },
        ],
        responses: {
          "200": {
            description: "Album streaming links",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: ["string", "null"] },
                    artist: { type: "string" },
                    artistUrl: { type: "string" },
                    artistImage: { type: ["string", "null"] },
                    title: { type: "string" },
                    url: { type: "string" },
                    streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/likes": {
      get: {
        summary: "Users who liked an album",
        description: "List users who liked a specific album",
        operationId: "getAlbumLikes",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "564912" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "564912-asap-rocky-dont-be-dumb" },
          { name: "start", in: "query", schema: { type: "integer", default: 0 }, description: "Offset for pagination" },
        ],
        responses: {
          "200": {
            description: "Users who liked album",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    type: { type: "string" },
                    start: { type: "integer" },
                    users: { type: "array", items: { $ref: "#/components/schemas/AlbumUserItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/in-library": {
      get: {
        summary: "Users who added an album to library",
        description: "List users who have this album in their library",
        operationId: "getAlbumInLibrary",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "564912" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "564912-asap-rocky-dont-be-dumb" },
          { name: "start", in: "query", schema: { type: "integer", default: 0 }, description: "Offset for pagination" },
        ],
        responses: {
          "200": {
            description: "Users with album in library",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    type: { type: "string" },
                    start: { type: "integer" },
                    users: { type: "array", items: { $ref: "#/components/schemas/AlbumUserItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/library": {
      get: {
        summary: "Users who added an album to library (alias)",
        description: "Alias of `/album/in-library`.",
        operationId: "getAlbumInLibraryAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "564912" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "564912-asap-rocky-dont-be-dumb" },
          { name: "start", in: "query", schema: { type: "integer", default: 0 }, description: "Offset for pagination" },
        ],
        responses: {
          "200": {
            description: "Users with album in library",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    type: { type: "string" },
                    start: { type: "integer" },
                    users: { type: "array", items: { $ref: "#/components/schemas/AlbumUserItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/images": {
      get: {
        summary: "Album cover art and alternate images",
        description: "Get full resolution cover art and all alternate artwork/vinyl scans for an album",
        operationId: "getAlbumImages",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "564912" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "564912-asap-rocky-dont-be-dumb" },
        ],
        responses: {
          "200": {
            description: "Album artwork images",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AlbumImagesResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/corrections": {
      get: {
        summary: "Album edit and correction history",
        description: "Submission source, change log, and submitted corrections for an album",
        operationId: "getAlbumCorrections",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", schema: { type: "string" }, description: "Numeric album ID", example: "564912" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Album slug starting with ID", example: "564912-asap-rocky-dont-be-dumb" },
        ],
        responses: {
          "200": {
            description: "Album corrections and audit history",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EntityCorrectionsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/corrections": {
      get: {
        summary: "Submission and correction history for an entity",
        description: "Get community edits and corrections for an album, artist, or song.",
        operationId: "getEntityCorrections",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "type", in: "query", required: true, schema: { type: "string", enum: ["album", "artist", "song"] } },
          { name: "id", in: "query", required: true, schema: { type: "string" }, description: "Numeric entity ID or slug starting with ID", example: "2915" },
        ],
        responses: {
          "200": {
            description: "Entity corrections history",
            content: { "application/json": { schema: { $ref: "#/components/schemas/EntityCorrectionsResult" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/album/comments/replies": {
      get: {
        summary: "Replies to an album comment",
        operationId: "getAlbumCommentReplies",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "albumId", in: "query", required: true, schema: { type: "string" }, description: "Numeric album ID (see id in /album)", example: "1998" },
          { name: "commentId", in: "query", required: true, schema: { type: "string" }, example: "4960474" },
        ],
        responses: {
          "200": {
            description: "Comment replies",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    albumId: { type: "string" },
                    commentId: { type: "string" },
                    replies: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/list/comments/replies": {
      get: {
        summary: "Replies to a user list comment",
        description: "Fetch threaded replies to a user list comment via showListCommentReplies.php",
        operationId: "getListCommentReplies",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "listId", in: "query", required: true, schema: { type: "string" }, description: "Numeric user list ID", example: "123" },
          { name: "commentId", in: "query", required: true, schema: { type: "string" }, example: "4960474" },
        ],
        responses: {
          "200": {
            description: "Comment replies",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    listId: { type: "integer" },
                    commentId: { type: "integer" },
                    replies: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/news": {
      get: {
        summary: "News about an artist",
        operationId: "getArtistNews",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "183-kanye-west" },
          { name: "type", in: "query", schema: { type: "string", enum: ["newsworthy", "new"], default: "newsworthy" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Artist news",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    page: { type: "integer" },
                    type: { type: "string" },
                    items: { type: "array", items: { $ref: "#/components/schemas/NewsItem" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/credits": {
      get: {
        summary: "Albums an artist is credited on (features, production, ...)",
        description: "Omit role to list available credit roles with counts.",
        operationId: "getArtistCredits",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "183-kanye-west" },
          { name: "role", in: "query", required: false, schema: { type: "string" }, example: "Feature" },
          { name: "sort", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Credit roles or credited albums",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/corrections": {
      get: {
        summary: "Artist edit and correction history",
        description: "Submission source, change log, and submitted corrections for an artist",
        operationId: "getArtistCorrections",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "2003-asap-rocky" },
        ],
        responses: {
          "200": {
            description: "Artist corrections and audit history",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EntityCorrectionsResult" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/aka": {
      get: {
        summary: "Full Also Known As names for an artist",
        description: "Fetch all alias / alternate names for an artist via the artist credits overlay",
        operationId: "getArtistAka",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "183-kanye-west" },
        ],
        responses: {
          "200": {
            description: "Artist aliases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    artistId: { type: "integer" },
                    alsoKnownAs: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/comments/replies": {
      get: {
        summary: "Replies to an artist comment",
        description: "Fetch threaded replies to an artist comment via showArtistCommentReplies.php",
        operationId: "getArtistCommentReplies",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "artistId", in: "query", required: true, schema: { type: "string" }, description: "Numeric artist ID or artist slug", example: "183" },
          { name: "commentId", in: "query", required: true, schema: { type: "string" }, example: "4960474" },
        ],
        responses: {
          "200": {
            description: "Comment replies",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    artistId: { type: "integer" },
                    commentId: { type: "integer" },
                    replies: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artist/tags/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for artist tags",
        description: "Autocomplete search for artist tags via artistTagAutocomplete.php",
        operationId: "getArtistTagAutocomplete",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, example: "indie" },
        ],
        responses: {
          "200": {
            description: "Artist tag autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artists/tags/autocomplete": {
      get: {
        summary: "Autocomplete suggestions for artist tags (alias)",
        description: "Alias of `/artist/tags/autocomplete`.",
        operationId: "getArtistsTagAutocompleteAlias",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "q", in: "query", required: true, schema: { type: "string" }, example: "indie" },
        ],
        responses: {
          "200": {
            description: "Artist tag autocomplete suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/artist": {
      get: {
        summary: "Get a random artist (never cached)",
        operationId: "getRandomArtist",
        responses: {
          "200": {
            description: "Random artist details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ArtistDetail" } } },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/genre": {
      get: {
        summary: "Get a random genre (never cached)",
        description: "Returns a randomly chosen genre with sample albums. Never cached.",
        operationId: "getRandomGenre",
        responses: {
          "200": {
            description: "Random genre details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    genre: { $ref: "#/components/schemas/GenreIndexItem" },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/song": {
      get: {
        summary: "Get a random popular song (never cached)",
        description: "Returns a randomly chosen song from community top tracks. Optionally filtered by period. Never cached.",
        operationId: "getRandomSong",
        parameters: [
          { name: "period", in: "query", required: false, schema: { type: "string" }, description: "Period or year (e.g. 'all', '2024', '2020s')", example: "all" },
        ],
        responses: {
          "200": {
            description: "Random song details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    period: { type: "string" },
                    song: { $ref: "#/components/schemas/TopSong" },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/must-hear": {
      get: {
        summary: "Get a random must-hear album (never cached)",
        description: "Returns a randomly chosen essential album from the must-hear catalog. Never cached.",
        operationId: "getRandomMustHear",
        parameters: [
          { name: "year", in: "query", required: false, schema: { type: "string" }, description: "Filter by 4-digit year", example: "2020" },
          { name: "decade", in: "query", required: false, schema: { type: "string" }, description: "Filter by decade (e.g. '1990s')", example: "1990s" },
        ],
        responses: {
          "200": {
            description: "Random must-hear album",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    album: { $ref: "#/components/schemas/AlbumBlock" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/filters": {
      get: {
        summary: "Available filter options and bounds for random album generation",
        description: "Fetch valid release types and score/review ranges from randomFilters.php",
        operationId: "getRandomFilters",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Random filter bounds and options",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RandomFiltersMeta" },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/album": {
      get: {
        summary: "Get a random album (never cached)",
        operationId: "getRandomAlbum",
        parameters: [
          { name: "type", in: "query", schema: { type: "string" }, description: "Filter by release type (e.g. lp, ep, single, mixtape, live, etc.)" },
          { name: "yearFrom", in: "query", schema: { type: "string" }, description: "Filter by minimum release year, e.g. 1990" },
          { name: "yearTo", in: "query", schema: { type: "string" }, description: "Filter by maximum release year, e.g. 1999" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Filter by primary genre ID, e.g. 7 (Rock) or 3 (Hip Hop)" },
          { name: "genreSecondary", in: "query", schema: { type: "string" }, description: "Filter by secondary genre ID" },
          { name: "criticScoreMin", in: "query", schema: { type: "string" }, description: "Minimum critic score (0-100)" },
          { name: "criticScoreMax", in: "query", schema: { type: "string" }, description: "Maximum critic score (0-100)" },
          { name: "userScoreMin", in: "query", schema: { type: "string" }, description: "Minimum user score (0-100)" },
          { name: "userScoreMax", in: "query", schema: { type: "string" }, description: "Maximum user score (0-100)" },
          { name: "criticReviewsMin", in: "query", schema: { type: "string" }, description: "Minimum number of critic reviews" },
          { name: "criticReviewsMax", in: "query", schema: { type: "string" }, description: "Maximum number of critic reviews" },
          { name: "userReviewsMin", in: "query", schema: { type: "string" }, description: "Minimum number of user reviews" },
          { name: "userReviewsMax", in: "query", schema: { type: "string" }, description: "Maximum number of user reviews" },
        ],
        responses: {
          "200": {
            description: "Random album details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AlbumDetail" } } },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/random/release": {
      get: {
        summary: "Get a random album or release (alias of /random/album)",
        description: "Returns a random album or release. Query parameters mirror /random/album. Responses are never cached.",
        operationId: "getRandomRelease",
        parameters: [
          { name: "type", in: "query", schema: { type: "string" }, description: "Filter by release type (e.g. lp, ep, single, mixtape, live, etc.)" },
          { name: "yearFrom", in: "query", schema: { type: "string" }, description: "Filter by minimum release year, e.g. 1990" },
          { name: "yearTo", in: "query", schema: { type: "string" }, description: "Filter by maximum release year, e.g. 1999" },
          { name: "genre", in: "query", schema: { type: "string" }, description: "Filter by primary genre ID, e.g. 7 (Rock) or 3 (Hip Hop)" },
          { name: "genreSecondary", in: "query", schema: { type: "string" }, description: "Filter by secondary genre ID" },
          { name: "criticScoreMin", in: "query", schema: { type: "string" }, description: "Minimum critic score (0-100)" },
          { name: "criticScoreMax", in: "query", schema: { type: "string" }, description: "Maximum critic score (0-100)" },
          { name: "userScoreMin", in: "query", schema: { type: "string" }, description: "Minimum user score (0-100)" },
          { name: "userScoreMax", in: "query", schema: { type: "string" }, description: "Maximum user score (0-100)" },
          { name: "criticReviewsMin", in: "query", schema: { type: "string" }, description: "Minimum number of critic reviews" },
          { name: "criticReviewsMax", in: "query", schema: { type: "string" }, description: "Maximum number of critic reviews" },
          { name: "userReviewsMin", in: "query", schema: { type: "string" }, description: "Minimum number of user reviews" },
          { name: "userReviewsMax", in: "query", schema: { type: "string" }, description: "Maximum number of user reviews" },
        ],
        responses: {
          "200": {
            description: "Random album or release details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AlbumDetail" } } },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/publication/perfect": {
      get: {
        summary: "Perfect scores given by a publication, by decade",
        operationId: "getPublicationPerfect",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "slug", in: "query", required: true, schema: { type: "string" }, example: "1-pitchfork" },
        ],
        responses: {
          "200": {
            description: "Perfect scores",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    sections: { type: "array", items: { $ref: "#/components/schemas/PerfectSection" } },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/artists": {
      get: {
        summary: "Artists overview (popular now, recently added, ...)",
        operationId: "getArtistsOverview",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Artists overview sections",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sections: { type: "array", items: { $ref: "#/components/schemas/ArtistsOverviewSection" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/faq": {
      get: {
        summary: "Site FAQ",
        operationId: "getFaq",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "section", in: "query", required: false, schema: { type: "string", enum: ["general", "community", "all"], default: "general" }, description: "FAQ category facet (general, community, or all)" },
        ],
        responses: {
          "200": {
            description: "FAQ items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/FaqItem" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/changelog": {
      get: {
        summary: "Site changelog",
        operationId: "getChangelog",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Changelog entries",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    entries: { type: "array", items: { $ref: "#/components/schemas/ChangelogEntry" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/stats": {
      get: {
        summary: "Site statistics, database totals and community contribution leaderboards",
        operationId: "getStats",
        parameters: [{ $ref: "#/components/parameters/CacheControl" }],
        responses: {
          "200": {
            description: "Site statistics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totals: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          value: { type: "string" },
                          key: { type: ["string", "null"] },
                          timestamp: { type: ["string", "null"] },
                        },
                      },
                    },
                    leaderboards: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          key: { type: ["string", "null"] },
                          timestamp: { type: ["string", "null"] },
                          items: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: { type: "string" },
                                value: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/stats/refresh": {
      get: {
        summary: "Live-refresh a site stats module counter",
        description: "Fetch fresh HTML and timestamp for a specific stats key (e.g. stats:total_albums)",
        operationId: "getStatsRefresh",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "key", in: "query", required: true, schema: { type: "string" }, description: "Stats key from /stats", example: "stats:total_albums" },
        ],
        responses: {
          "200": {
            description: "Stats module refresh data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    html: { type: "string" },
                    timestamp: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/guidelines": {
      get: {
        summary: "Community guidelines for reviews or comments",
        operationId: "getGuidelines",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["review", "comment"], default: "review" },
            description: "Guidelines type: review or comment",
          },
        ],
        responses: {
          "200": {
            description: "Community guidelines",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    title: { type: "string" },
                    bestPractices: { type: "array", items: { type: "string" } },
                    whatToAvoid: { type: "array", items: { type: "string" } },
                    footnote: { type: ["string", "null"] },
                    sections: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          text: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/lists/users": {
      get: {
        summary: "Latest user-created lists",
        operationId: "getUserListsIndex",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "User lists index",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    lists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/updates": {
      get: {
        summary: "Latest site updates (new albums, songs, lists)",
        operationId: "getUpdates",
        parameters: [
          { $ref: "#/components/parameters/CacheControl" },
          { name: "filter", in: "query", required: false, schema: { type: "string", enum: ["all"] }, description: "Pass all for the complete feed instead of recent highlights" },
          { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
        ],
        responses: {
          "200": {
            description: "Site updates",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    filter: { type: ["string", "null"] },
                    page: { type: "integer" },
                    updates: { type: "array", items: { $ref: "#/components/schemas/SiteUpdate" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
  },
  components: {
    schemas: {
      AlbumBlock: {
        type: "object",
        properties: {
          url: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string", description: "Empty when AOTY renders the artist name as plain text." },
          artistImage: { type: ["string", "null"], description: "Always null: album blocks carry no artist thumbnails." },
          title: { type: "string" },
          cover: { type: "string" },
          mediaType: { type: "string", description: "lp, ep, single, mixtape, compilation, etc." },
          releaseDate: { type: "string" },
          criticScore: { type: ["string", "null"] },
          criticCount: { type: ["string", "null"] },
          userScore: { type: ["string", "null"] },
          userCount: { type: ["string", "null"] },
          mustHear: { type: "boolean" },
          mustHearScope: { type: ["string", "null"], enum: ["both", "user", "critic", null] },
          locked: { type: "boolean" },
        },
      },
      AlbumRankingInfo: {
        type: "object",
        properties: {
          year: { type: "integer" },
          rank: { type: "integer" },
          total: { type: ["integer", "null"] },
          url: { type: "string" },
        },
      },
      AlbumAllTimeRanking: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          total: { type: ["integer", "null"] },
          url: { type: "string" },
        },
      },
      AlbumDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          id: { type: "string" },
          title: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          cover: { type: "string" },
          datePublished: { type: "string" },
          dateCreated: { type: ["string", "null"] },
          dateModified: { type: ["string", "null"] },
          format: { type: "string" },
          label: { type: ["string", "null"] },
          labelUrl: { type: ["string", "null"] },
          labels: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          genres: { type: "array", items: { type: "string" } },
          genreLinks: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          secondaryGenres: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          vibes: { type: "array", items: { type: "string" } },
          producers: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          writers: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          producersMore: { type: "integer" },
          writersMore: { type: "integer" },
          totalLength: { type: ["string", "null"] },
          mustHear: { type: "boolean" },
          commentCount: { type: ["integer", "null"] },
          criticScore: { type: ["string", "null"] },
          criticScoreExact: { type: ["string", "null"] },
          criticCount: { type: ["string", "null"] },
          criticRanking: { oneOf: [{ $ref: "#/components/schemas/AlbumRankingInfo" }, { type: "null" }] },
          criticRankingAllTime: { oneOf: [{ $ref: "#/components/schemas/AlbumAllTimeRanking" }, { type: "null" }] },
          userScore: { type: ["string", "null"] },
          userScoreExact: { type: ["string", "null"] },
          userCount: { type: ["string", "null"] },
          userRanking: { oneOf: [{ $ref: "#/components/schemas/AlbumRankingInfo" }, { type: "null" }] },
          userRankingAllTime: { oneOf: [{ $ref: "#/components/schemas/AlbumAllTimeRanking" }, { type: "null" }] },
          tracklist: { type: "array", items: { $ref: "#/components/schemas/Track" } },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
          reviews: { type: "array", items: { $ref: "#/components/schemas/CriticReview" } },
          popularUserReviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
          recentUserReviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
          moreAlbums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
          similarAlbums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
          contributionsBy: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          yearEndLists: { type: "array", items: { $ref: "#/components/schemas/CriticListRank" } },
          userLists: { type: "array", items: { $ref: "#/components/schemas/AlbumUserListPreview" } },
          comments: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
          stats: { oneOf: [{ $ref: "#/components/schemas/AlbumStats" }, { type: "null" }] },
          credits: { oneOf: [{ type: "array", items: { $ref: "#/components/schemas/CreditSection" } }, { type: "null" }] },
        },
      },
      AlbumUserListPreview: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          username: { type: "string" },
          userUrl: { type: "string" },
          avatar: { type: ["string", "null"] },
        },
      },
      AlbumStats: {
        type: "object",
        properties: {
          favorites: { type: ["integer", "null"] },
          likes: { type: ["integer", "null"] },
          listens: { type: ["integer", "null"] },
          libraryCount: { type: ["integer", "null"] },
          lists: { type: ["integer", "null"] },
        },
      },
      CreditEntry: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          image: { type: ["string", "null"] },
          roles: { type: "array", items: { type: "string" } },
        },
      },
      CreditSection: {
        type: "object",
        properties: {
          title: { type: "string" },
          credits: { type: "array", items: { $ref: "#/components/schemas/CreditEntry" } },
        },
      },
      Track: {
        type: "object",
        properties: {
          number: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          songId: { type: ["integer", "null"] },
          length: { type: "string" },
          rating: { type: ["string", "null"] },
          ratingCount: { type: ["integer", "null"] },
          notes: { type: ["string", "null"] },
          features: { type: "array", items: { type: "string" } },
          featureLinks: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
        },
      },
      CriticReview: {
        type: "object",
        properties: {
          id: { type: ["integer", "null"] },
          score: { type: "string" },
          publication: { type: "string" },
          publicationUrl: { type: ["string", "null"] },
          author: { type: "string" },
          criticUrl: { type: ["string", "null"] },
          text: { type: "string" },
          image: { type: "string" },
          url: { type: "string" },
          isPrintOnly: { type: "boolean" },
          date: { type: "string" },
        },
      },
      StreamingLink: {
        type: "object",
        properties: {
          platform: { type: "string" },
          url: { type: "string" },
        },
      },
      NewsItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          title: { type: "string" },
          image: { type: ["string", "null"] },
          source: { type: "string" },
          sourceUrl: { type: "string" },
          date: { type: "string" },
          submittedBy: { type: ["string", "null"] },
          submittedByUrl: { type: ["string", "null"] },
          likes: { type: "string" },
          comments: { type: "string" },
        },
      },
      ListIndexSection: {
        type: "object",
        properties: {
          title: { type: "string" },
          lists: { type: "array", items: { $ref: "#/components/schemas/ListEntry" } },
        },
      },
      ListEntry: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          publication: { type: "string" },
          cover: { type: ["string", "null"] },
        },
      },
      ListDetailItem: {
        type: "object",
        properties: {
          rank: { type: ["string", "null"] },
          artist: { type: "string" },
          album: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          cover: { type: "string" },
          date: { type: "string" },
          genres: { type: "array", items: { type: "string" } },
          secondaryGenres: { type: "array", items: { type: "string" } },
          score: { type: ["string", "null"] },
          scoreExact: { type: ["string", "null"] },
          ratingCount: { type: ["string", "null"] },
          mustHear: { type: "boolean" },
          mustHearScope: { type: ["string", "null"], enum: ["both", "user", "critic", null] },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
          blurb: { type: ["string", "null"] },
          otherLists: { type: ["integer", "null"] },
        },
      },
      TopArtistEntry: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          image: { type: ["string", "null"] },
          score: { type: ["string", "null"] },
        },
      },
      DiscussionEntry: {
        type: "object",
        properties: {
          artist: { type: "string" },
          album: { type: "string" },
          albumUrl: { type: "string" },
          cover: { type: ["string", "null"] },
          commentCount: { type: "integer" },
          lastUser: { type: "string" },
          lastUserUrl: { type: "string" },
          lastPostAgo: { type: ["string", "null"] },
          lastPostExact: { type: ["string", "null"] },
        },
      },
      FollowUser: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          username: { type: "string" },
          image: { type: ["string", "null"] },
          subscriber: { type: "boolean" },
        },
      },
      FollowArtist: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          image: { type: ["string", "null"] },
          hasImage: { type: "boolean" },
          followers: { type: ["integer", "null"] },
        },
      },
      SearchArtist: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          image: { type: ["string", "null"] },
        },
      },
      SearchLabel: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
        },
      },
      NamedLink: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
        },
      },
      ArtistLink: {
        type: "object",
        description: "Artist reference with optional image (null where AOTY renders text-only links).",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          image: { type: ["string", "null"] },
        },
      },
      DiscographySection: {
        type: "object",
        properties: {
          title: { type: "string" },
          albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
        },
      },
      ArtistDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          id: { type: ["integer", "null"] },
          canonicalUrl: { type: ["string", "null"] },
          name: { type: "string" },
          image: { type: ["string", "null"] },
          imageFull: { type: ["string", "null"] },
          sameAs: { type: ["string", "null"] },
          notableAlbums: { type: "array", items: { type: "string" } },
          topSongsUrl: { type: ["string", "null"] },
          similarArtistsUrl: { type: ["string", "null"] },
          criticScore: { type: ["string", "null"] },
          criticCount: { type: ["string", "null"] },
          userScore: { type: ["string", "null"] },
          userCount: { type: ["string", "null"] },
          followers: { type: ["string", "null"] },
          genres: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          alsoKnownAs: { type: "array", items: { type: "string" } },
          members: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          formerMembers: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          memberOf: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          formerlyOf: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          relatedArtists: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          tags: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          website: { type: ["string", "null"] },
          sections: { type: "array", items: { $ref: "#/components/schemas/DiscographySection" } },
          topSongs: { type: "array", items: { $ref: "#/components/schemas/TopSong" } },
          similarArtists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
        },
      },
      LabelDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          image: { type: ["string", "null"] },
          website: { type: ["string", "null"] },
          parentLabel: { anyOf: [{ $ref: "#/components/schemas/NamedLink" }, { type: "null" }] },
          description: { type: ["string", "null"] },
          genres: { type: "array", items: { type: "string" } },
          alsoKnownAs: { type: "array", items: { type: "string" } },
          country: { type: ["string", "null"] },
          countryCode: { type: ["string", "null"] },
          page: { type: "integer" },
          totalPages: { type: ["integer", "null"] },
          sort: { type: ["string", "null"] },
          releaseType: { type: "string" },
          albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
        },
      },
      GenreReleasesByYear: {
        type: "object",
        properties: {
          year: { type: "integer" },
          count: { type: "integer" },
          url: { type: "string" },
        },
      },
      PageTab: {
        type: "object",
        properties: {
          label: { type: "string" },
          url: { type: ["string", "null"] },
          selected: { type: "boolean" },
        },
      },
      GenreSection: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: ["string", "null"] },
          albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
          artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
        },
      },
      GenreDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          page: { type: "integer" },
          sections: { type: "array", items: { $ref: "#/components/schemas/GenreSection" } },
          items: { type: "array", items: { $ref: "#/components/schemas/ChartItem" } },
          childGenres: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          releasesByYear: { type: "array", items: { $ref: "#/components/schemas/GenreReleasesByYear" } },
          totalReleases: { type: ["integer", "null"] },
          tabs: { type: "array", items: { $ref: "#/components/schemas/PageTab" } },
        },
      },
      GenreIndexItem: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
        },
      },
      TagResults: {
        type: "object",
        properties: {
          tag: { type: "string" },
          type: { type: "string" },
          year: { type: ["string", "null"] },
          page: { type: "integer" },
          headline: { type: ["string", "null"] },
          usedBy: { type: ["integer", "null"] },
          useCount: { type: ["integer", "null"] },
          tabs: { type: "array", items: { $ref: "#/components/schemas/PageTab" } },
          sort: { type: ["string", "null"] },
          hasNextPage: { type: "boolean" },
          totalPages: { type: ["integer", "null"] },
          popularTags: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          albums: { type: "array", items: { $ref: "#/components/schemas/AlbumBlock" } },
          artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
          media: { type: "array", items: { $ref: "#/components/schemas/NewsItem" } },
        },
      },
      PublicationReview: {
        type: "object",
        properties: {
          album: { type: "string" },
          albumUrl: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          cover: { type: ["string", "null"] },
          score: { type: "string" },
          reviewUrl: { type: "string" },
        },
      },
      PublicationDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          image: { type: ["string", "null"] },
          website: { type: ["string", "null"] },
          albumsRated: { type: ["string", "null"] },
          averageRating: { type: ["string", "null"] },
          ratingDistribution: {
            type: "array",
            items: {
              type: "object",
              properties: {
                range: { type: "string" },
                count: { type: "integer" },
              },
            },
          },
          recentReviews: { type: "array", items: { $ref: "#/components/schemas/PublicationReview" } },
          topAlbums: { type: "array", items: { $ref: "#/components/schemas/PublicationReview" } },
          highest2026: { type: "array", items: { $ref: "#/components/schemas/PublicationReview" } },
          highestAllTime: { type: "array", items: { $ref: "#/components/schemas/PublicationReview" } },
          tabs: { type: "array", items: { $ref: "#/components/schemas/PageTab" } },
        },
      },
      CriticReviewEntry: {
        type: "object",
        properties: {
          album: { type: "string" },
          albumUrl: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          cover: { type: ["string", "null"] },
          score: { type: "string" },
          text: { type: "string" },
          publication: { type: "string" },
          publicationUrl: { type: "string" },
          reviewUrl: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          dateExact: { type: ["string", "null"] },
        },
      },
      CriticDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          publication: { type: ["string", "null"] },
          publicationUrl: { type: ["string", "null"] },
          page: { type: "integer" },
          totalPages: { type: ["integer", "null"] },
          reviews: { type: "array", items: { $ref: "#/components/schemas/CriticReviewEntry" } },
        },
      },
      SongCredit: {
        type: "object",
        properties: {
          role: { type: "string" },
          artists: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
        },
      },
      SongRating: {
        type: "object",
        properties: {
          username: { type: "string" },
          displayName: { type: "string" },
          userUrl: { type: "string" },
          avatar: { type: ["string", "null"] },
          subscriber: { type: "boolean" },
          rating: { type: "string" },
          date: { type: ["string", "null"] },
        },
      },
      ArtistTopSong: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          album: { type: ["string", "null"] },
          cover: { type: ["string", "null"] },
          score: { type: ["string", "null"] },
          ratingCount: { type: ["integer", "null"] },
        },
      },
      SongDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          id: { type: "string" },
          title: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          cover: { type: ["string", "null"] },
          album: { type: ["string", "null"] },
          albumUrl: { type: ["string", "null"] },
          trackNumber: { type: ["string", "null"] },
          year: { type: ["string", "null"] },
          duration: { type: ["string", "null"] },
          userScore: { type: ["string", "null"] },
          userScoreExact: { type: ["string", "null"] },
          ratingCount: { type: ["string", "null"] },
          ratingDistribution: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                count: { type: "integer" },
              },
            },
          },
          likePercentage: { type: ["string", "null"] },
          dislikePercentage: { type: ["string", "null"] },
          tracklist: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "string" },
                title: { type: "string" },
                url: { type: "string" },
                length: { type: "string" },
                score: { type: ["string", "null"] },
                ratingCount: { type: ["integer", "null"] },
              },
            },
          },
          tracklistTotalLength: { type: ["string", "null"] },
          artistTopSongs: { type: "array", items: { $ref: "#/components/schemas/ArtistTopSong" } },
          credits: { type: "array", items: { $ref: "#/components/schemas/SongCredit" } },
          tags: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          topRatings: { type: "array", items: { $ref: "#/components/schemas/SongRating" } },
          comments: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
        },
      },
      HomepageSong: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          artist: { type: "string" },
          cover: { type: ["string", "null"] },
          score: { type: ["string", "null"] },
          ratingCount: { type: ["integer", "null"] },
        },
      },
      TopSong: {
        type: "object",
        properties: {
          rank: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          artists: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          album: { type: ["string", "null"] },
          albumUrl: { type: ["string", "null"] },
          cover: { type: ["string", "null"] },
          score: { type: ["string", "null"] },
          exactScore: { type: ["string", "null"] },
          ratingCount: { type: ["string", "null"] },
        },
      },
      UserProfile: {
        type: "object",
        properties: {
          url: { type: "string" },
          username: { type: "string" },
          displayName: { type: "string" },
          userId: { type: ["string", "null"] },
          memberSince: { type: ["string", "null"] },
          avatar: { type: ["string", "null"] },
          bio: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                url: { type: "string" },
              },
            },
          },
          subscriber: { type: "boolean" },
          ratingDistribution: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                count: { type: "integer" },
              },
            },
          },
          favorites: {
            type: "array",
            items: { $ref: "#/components/schemas/AlbumBlock" } },
          favoriteArtists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
          recentlyRated: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
          bestOfYear: {
            type: ["object", "null"],
            properties: {
              year: { type: ["integer", "null"] },
              ratings: { type: "array", items: { $ref: "#/components/schemas/UserRating" } },
            },
          },
          recentReviews: { type: "array", items: { $ref: "#/components/schemas/UserReview" } },
          recentLists: { type: "array", items: { $ref: "#/components/schemas/UserListEntry" } },
          tagsPreview: { type: "array", items: { type: "string" } },
          followingPreview: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
          pinnedReview: { oneOf: [{ $ref: "#/components/schemas/UserReview" }, { type: "null" }] },
          yearEndLists: { type: "array", items: { type: "integer" } },
          stats: {
            type: "object",
            properties: {
              ratings: { type: "string" },
              listens: { type: "string" },
              reviews: { type: "string" },
              lists: { type: "string" },
              followers: { type: "string" },
              following: { type: "string" },
            },
          },
        },
      },
      UserRating: {
        allOf: [
          { $ref: "#/components/schemas/AlbumBlock" },
          {
            type: "object",
            properties: {
              userRating: { type: ["string", "null"] },
              ratedDate: { type: ["string", "null"] },
              reviewUrl: { type: ["string", "null"] },
              liked: { type: "boolean" },
              albumId: { type: ["integer", "null"] },
            },
          },
        ],
      },
      UserReview: {
        type: "object",
        properties: {
          reviewId: { type: ["integer", "null"] },
          url: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          album: { type: "string" },
          albumUrl: { type: "string" },
          cover: { type: ["string", "null"] },
          username: { type: "string" },
          userUrl: { type: "string" },
          avatar: { type: ["string", "null"] },
          subscriber: { type: "boolean" },
          rating: { type: ["string", "null"] },
          text: { type: "string" },
          isTruncated: { type: "boolean" },
          likes: { type: "string" },
          comments: { type: "string" },
          commentsUrl: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          dateExact: { type: ["string", "null"] },
          edited: { type: "boolean" },
        },
      },
      UserReviewDetail: {
        allOf: [
          { $ref: "#/components/schemas/UserReview" },
          {
            type: "object",
            properties: {
              albumId: { type: ["string", "null"] },
              trackRatings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: ["string", "null"] },
                    title: { type: "string" },
                    url: { type: "string" },
                    rating: { type: ["string", "null"] },
                  },
                },
              },
              commentsList: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
              datePublished: { type: ["string", "null"] },
              dateModified: { type: ["string", "null"] },
              relatedLinks: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
              streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
              previousReview: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      cover: { type: ["string", "null"] },
                    },
                  },
                  { type: "null" },
                ],
              },
              nextReview: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      cover: { type: ["string", "null"] },
                    },
                  },
                  { type: "null" },
                ],
              },
            },
          },
        ],
      },
      AotyComment: {
        type: "object",
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          usernameColor: { type: ["string", "null"] },
          userUrl: { type: "string" },
          avatar: { type: ["string", "null"] },
          subscriber: { type: "boolean" },
          date: { type: "string" },
          dateExact: { type: "string" },
          text: { type: "string" },
          replies: { type: "string" },
        },
      },
      UserListEntry: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          username: { type: "string" },
          userUrl: { type: "string" },
          avatar: { type: ["string", "null"] },
          covers: { type: "array", items: { type: "string" } },
          description: { type: ["string", "null"] },
          likes: { type: ["string", "null"] },
          comments: { type: ["string", "null"] },
          updatedAgo: { type: ["string", "null"] },
          albumCount: { type: ["integer", "null"] },
          ranked: { type: "boolean" },
        },
      },
      UserListDetailItem: {
        type: "object",
        properties: {
          rank: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          title: { type: "string" },
          url: { type: "string" },
          cover: { type: ["string", "null"] },
          year: { type: ["string", "null"] },
          blurb: { type: ["string", "null"] },
          creatorRating: { type: ["string", "null"] },
        },
      },
      UserListDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          username: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          likes: { type: "integer" },
          likers: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
          updatedAgo: { type: ["string", "null"] },
          authorAvatar: { type: ["string", "null"] },
          listId: { type: ["integer", "null"] },
          gridUrl: { type: ["string", "null"] },
          items: { type: "array", items: { $ref: "#/components/schemas/UserListDetailItem" } },
          comments: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
        },
      },
      ChartItem: {
        type: "object",
        properties: {
          rank: { type: "string" },
          title: { type: "string" },
          artist: { type: "string" },
          album: { type: "string" },
          url: { type: "string" },
          cover: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          genres: { type: "array", items: { type: "string" } },
          secondaryGenres: { type: "array", items: { type: "string" } },
          score: { type: ["string", "null"] },
          scoreExact: { type: ["string", "null"] },
          ratingCount: { type: ["string", "null"] },
          mustHear: { type: "boolean" },
          mustHearScope: { type: ["string", "null"], enum: ["both", "user", "critic", null] },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
        },
      },
      TagItem: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
        },
      },
      UserTagEntry: {
        type: "object",
        properties: {
          tag: { type: "string" },
          url: { type: "string" },
          count: { type: "string" },
        },
      },
      NewsSearchItem: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          source: { type: ["string", "null"] },
          image: { type: ["string", "null"] },
        },
      },
      NewsDetail: {
        type: "object",
        properties: {
          url: { type: "string" },
          id: { type: "string" },
          title: { type: "string" },
          source: { type: "string" },
          sourceUrl: { type: "string" },
          date: { type: "string" },
          image: { type: ["string", "null"] },
          text: { type: "string" },
          likes: { type: "string" },
          embedUrl: { type: ["string", "null"] },
          artist: { type: ["object", "null"] },
          album: { type: ["object", "null"] },
          label: { type: ["string", "null"] },
          tags: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          related: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
          comments: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
        },
      },
      SiteUpdate: {
        type: "object",
        properties: {
          kind: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          artist: { type: ["string", "null"] },
          artistUrl: { type: ["string", "null"] },
          image: { type: ["string", "null"] },
          publication: { type: ["string", "null"] },
          publicationLogo: { type: ["string", "null"] },
          excerpt: { type: ["string", "null"] },
          sourceUrl: { type: ["string", "null"] },
          meta: { type: ["string", "null"] },
          timeAgo: { type: ["string", "null"] },
        },
      },
      CriticListRank: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          publication: { type: "string" },
          publicationUrl: { type: ["string", "null"] },
          cover: { type: ["string", "null"] },
          rank: { type: ["string", "null"] },
        },
      },
      PerfectSection: {
        type: "object",
        properties: {
          title: { type: "string" },
          reviews: { type: "array", items: { $ref: "#/components/schemas/PublicationReview" } },
        },
      },
      ArtistsOverviewSection: {
        type: "object",
        properties: {
          title: { type: "string" },
          artists: { type: "array", items: { $ref: "#/components/schemas/SearchArtist" } },
        },
      },
      FaqItem: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          section: { type: ["string", "null"] },
        },
      },
      RandomFiltersMeta: {
        type: "object",
        properties: {
          types: { type: "array", items: { type: "string" } },
          year: {
            type: "object",
            properties: {
              min: { type: "integer" },
              max: { type: "integer" },
            },
          },
          criticScore: {
            type: "object",
            properties: {
              min: { type: "integer" },
              max: { type: "integer" },
            },
          },
          criticReviews: {
            type: "object",
            properties: {
              min: { type: "integer" },
              max: { type: ["integer", "null"] },
            },
          },
          userScore: {
            type: "object",
            properties: {
              min: { type: "integer" },
              max: { type: "integer" },
            },
          },
          userReviews: {
            type: "object",
            properties: {
              min: { type: "integer" },
              max: { type: ["integer", "null"] },
            },
          },
        },
      },
      ChangelogEntry: {
        type: "object",
        properties: {
          date: { type: "string" },
          type: { type: "string" },
          title: { type: "string" },
          text: { type: "string" },
          links: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
        },
      },
      LabelAutocompleteItem: {
        type: "object",
        properties: {
          value: { type: "string" },
          link: { type: "string" },
          description: { type: ["string", "null"] },
        },
      },
      GenreAutocompleteItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          url: { type: "string" },
        },
      },
      SearchAutocompleteItem: {
        type: "object",
        properties: {
          value: { type: "string" },
          label: { type: "string" },
          link: { type: "string" },
          type: { type: "string" },
          image: { type: ["string", "null"] },
        },
      },
      UserGenreItem: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          count: { type: ["integer", "null"] },
          percentage: { type: ["string", "null"] },
          averageScore: { type: ["string", "null"] },
        },
      },
      UserBadgeItem: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: ["string", "null"] },
          image: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
        },
      },
      UserContributionEntry: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          url: { type: ["string", "null"] },
          detail: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
        },
      },
      RssFeedItem: {
        type: "object",
        properties: {
          title: { type: "string" },
          link: { type: "string" },
          pubDate: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
        },
      },
      RssFeed: {
        type: "object",
        properties: {
          title: { type: "string" },
          link: { type: "string" },
          description: { type: ["string", "null"] },
          items: { type: "array", items: { $ref: "#/components/schemas/RssFeedItem" } },
        },
      },
      YearEndAggregateBreakdown: {
        type: "object",
        properties: {
          firstPlace: { type: "integer" },
          secondPlace: { type: "integer" },
          thirdPlace: { type: "integer" },
          top10: { type: "integer" },
          top25: { type: "integer" },
          other: { type: "integer" },
        },
      },
      YearEndAggregateItem: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          album: { type: "string" },
          albumUrl: { type: "string" },
          cover: { type: ["string", "null"] },
          points: { type: "integer" },
          breakdown: { $ref: "#/components/schemas/YearEndAggregateBreakdown" },
          breakdownUrls: { type: "object" },
          criticListsUrl: { type: ["string", "null"] },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
        },
      },
      IndividualSongList: {
        type: "object",
        properties: {
          publication: { type: "string" },
          sourceUrl: { type: ["string", "null"] },
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                artist: { type: "string" },
                title: { type: "string" },
              },
            },
          },
        },
      },
      SongsBestItem: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          artists: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
          title: { type: "string" },
          url: { type: "string" },
          cover: { type: ["string", "null"] },
          points: { type: "integer" },
          listsCount: { type: "integer" },
        },
      },
      UserYearEndAlbum: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          artistImage: { type: ["string", "null"] },
          album: { type: "string" },
          albumUrl: { type: "string" },
          cover: { type: ["string", "null"] },
        },
      },
      UserYearEndResult: {
        type: "object",
        properties: {
          username: { type: "string" },
          displayName: { type: "string" },
          userUrl: { type: "string" },
          avatar: { type: ["string", "null"] },
          year: { type: "integer" },
          albums: { type: "array", items: { $ref: "#/components/schemas/UserYearEndAlbum" } },
          genres: { type: "array", items: { type: "string" } },
          secondaries: { type: "array", items: { type: "string" } },
          descriptors: { type: "array", items: { type: "string" } },
        },
      },
      UserDistributionResult: {
        type: "object",
        properties: {
          username: { type: "string" },
          format: { type: "string" },
          rows: { type: "array", items: { $ref: "#/components/schemas/AlbumDistributionRow" } },
        },
      },
      AlbumUserItem: {
        type: "object",
        properties: {
          username: { type: "string" },
          url: { type: "string" },
          avatar: { type: ["string", "null"] },
        },
      },
      AlbumImageItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          src: { type: "string" },
          isDefault: { type: "boolean" },
        },
      },
      AlbumImagesResult: {
        type: "object",
        properties: {
          albumId: { type: "string" },
          mainImage: { type: ["string", "null"] },
          images: { type: "array", items: { $ref: "#/components/schemas/AlbumImageItem" } },
        },
      },
      UserArtistRatingItem: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          album: { type: "string" },
          albumUrl: { type: "string" },
          cover: { type: ["string", "null"] },
          year: { type: ["string", "null"] },
          score: { type: ["string", "null"] },
          reviewUrl: { type: ["string", "null"] },
        },
      },
      UserArtistRatingsResult: {
        type: "object",
        properties: {
          username: { type: "string" },
          artistId: { type: "string" },
          ratings: { type: "array", items: { $ref: "#/components/schemas/UserArtistRatingItem" } },
        },
      },
      AlbumDistributionRow: {
        type: "object",
        properties: {
          label: { type: "string" },
          count: { type: "integer" },
          percentage: { type: ["number", "null"] },
        },
      },
      UserTrackRatingEntry: {
        type: "object",
        properties: {
          number: { type: "integer" },
          title: { type: "string" },
          url: { type: "string" },
          length: { type: "string" },
          score: { type: ["number", "null"] },
          features: { type: "array", items: { type: "string" } },
          featureLinks: { type: "array", items: { $ref: "#/components/schemas/ArtistLink" } },
        },
      },
      UserAlbumTrackRatingsResult: {
        type: "object",
        properties: {
          username: { type: "string" },
          albumId: { type: "integer" },
          album: { type: "string" },
          artist: { type: "string" },
          cover: { type: ["string", "null"] },
          tracks: { type: "array", items: { $ref: "#/components/schemas/UserTrackRatingEntry" } },
        },
      },
      CorrectionChangeLogEntry: {
        type: "object",
        properties: {
          user: { type: "string" },
          userUrl: { type: "string" },
          role: { type: ["string", "null"] },
          action: { type: "string" },
          date: { type: ["string", "null"] },
        },
      },
      CorrectionItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          status: { type: "string" },
          submittedBy: { type: ["string", "null"] },
          submittedByUrl: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
        },
      },
      EntityCorrectionsResult: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          url: { type: "string" },
          addedOn: { type: ["string", "null"] },
          addedBy: { type: ["string", "null"] },
          addedByUrl: { type: ["string", "null"] },
          sourceUrl: { type: ["string", "null"] },
          locked: { type: "boolean" },
          changeLog: { type: "array", items: { $ref: "#/components/schemas/CorrectionChangeLogEntry" } },
          corrections: { type: "array", items: { $ref: "#/components/schemas/CorrectionItem" } },
        },
      },
      AllCommentsResult: {
        type: "object",
        properties: {
          type: { type: "string" },
          itemId: { type: "integer" },
          albumId: { type: ["integer", "null"] },
          comments: { type: "array", items: { $ref: "#/components/schemas/AotyComment" } },
        },
      },
      GenreNameResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
      RatingSourceItem: {
        type: "object",
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          url: { type: "string" },
        },
      },
      RatingSourcesResult: {
        type: "object",
        properties: {
          year: { type: "string" },
          sources: { type: "array", items: { $ref: "#/components/schemas/RatingSourceItem" } },
        },
      },
      RatingGenreItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          url: { type: "string" },
        },
      },
      RatingGenresResult: {
        type: "object",
        properties: {
          year: { type: "string" },
          type: { type: "string" },
          genres: { type: "array", items: { $ref: "#/components/schemas/RatingGenreItem" } },
        },
      },
      AlbumSummary: {
        type: "object",
        properties: {
          url: { type: "string" },
          id: { type: ["integer", "null"] },
          title: { type: "string" },
          artist: { type: "string" },
          artistUrl: { type: "string" },
          cover: { type: "string" },
          datePublished: { type: "string" },
          format: { type: "string" },
          label: { type: ["string", "null"] },
          labelUrl: { type: ["string", "null"] },
          labels: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          genres: { type: "array", items: { type: "string" } },
          genreLinks: { type: "array", items: { $ref: "#/components/schemas/NamedLink" } },
          secondaryGenres: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          vibes: { type: "array", items: { type: "string" } },
          totalLength: { type: ["string", "null"] },
          trackCount: { type: "integer" },
          mustHear: { type: "boolean" },
          commentCount: { type: ["integer", "null"] },
          criticScore: { type: ["number", "null"] },
          criticScoreExact: { type: ["number", "null"] },
          criticCount: { type: ["integer", "null"] },
          criticRanking: { type: ["object", "null"] },
          criticRankingAllTime: { type: ["object", "null"] },
          userScore: { type: ["number", "null"] },
          userScoreExact: { type: ["number", "null"] },
          userCount: { type: ["integer", "null"] },
          userRanking: { type: ["object", "null"] },
          userRankingAllTime: { type: ["object", "null"] },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
          stats: { type: ["object", "null"] },
        },
      },
      BatchResult: {
        type: "object",
        properties: {
          count: { type: "integer" },
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                status: { type: "integer" },
                data: { description: "Result payload when status is 200, otherwise null." },
                error: { type: ["string", "null"] },
              },
            },
          },
        },
      },
      StatusResult: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          openapi: { type: "string" },
          endpoints: { type: "integer" },
          timestamp: { type: "string" },
        },
      },
      SongCriticListsResult: {
        type: "object",
        properties: {
          slug: { type: "string" },
          lists: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rank: { type: ["integer", "null"] },
                publication: { type: "string" },
                url: { type: "string" },
              },
            },
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
    parameters: {
      CacheControl: {
        name: "cache",
        in: "query",
        required: false,
        schema: { type: "boolean", default: true },
        description: "Whether to serve from KV cache. Defaults to `true`. Pass `cache=false` to bypass the cache and fetch fresh data. The fresh result is then saved back to the cache.",
      },
    },
    responses: {
      BadRequest: {
        description: "Missing or invalid parameters",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Album not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      ServerError: {
        description: "Upstream fetch or parse error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
} as const;
