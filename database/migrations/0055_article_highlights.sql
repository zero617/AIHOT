-- 要点透视：把文章正文拆成分组要点，每条要点内高亮关键信息（仿语鲸）。
-- 与 analyses 分开：analyses 是"这篇值不值得收录"的判断，这里是"读这篇要记住什么"的阅读辅助，
-- 两者 prompt、token 预算、失败语义都不同，混在一张表会让重跑逻辑互相干扰。
CREATE TABLE IF NOT EXISTS article_highlights (
  article_id     text PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  -- 输入指纹：正文或标题变化后旧结果失效（与analyses.input_revision 同思路）。
  input_hash     text NOT NULL,
  groups         jsonb,
  -- pending = 已有人（或已有人预约）在生成；ready = groups 可用。生成失败回落到 failed，可重试。
  status         text NOT NULL DEFAULT 'pending',
  model          text,
  receipt_id     bigint,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT article_highlights_status_check CHECK (status IN ('pending', 'ready', 'failed'))
);

COMMENT ON TABLE article_highlights IS '要点透视：按分组整理的要点与高亮片段，供item 页阅读辅助';
COMMENT ON COLUMN article_highlights.groups IS '[{key,name,icon,points:[{text,marks:[string]}]}]，仅 status=ready 时非空';
COMMENT ON COLUMN article_highlights.status IS 'pending 生成中（插入即抢占，避免并发重复付费调用）/ ready 可用 / failed 失败可重试';