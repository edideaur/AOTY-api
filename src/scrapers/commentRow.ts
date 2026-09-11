import { BASE, cleanImageUrl, decodeEntities, parseCount, parseId, parseDateToTimestamp } from "../constants.js";
import type { AotyComment } from "../types.js";

type RawComment = {
  id: string;
  username: string;
  usernameColor: string | null;
  userUrl: string;
  avatar: string | null;
  subscriber: boolean;
  date: string;
  dateExact: string;
  text: string;
  replies: string;
};

export async function scrapeCommentRows(res: Response): Promise<AotyComment[]> {
  const comments: RawComment[] = [];
  const st: { cur: RawComment | null; textBuf: string } = { cur: null, textBuf: "" };
  await new HTMLRewriter()
    .on(".commentRow", {
      element(el) {
        if (st.cur) st.cur.text = st.textBuf.trim();
        // IDs vary by context: comment_123 (albums), comment123 (news), reply123 (threads).
        const rawId = el.getAttribute("id") ?? "";
        const idM = rawId.match(/(?:comment_|comment|reply)(\d+)/) ?? rawId.match(/(\d+)\s*$/);
        st.cur = { id: idM?.[1] ?? "", username: "", usernameColor: null, userUrl: "", avatar: null, subscriber: false, date: "", dateExact: "", text: "", replies: "" };
        comments.push(st.cur);
        st.textBuf = "";
      },
    })
    .on(".commentRow .commentImage a", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (st.cur && !st.cur.userUrl && href.includes("/user/")) st.cur.userUrl = href.startsWith("http") ? href : BASE + href;
      },
    })
    .on(".commentRow .commentImage img", {
      element(el) {
        if (st.cur) st.cur.avatar = cleanImageUrl(el.getAttribute("src") ?? null);
      },
    })
    .on(".commentRow .commentUserName a", {
      element(el) {
        if (st.cur && !st.cur.usernameColor) {
          const style = el.getAttribute("style") ?? "";
          const colorM = style.match(/color\s*:\s*([^;]+)/i);
          if (colorM?.[1]) st.cur.usernameColor = colorM[1].trim();
        }
      },
      text(t) {
        if (st.cur) st.cur.username = (st.cur.username ?? "") + t.text;
      },
    })
    .on(".commentRow .commentUserName .donor, .commentRow .donor", {
      element() {
        if (st.cur) st.cur.subscriber = true;
      },
    })
    .on(".commentRow .commentDate", {
      element(el) {
        if (st.cur) st.cur.dateExact = el.getAttribute("title") ?? "";
      },
      text(t) {
        if (st.cur) st.cur.date = (st.cur.date ?? "") + t.text;
      },
    })
    .on(".commentRow .commentText", {
      text(t) {
        st.textBuf += t.text;
      },
    })
    .on(".commentRow .showReplies span", {
      text(t) {
        if (st.cur) st.cur.replies = (st.cur.replies ?? "") + t.text;
      },
    })
    .transform(res)
    .arrayBuffer();
  if (st.cur) st.cur.text = st.textBuf.trim();
  return comments.map((c) => {
    const cDate = (c.date ?? "").trim();
    const cDateExact = c.dateExact ?? "";
    return {
      id: parseId(c.id) ?? 0,
      username: decodeEntities((c.username ?? "").trim()),
      usernameColor: c.usernameColor ?? null,
      userUrl: c.userUrl ?? "",
      avatar: cleanImageUrl(c.avatar ?? null),
      subscriber: c.subscriber ?? false,
      date: cDate,
      dateTimestamp: parseDateToTimestamp(cDate),
      dateExact: cDateExact,
      dateExactTimestamp: parseDateToTimestamp(cDateExact),
      text: decodeEntities((c.text ?? "").trim()),
      replies: parseCount((c.replies ?? "").trim()) ?? 0,
    };
  });
}
