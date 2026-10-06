-- 要点透视改为按需生成后需要三样东西：pending/ready/failed 的状态、
-- 可空的 groups（生成中还没有内容）、以及 updated_at。
-- 0055 在某些库上可能已经是最终结构（带 status），所以这里全部写成幂等的：
-- ADD COLUMN IF NOT EXISTS / DROP NOT NULL 可重复执行，约束用 DO 块先查后加。
ALTER TABLE article_highlights
  ALTER COLUMN groups DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- groups 非空的行一定是已经生成成功的（pending 状态下 groups 为空）。
UPDATE article_highlights SET status = 'ready' WHERE status = 'pending' AND groups IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_highlights_status_check') THEN
    ALTER TABLE article_highlights
      ADD CONSTRAINT article_highlights_status_check CHECK (status IN ('pending', 'ready', 'failed'));
  END IF;
END $$;

COMMENT ON COLUMN article_highlights.status IS 'pending 生成中（插入即抢占，避免并发重复付费调用）/ ready 可用 / failed 失败可重试';