// 要点透视：把已收录文章的正文拆成分组要点，每条要点内标记要高亮的片段（仿语鲸的要点透视）。
// 与 analyses 分开：analyses 回答"值不值得收录"，这里回答"读这篇要记住什么"。
//
// 按需生成：读者首次打开文章时触发。用 article_highlights 的行做抢占（status='pending'），
// 并发请求只有一条真正调模型——生成要花钱，不能让 N 个请求各付一次。
import { z } from "zod";
import { sql, type Tx } from "../db.ts";
import { chatJson } from "../providers/llm.ts";
import { modelFor } from "../editorial/models.ts";
import { promptText, promptVersion } from "../editorial/prompts.ts";
import { sha256 } from "../lib/ids.ts";

/** 前端按这个顺序渲染分组；不在表里的组名会被丢弃，所以这里也限制了可选值。 */
export const HIGHLIGHT_GROUP_KEYS = ["highlights", "details", "data", "timeline", "background", "caveats"] as const;
export type HighlightGroupKey = (typeof HIGHLIGHT_GROUP_KEYS)[number];

/**
 * 分组名。外层区块已经叫「要点透视」，所以第一组不叫这个名字——否则标题套标题。
 * highlights 组排在最前，其余按"读者往下读的顺序"排。
 */
const GROUP_NAME: Record<HighlightGroupKey, string> = {
  highlights: "核心亮点",
  details: "来点细节",
  data: "关键数据",
  timeline: "关键时间",
  background: "背景补充",
  caveats: "注意事项",
};

/** 同一套几何符号，只有实心/空心之别，避免混用不同符号体系。 */
const GROUP_ICON: Record<HighlightGroupKey, string> = {
  highlights: "◆",
  details: "◇",
  data: "◆",
  timeline: "◆",
  background: "◆",
  caveats: "◇",
};

const Point = z.object({
  text: z.string().min(1).max(400),
  marks: z.array(z.string().min(1).max(60)).max(6).default([]),
});

const Group = z.object({
  key: z.enum(HIGHLIGHT_GROUP_KEYS),
  points: z.array(Point).min(1).max(8),
});

const Shape = z.object({ groups: z.array(Group).min(1).max(HIGHLIGHT_GROUP_KEYS.length) });

export interface HighlightGroup {
  key: HighlightGroupKey;
  name: string;
  icon: string;
  points: Array<{ text: string; marks: string[] }>;
}

export type HighlightState =
  /** 已就绪，直接渲染。 */
  | { kind: "ready"; groups: HighlightGroup[] }
  /** 正在生成（可能已被别的读者触发），前端显示加载态并轮询。 */
  | { kind: "pending" }
  /** 这篇拆不出要点（没有正文、或正文太短），前端什么都不显示。 */
  | { kind: "absent" }
  /** 上次生成失败，可以再触发一次。 */
  | { kind: "failed" };

/**
 * 丢掉在 text 里查不到的 mark：前端按子串定位高亮，模型偶尔会写错字或跨标点，
 * 留下就会变成"声明了却不生效"的静默错误，不如直接丢。
 */
function keepMarks(text: string, marks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of marks) {
    const mark = raw.trim();
    if (!mark || seen.has(mark)) continue;
    if (!text.includes(mark)) continue;
    seen.add(mark);
    out.push(mark);
    if (out.length >= 4) break;
  }
  return out;
}

function normalize(groups: Array<{ key: HighlightGroupKey; points: Array<{ text: string; marks: string[] }> }>): HighlightGroup[] {
  const byKey = new Map<HighlightGroupKey, Array<{ text: string; marks: string[] }>>();
  for (const group of groups) {
    const bucket = byKey.get(group.key) ?? [];
    for (const point of group.points) {
      const text = point.text.trim();
      if (!text) continue;
      // 同一组内去重（模型偶尔会重复同一条）。
      if (bucket.some((b) => b.text === text)) continue;
      bucket.push({ text, marks: keepMarks(text, point.marks) });
    }
    byKey.set(group.key, bucket);
  }
  return HIGHLIGHT_GROUP_KEYS.flatMap((key) => {
    const points = byKey.get(key) ?? [];
    return points.length ? [{ key, name: GROUP_NAME[key], icon: GROUP_ICON[key], points }] : [];
  });
}

