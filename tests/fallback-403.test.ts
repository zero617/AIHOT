// 403 的配额/准入类拒绝（FreeTierError、quota、usage limit）必须让 fallback 链接管：
// 同一个请求换个模型就能成，跟「内容违规」那种硬拒绝不同。
import { stub, tag, Reply } from "./setup.ts";
import { analysisStep, SELECTING_SCORE, type AnalysisStep } from "./analysis-steps.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { analyzeArticle } from "@aihot/backend/editorial/analyze";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { MODELS } from "@aihot/backend/providers/llm";
import { CAPABILITIES, type Capability } from "@aihot/backend/editorial/models";

// 每步都不指定模型 → 全部落到 default（主模型），403 由 fallback 链兜底。
for (const c of Object.values(CAPABILITIES) as Capability[]) {
  if (c.default === "default") delete process.env[c.env];
  else process.env[c.env] = "default";
}

const T = tag();
const SOURCE = `test-fallback-403-${T}`;
const seen: Array<{ model: string; step: AnalysisStep }> = [];

// 主模型（default）对每一步都回 403 FreeTierError；fallback 预设（hy4-preview）正常应答。
const provider = await stub((hit, req) => {
  const step = analysisStep(req.body);
  const model = (JSON.parse(req.body) as { model: string }).model;
  seen.push({ model, step });
  if (model === MODELS.default.model) {
    return new Reply(403, { error: { message: '[403]: {"type":"error","error":{"type":"FreeTierError","message":"OpenCode\'s free tier can only be used from within OpenCode."}}' } });
  }
  const content =
    step === "prefilter" ? { label: "PASS", reason: "测试" }
    : step === "score" ? { attentionScore: SELECTING_SCORE }
    : step === "understand" ? { itemType: "product_launch", authorRole: "principal", tags: ["产品更新"], editorialJudgment: "理由", titleZh: "兜底模型的标题", summaryZh: "兜底模型写的摘要。第二句。" }
    : step === "structure" ? { category: "ai-products", tags: ["产品更新"], subjects: [], fact: null }
    : "title_zh: 标题\nsummary_zh: 摘要。";
  return { id: `stub-${seen.length}`, choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
});

Object.assign(process.env, {
  LLM_BASE_URL: `${provider.url}/v1`,
  LLM_API_KEY: "test-key",
  LLM_MODEL: "default",
  MODEL_CALLS_ENABLED: "true",
  // fallback 指向同一个 stub 端点下的另一个预设模型（hy4-preview 复用 HY4_*，这里把它的
  // base/key 指到 stub，保证请求仍落在同一个 provider 上）。
  LLM_FALLBACK_MODEL: "hy4-preview",
  HY4_BASE_URL: `${provider.url}/v1`,
  HY4_API_KEY: "test-key",
});

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at) VALUES (${SOURCE}, 'Test fallback 403', 'rss', 'T1', 'editorial', '2100-01-01')`;
});
after(async () => {
  await provider.close();
  await stopBoss();
  await closeDb();
});

test("a 403 entitlement refusal hands the request to the fallback chain", async () => {
  const { articleId } = await upsertMaterial({
    sourceId: SOURCE, url: `https://example.com/${T}`, title: `A product launch ${T}`, bodyText: `A company launched a product with pricing and availability. ${T} `.repeat(6),
    bodyStatus: "ok", via: "fetch", publishedAt: new Date(),
  } as never);
  const res = await analyzeArticle(articleId);
  assert.ok(res, "analysis returned");
  assert.equal(res!.output!.selected, true);
  assert.equal(res!.output!.titleZh, "兜底模型的标题");
  // 每一步都先撞 403、再被 fallback 接住：两种模型都出现过。
  assert.ok(seen.some((r) => r.model === MODELS.default.model), "the primary was tried");
  assert.ok(seen.every((r) => r.model !== MODELS.default.model || r.step !== undefined));
  const fallbackModel = MODELS["hy4-preview"].model;
  assert.ok(seen.some((r) => r.model === fallbackModel), "the fallback preset answered");
  // 分析落库成功，不是 failed。
  const [a] = await sql`SELECT processing_state FROM articles WHERE id = ${articleId}`;
  assert.equal(a.processing_state, "analyzed");
});
