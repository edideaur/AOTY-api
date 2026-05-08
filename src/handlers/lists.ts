import { json, extractMeta, extractOgMeta, fetchAoty } from "../utils";
import type { ListItem, ListsMetadata, JSONResponse } from "../types";

const parseListsMetadata = (html: string): ListsMetadata => {
  const titleMatch = html.match(/<h1[^>]*class="headline"[^>]*>([^<]+)<\/h1>/);
  const description = extractMeta(html, "description");
  const image = extractOgMeta(html, "og:image") || "http://cdn.albumoftheyear.org/images/logo-2015.png";

  const yearMatch = html.match(/<h1[^>]*class="headline"[^>]*>(\d{4}) Music Year End Lists<\/h1>/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  return {
    title: titleMatch ? titleMatch[1].trim() : "Year End Lists",
    description,
    siteName: "Album of The Year",
    image,
    year,
  };
};

export const handleLists = async (year?: string): Promise<JSONResponse> => {
  try {
    const path = year 
      ? `/lists.php?y=${year}`
      : "/lists.php";

    const res = await fetchAoty(path);
    const html = new TextDecoder().decode(await res.arrayBuffer());
    const metadata = parseListsMetadata(html);

    const listColumnRegex = /<div class="listColumn">([\s\S]*?)<\/div><\/div>/g;
    const lists: ListItem[] = [];
    let match;

    while ((match = listColumnRegex.exec(html)) !== null) {
      const columnHtml = match[1];
      const linkMatch = columnHtml.match(/<div class="listText"><a href="(\/list\/[^"]+)"[^>]*>([^<]+)<\/a>/);
      const imgMatch = columnHtml.match(/<div class="listLogo"><img[^>]*src="[^"]+\/([^."]+)\.[^"]+"/);
      const iconMatch = columnHtml.match(/<div class="listIcon"><i class="[^"]*"><\/i><\/div>/);

      if (linkMatch) {
        const slug = linkMatch[1].replace(/^\/list\//, "").replace(/\/$/, "");
        const name = linkMatch[2].trim();
        let image = "";
        if (imgMatch) image = imgMatch[1];
        else if (iconMatch) image = "icon";

        lists.push({ name, slug, image });
      }
    }

    return json({ metadata, lists });
  } catch {
    return json({ error: "Failed to fetch lists" }, 500);
  }
};