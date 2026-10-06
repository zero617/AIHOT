// 要点透视的公开门面。生成逻辑住在 content/highlights.ts（要花钱的写路径），公开路由不直接
// import 后端内部模块，统一从这里过：highlightState 是读，ensureHighlights 是同源才触发的写。
export { ensureHighlights, highlightState } from "../content/highlights.ts";
export type { HighlightGroup, HighlightGroupKey, HighlightState } from "../content/highlights.ts";