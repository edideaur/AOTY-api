import { openApiSpec } from "./openapi.js";

type PostmanItem = {
  name: string;
  request: {
    method: string;
    url: { raw: string; host: string[]; path: string[]; query?: { key: string; value: string; description?: string; disabled?: boolean }[] };
    description?: string;
  };
};

function buildItems(): PostmanItem[] {
  const items: PostmanItem[] = [];
  const base = "{{baseUrl}}";

  for (const [pattern, methods] of Object.entries(openApiSpec.paths)) {
    const op = (methods as Record<string, unknown>).get as Record<string, unknown> | undefined;
    if (!op) continue;

    const isPathParam = pattern.includes("{");
    const pathSegments = pattern.replace(/^\//,"").split("/");

    const query = ((op.parameters ?? []) as Array<Record<string, unknown>>)
      .filter((p) => p.in === "query" && p.name !== "cache")
      .map((p) => ({
        key: p.name as string,
        value: String((p as Record<string, Record<string, unknown>>).example ?? ""),
        description: (p.description as string | undefined) ?? "",
        disabled: !(p.required as boolean | undefined),
      }));

    const pathForUrl = isPathParam
      ? pattern.replace("{", ":").replace("}", "")
      : pattern;

    items.push({
      name: (op.summary as string | undefined) ?? pattern,
      request: {
        method: "GET",
        url: {
          raw: `${base}${pathForUrl}`,
          host: [base],
          path: pathForUrl.replace(/^\//,"").split("/"),
          query: query.length ? query : undefined,
        },
        description: (op.description as string | undefined) ?? "",
      },
    });
  }

  return items;
}

export const POSTMAN_BODY = JSON.stringify({
  info: {
    name: "AOTY API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description: openApiSpec.info.description,
  },
  variable: [{ key: "baseUrl", value: "/", type: "string" }],
  item: buildItems(),
});