/** 指纹：标题+正文。正文改了旧结果即失效（与 analyses.input_revision 同思路）。 */
function fingerprint(title: string, body: string): string {
  return sha256(`${title}\n${body}`);
}

/** 太短的素材拆不出要点（只有 RSS 摘要的那种），不浪费一次付费调用。 */
const MIN_BODY_CHARS = 200;

interface Source {
  title: string;
  body: string;
}

async function readableArticle(articleId: string): Promise<Source | null> {
  const [a] = await sql<{ title: string; body: string | null }[]>`
    SELECT title, coalesce(body_text, excerpt, '') AS body FROM articles WHERE id = ${articleId}`;
  if (!a) return null;
  const body = (a.body ?? "").trim();
  return body.length < MIN_BODY_CHARS ? null : { title: a.title, body };
}

/** 当前状态。指纹对不上视为没有结果：旧内容不该继续显示。 */
export async function highlightState(articleId: string): Promise<HighlightState> {
  const source = await readableArticle(articleId);
  if (!source) return { kind: "absent" };
  const hash = fingerprint(source.title, source.body);
  const [row] = await sql<{ input_hash: string; status: string; groups: unknown }[]>`
    SELECT input_hash, status, groups FROM article_highlights WHERE article_id = ${articleId}`;
  if (!row || row.input_hash !== hash) return { kind: "absent" };
  if (row.status === "ready") return { kind: "ready", groups: (row.groups ?? []) as HighlightGroup[] };
  if (row.status === "failed") return { kind: "failed" };
  return { kind: "pending" };
}

/**
 * 抢占式生成：把行抢成 pending 的那个调用者才真正跑模型，其余立刻返回 pending。
 * 失败写 failed（下次读者打开可重试），成功写 ready。
 */
export async function ensureHighlights(articleId: string): Promise<HighlightState> {
  const source = await readableArticle(articleId);
  if (!source) return { kind: "absent" };
  const hash = fingerprint(source.title, source.body);

  const current = await highlightState(articleId);
  if (current.kind === "ready" || current.kind === "pending") return current;

  // 抢占：并发下只有一条 INSERT 拿到 RETURNING，其余看到自己没抢到就返回真实状态。
  const claimed = await sql.begin(async (tx: Tx) => {
    const rows = await tx<{ article_id: string }[]>`
      INSERT INTO article_highlights (article_id, input_hash, status)
      VALUES (${articleId}, ${hash}, 'pending')
      ON CONFLICT (article_id) DO UPDATE
        SET input_hash = EXCLUDED.input_hash, status = 'pending', groups = NULL, updated_at = now()
        WHERE article_highlights.status IS DISTINCT FROM 'pending'
      RETURNING article_id`;
    return rows.length > 0;
  });
  if (!claimed) return highlightState(articleId);

  try {
    const user = ["标题：", source.title, "", "正文：", source.body.slice(0, 24_000)].join("\n");
    const result = await chatJson({
      model: await modelFor("highlights"),
      system: "",
      user: `${promptText("highlights")}\n\n${user}`,
      purpose: "highlights",
      subject: `article:${articleId}`,
      promptVersion: promptVersion("highlights"),
      schema: Shape,
      maxTokens: 6000,
    });
    const groups = normalize(result.data.groups);
    // groups 为空也标 ready（空数组）：前端据此隐藏区块，且不会反复重试同一篇。
    await sql`
      UPDATE article_highlights
      SET status = 'ready', groups = ${sql.json(groups as unknown as Record<string, unknown>)},
          model = ${result.model}, receipt_id = ${result.receiptId ?? null}, updated_at = now()
      WHERE article_id = ${articleId} AND status = 'pending'`;
    return { kind: "ready", groups };
  } catch (error) {
    await sql`UPDATE article_highlights SET status = 'failed', updated_at = now()
              WHERE article_id = ${articleId} AND status = 'pending'`;
    throw error;
  }
}