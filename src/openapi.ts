export const openApiSpec = {
  openapi: "3.0.3",
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
          "Return full album details including scores, tracklist, reviews, streaming links, stats, and credits. Provide either slug (direct lookup) or both artist and name (search-based lookup). Pass minimal=true to skip the PHP-based stats and credits calls.",
        operationId: "getAlbum",
        parameters: [
          {
            name: "slug",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "AOTY album slug for direct lookup (e.g. 12345-artist-album-name). Use this or artist+name.",
            example: "35936-outkast-aquemini",
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
            description: "When true, skips moreStatsAlbum.php and showAlbumCredits.php calls. stats and credits will be null.",
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
    "/releases": {
      get: {
        summary: "New album releases",
        operationId: "getReleases",
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1, minimum: 1 },
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
    "/lists": {
      get: {
        summary: "Year-end critic lists index",
        operationId: "getLists",
        parameters: [
          {
            name: "year",
            in: "query",
            schema: { type: "integer" },
            example: 2025,
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
                    lists: { type: "array", items: { $ref: "#/components/schemas/ListEntry" } },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/list/{slug}": {
      get: {
        summary: "Get a specific critic list",
        operationId: "getList",
        parameters: [
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
          { name: "q", in: "query", required: true, schema: { type: "string" } },
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
          { name: "q", in: "query", required: true, schema: { type: "string" } },
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
          { name: "q", in: "query", required: true, schema: { type: "string" } },
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
  },
  components: {
    schemas: {
      AlbumBlock: {
        type: "object",
        properties: {
          url: { type: "string" },
          artist: { type: "string" },
          title: { type: "string" },
          cover: { type: "string" },
          mediaType: { type: "string", description: "lp, ep, single, mixtape, compilation, etc." },
          releaseDate: { type: "string" },
          criticScore: { type: "string", nullable: true },
          criticCount: { type: "string", nullable: true },
          userScore: { type: "string", nullable: true },
          userCount: { type: "string", nullable: true },
          mustHear: { type: "boolean" },
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
          cover: { type: "string" },
          datePublished: { type: "string" },
          format: { type: "string" },
          label: { type: "string", nullable: true },
          labelUrl: { type: "string", nullable: true },
          genres: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          criticScore: { type: "string", nullable: true },
          criticScoreExact: { type: "string", nullable: true },
          criticCount: { type: "string", nullable: true },
          userScore: { type: "string", nullable: true },
          userScoreExact: { type: "string", nullable: true },
          userCount: { type: "string", nullable: true },
          tracklist: { type: "array", items: { $ref: "#/components/schemas/Track" } },
          streamingLinks: { type: "array", items: { $ref: "#/components/schemas/StreamingLink" } },
          reviews: { type: "array", items: { $ref: "#/components/schemas/CriticReview" } },
          stats: { $ref: "#/components/schemas/AlbumStats", nullable: true },
          credits: { type: "array", items: { $ref: "#/components/schemas/CreditSection" }, nullable: true },
        },
      },
      AlbumStats: {
        type: "object",
        properties: {
          favorites: { type: "integer", nullable: true },
          likes: { type: "integer", nullable: true },
          listens: { type: "integer", nullable: true },
          libraryCount: { type: "integer", nullable: true },
          lists: { type: "integer", nullable: true },
        },
      },
      CreditEntry: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          image: { type: "string", nullable: true },
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
          length: { type: "string" },
          rating: { type: "string", nullable: true },
          ratingCount: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
          features: { type: "array", items: { type: "string" } },
        },
      },
      CriticReview: {
        type: "object",
        properties: {
          score: { type: "string" },
          publication: { type: "string" },
          author: { type: "string" },
          text: { type: "string" },
          image: { type: "string" },
          url: { type: "string" },
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
          image: { type: "string", nullable: true },
          source: { type: "string" },
          sourceUrl: { type: "string" },
          date: { type: "string" },
          likes: { type: "string" },
          comments: { type: "string" },
        },
      },
      ListEntry: {
        type: "object",
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          publication: { type: "string" },
          cover: { type: "string", nullable: true },
        },
      },
      ListDetailItem: {
        type: "object",
        properties: {
          rank: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          cover: { type: "string" },
          date: { type: "string" },
          genres: { type: "array", items: { type: "string" } },
        },
      },
      SearchArtist: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          image: { type: "string", nullable: true },
        },
      },
      SearchLabel: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
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
