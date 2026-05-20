import { BASE, REQ_HEADERS, decodeEntities } from "../constants.js";
import type { AlbumStats, CreditEntry, CreditSection } from "../types.js";

const EXTRAS_HEADERS: HeadersInit = {
  ...REQ_HEADERS,
  "Content-Type": "application/x-www-form-urlencoded",
  "X-Requested-With": "XMLHttpRequest",
};

export async function scrapeAlbumStats(albumId: string): Promise<AlbumStats | null> {
  try {
    const res = await fetch(`${BASE}/scripts/moreStatsAlbum.php`, {
      method: "POST",
      headers: EXTRAS_HEADERS,
      body: `albumID=${albumId}`,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const nums = [...text.matchAll(/[\d,]+/g)]
      .map((m) => parseInt(m[0].replace(/,/g, ""), 10))
      .filter((n) => !isNaN(n));
    if (nums.length < 5) return null;
    return {
      favorites: nums[0] ?? null,
      likes: nums[1] ?? null,
      listens: nums[2] ?? null,
      libraryCount: nums[3] ?? null,
      lists: nums[4] ?? null,
    };
  } catch {
    return null;
  }
}

export async function scrapeAlbumCredits(albumId: string): Promise<CreditSection[] | null> {
  try {
    const res = await fetch(`${BASE}/scripts/showAlbumCredits.php`, {
      method: "POST",
      headers: EXTRAS_HEADERS,
      body: `albumID=${albumId}`,
    });
    if (!res.ok) return null;

    const sections: CreditSection[] = [];
    const c = {
      section: null as CreditSection | null,
      credit: null as CreditEntry | null,
      // HTMLRewriter has no element-end hook, so track which credit a role buffer belongs
      // to separately: flush to roleTarget when the *next* <a> element starts.
      roleBuf: "",
      roleTarget: null as CreditEntry | null,
    };

    function flushRole() {
      const r = c.roleBuf.trim();
      if (r && c.roleTarget) c.roleTarget.roles.push(r);
      c.roleBuf = "";
    }

    await new HTMLRewriter()
      .on(".sectionTitle", {
        element() {
          c.section = { title: "", credits: [] };
          sections.push(c.section);
        },
        text(t) { if (c.section) c.section.title += t.text; },
      })
      .on(".credit", {
        element() {
          c.credit = { name: "", url: "", image: null, roles: [] };
          if (c.section) c.section.credits.push(c.credit);
        },
      })
      .on(".credit .photo img", {
        element(el) { if (c.credit) c.credit.image = el.getAttribute("src") ?? null; },
      })
      .on(".credit .name a[href*='/artist/']", {
        element(el) {
          if (c.credit && !c.credit.url) {
            const href = el.getAttribute("href");
            if (href) c.credit.url = BASE + href;
          }
        },
        text(t) { if (c.credit) c.credit.name += t.text; },
      })
      .on(".credit .songs a", {
        element() {
          // flush the previous role (belongs to roleTarget, not necessarily c.credit)
          flushRole();
          c.roleTarget = c.credit;
        },
        text(t) { c.roleBuf += t.text; },
      })
      .transform(res)
      .arrayBuffer();

    flushRole(); // flush the last accumulated role

    for (const section of sections) {
      section.title = decodeEntities(section.title.trim());
      for (const credit of section.credits) {
        credit.name = decodeEntities(credit.name.trim());
      }
    }

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}
