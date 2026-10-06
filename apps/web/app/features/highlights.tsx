// 要点透视：按分组列出要点，组内高亮关键片段。
// 按需生成：首次打开时触发生成并显示加载态，完成后替换为要点；已生成过的直接命中缓存。
import { useEffect, useRef, useState } from "react";

export interface HighlightPoint {
  text: string;
  marks: string[];
}

export interface HighlightGroup {
  key: string;
  name: string;
  icon: string;
  points: HighlightPoint[];
}

type State =
  | { kind: "loading" | "pending" }
  | { kind: "ready"; groups: HighlightGroup[] }
  | { kind: "hidden" };

/**
 * 在 text 里把 marks 逐字包上高亮。marks 已在后端校验过必须出现在 text 中，
 * 但这里仍做一次防御：文本被本地化或改版后找不到就直接当普通文字，不显示半个标记。
 */
function withMarks(text: string, marks: string[]): React.ReactNode {
  const usable = marks.filter((m) => m && text.includes(m)).sort((a, b) => b.length - a.length);
  if (!usable.length) return text;

  const parts: React.ReactNode[] = [];
  let rest = text;
  let guard = 0;
  while (rest && guard++ < 40) {
    // 找最靠前的标记，重叠时取更长的那个。
    let hit: { mark: string; at: number } | null = null;
    for (const mark of usable) {
      const at = rest.indexOf(mark);
      if (at === -1) continue;
      if (!hit || at < hit.at || (at === hit.at && mark.length > hit.mark.length)) hit = { mark, at };
    }
    if (!hit) break;
    if (hit.at > 0) parts.push(rest.slice(0, hit.at));
    parts.push(
      <mark key={`${hit.at}-${guard}`} className="rounded-[3px] bg-accent/12 px-0.5 font-medium text-ink">
        {hit.mark}
      </mark>,
    );
    rest = rest.slice(hit.at + hit.mark.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

/** 骨架屏的分组形状，跟真实分组同序，避免内容到位时布局跳动。 */
const SKELETON = [
  { name: "核心亮点", rows: 4 },
  { name: "来点细节", rows: 4 },
  { name: "关键数据", rows: 3 },
];

/**
 * 轮询上限：3 秒一次，最多两分钟。生成通常十几秒就够，两分钟还不出来就当失败，
 * 不让读者对着骨架屏无限等下去。
 */
const MAX_POLLS = 40;

export function ArticleHighlights({ articleId }: { articleId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  // 触发只做一次：轮询途中离开页面再回来时不重复触发（后端有抢占，但少一次请求是一次）。
  const triggered = useRef(false);

  useEffect(() => {
    let alive = true;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const path = `/api/site/items/${encodeURIComponent(articleId)}/highlights`;

    /** 返回 true 表示已到终态，不用再轮询。 */
    const apply = (data: unknown): boolean => {
      if (!alive) return true;
      const s = data as { kind?: string; groups?: HighlightGroup[] } | null;
      if (s?.kind === "ready") {
        setState(s.groups?.length ? { kind: "ready", groups: s.groups } : { kind: "hidden" });
        return true;
      }
      if (s?.kind === "failed") {
        // 生成失败不自动重试：下次读者打开时后端会再放行一次。
        setState({ kind: "hidden" });
        return true;
      }
      // pending / absent（还没生成过）：显示加载态继续等。
      setState({ kind: "pending" });
      return false;
    };

    const poll = async () => {
      if (!alive) return;
      if (++polls > MAX_POLLS) return void setState({ kind: "hidden" });
      try {
        const res = await fetch(path, { headers: { accept: "application/json" } });
        if (res.ok && apply(await res.json())) return;
      } catch {
        /* 网络抖动：下一轮再试 */
      }
      if (alive) timer = setTimeout(poll, 3000);
    };

    void (async () => {
      // 先读一次：命中缓存就直接渲染，不触发生成（省一次付费调用）。
      try {
        const res = await fetch(path, { headers: { accept: "application/json" } });
        if (res.ok) {
          const data = await res.json();
          if ((data as { kind?: string })?.kind === "ready") return void apply(data);
        }
      } catch {
        /* 读失败就当没缓存 */
      }
      if (!alive) return;
      setState({ kind: "pending" });
      // 触发生成可能要十几秒，不等它返回，转去轮询。
      // 但必须看它是否成功：被同源校验挡下（403）或网络失败时，若仍继续轮询，
      // GET 会一直返回 absent，读者就会对着"生成中"永远等下去。
      if (!triggered.current) {
        triggered.current = true;
        try {
          const res = await fetch(path, { method: "POST", headers: { accept: "application/json" } });
          if (!res.ok) return void setState({ kind: "hidden" });
          if (apply(await res.json())) return;
        } catch {
          return void setState({ kind: "hidden" });
        }
      }
      void poll();
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [articleId]);

  if (state.kind === "hidden") return null;

  if (state.kind !== "ready") {
    return (
      <section className="mt-7 xl:mt-8" aria-label="要点透视" aria-busy="true">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-accent">
          <span>要点透视</span>
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
          <span className="font-normal text-ink-4">生成中…</span>
        </div>
        <div className="space-y-4" aria-hidden>
          {SKELETON.map((group) => (
            <div key={group.name}>
              <div className="mb-1.5 h-3 w-20 animate-pulse rounded bg-line" />
              <div className="space-y-1.5">
                {Array.from({ length: group.rows }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-[9px] size-1 shrink-0 rounded-full bg-line" />
                    <span className="h-4 flex-1 animate-pulse rounded bg-line" style={{ maxWidth: `${88 - i * 11}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-7 xl:mt-8" aria-label="要点透视">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-accent">
        <span>要点透视</span>
      </div>
      <div className="space-y-5">
        {state.groups.map((group) => (
          <div key={group.key}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
              <span aria-hidden className="text-ink-4">{group.icon ?? "◆"}</span>
              {group.name}
            </div>
            <ul className="space-y-1.5">
              {group.points.map((point, i) => (
                <li key={i} className="flex gap-2 text-[14.5px] leading-[1.75] text-ink-2">
                  <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-4" />
                  <span>{withMarks(point.text, point.marks ?? [])}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}