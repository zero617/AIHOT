
【领域翻译规则 — 本平台覆盖 AI + 科技生活（数码硬件/软件应用/游戏/影视/消费生活），严格遵守】

**总原则**：先判断这个词在本文语境里属于哪个领域，再按对应规则处理。AI 术语按下面第1、2、3 节规则；消费电子品牌名、软件名、游戏名、影视作品名按第 5 节规则（保留原文）。

1. 歧义默认值：以下词在中文有非 AI 歧义，**一律按 AI 含义翻译**：
   - LLM = 大语言模型（绝不译"法学硕士"/"Master of Laws"）
   - Token / tokens = 模型 token（保留英文；绝不译"代币"/"令牌"）
   - Transformer = Transformer 架构（保留英文；不译"变压器"）
   - Diffusion = 扩散模型（AI 生成，不是物理扩散）
   - Agent / Agentic = AI 智能体 / 智能体的（不译"代理人"/"中介"）— 科技生活领域的"智能家居/智能门锁"不译成"智能体"，按产品名保留
   - Alignment = 对齐（AI 安全语境）
   - Inference = 推理（模型生成）— 但"推理小说""推理游戏"按内容类型处理，不译模型推理
   - Reasoning = 推理（注意：与 inference 都译"推理"，必要时用"链式推理"区分 CoT；reasoning model 指 o1/o3/R1 这类思考型模型）
   - Embedding = 嵌入向量（也可保留英文）
   - Distillation = 知识蒸馏
   - Hallucination = 模型幻觉
   - Fine-tune / Fine-tuning = 微调
   - Pretrain / Pretraining = 预训练
   - Context window = 上下文窗口
   - Prompt = 提示词
   - Skill / Skills = 技能（Claude 等 Agent 框架的能力包，不译"特长"）

2. 以下专有名词**一律保留英文原文**，不翻译不加中文括注：
   - AI 公司：OpenAI / Anthropic / Google DeepMind / xAI / Meta AI / Mistral / DeepSeek / Cohere / HuggingFace（HF）/ Runway / ElevenLabs / Suno / Pika / Midjourney / Perplexity
   - 模型族（举例 + 通用规则）：GPT / Claude / Gemini / Llama / Qwen / Grok / o 系列 / DeepSeek / Mistral / Mixtral / Phi / Sora / Veo / Imagen
     **规则**：任何大模型族名、产品代号一律保留英文
   - 模型版本号（举例 + 通用规则）：GPT-5 / Claude 4.7 / Claude Sonnet 4.6 / Llama 4 / Gemini 3 / o3 / o4 / DeepSeek-V4 / Qwen3.7
     **规则**：版本号一字不改（包括字母数字后缀如 4o / 4.7 / 405B / V4 / R1），绝不"翻译性扩写"（不要把 "405B" 译成 "4050 亿"，不要把 "V4" 译成 "第 4 代"）
   - 技术缩写（举例 + 通用规则）：LLM / RAG / RLHF / DPO / LoRA / QLoRA / PEFT / MoE / CoT / ReAct / KV cache / SOTA / AGI / MCP / ADK / NPU / GPU / TPU
     **规则**：任何 2-5 字母的全大写缩写，默认按 AI/ML 含义保留英文
   - 评测基准（举例 + 通用规则）：MMLU / GPQA / HumanEval / SWE-bench / SWE-bench Verified / AIME / HLE / ARC-AGI / ARC-AGI 2 / MT-Bench / Chatbot Arena / Aider Polyglot / LiveCodeBench
     **规则**：以 -bench / -eval 结尾或全大写的评测名一律保留英文
   - AI 工具/产品：Cursor / Copilot / Codex / Aider / Devin / Cline / Claude Code / Windsurf / Zed / v0 / Bolt / Lovable / Replit Agent
   - Agent 框架：LangChain / LangGraph / LlamaIndex / CrewAI / AutoGen / Pydantic AI / Vercel AI SDK / DSPy
   - 推理/部署：Ollama / vLLM / SGLang / TensorRT / Triton / CUDA / ROCm
   - 通用技术：API / SDK / CLI / IDE / SaaS / CDN / SSO / OAuth / JWT / WebSocket / SSE / gRPC

3. 中国厂商**优先用官方中文品牌名**（首次出现可双标"千问（Qwen3）"，后续选一种保持一致）：
   - 千问（Qwen）/ 文心一言 / 智谱（GLM）/ 月之暗面（Kimi）/ 深度求索（DeepSeek）/ 阶跃星辰（Step）/ 零一万物（Yi）/ 百川 / 豆包（字节）/ 混元（腾讯）/ 可灵（Kling，快手）/ 即梦（Jimeng，字节）/ MiniMax（不译）/ 美团 LongCat / 昆仑万维 Skywork / 面壁 MiniCPM / 华为昇腾 / 寒武纪

4. 代码 / 命令 / URL / 数字单位 **一字不改**保留：
   - 反引号代码 `code` 不翻译
   - 命令如 /code-review、pip install、npm run 不译（不要译"代码审查"）
   - URL 原样
   - 数字+单位：8k context / 175B params / 3.5x speedup / $3 per M tokens / 99.9%
   - 金额、参数量、比例、区间必须保留原文的阿拉伯数字和单位；不要把 $10B-$100B 改写成"数百亿至数千亿美元"等中文数量词

5. **科技生活领域的专有名词同样保留原文**（与 AI 领域一致，不要硬译）：
   - 消费电子与品牌：iPhone / iPad / Mac / Apple Watch / Vision Pro / AirPods / Galaxy / Pixel / Xiaomi / Redmi / 华为 Mate / Pura / 小米 / 荣耀 Magic / OPPO Find / vivo X / 一加 / realme / 尼康 / 索尼 / 佳能 / GoPro / Kindle / Steam Deck / Switch / PS5 / Xbox
     **规则**：型号名（iPhone 18 Pro、Magic9、Find X8）一字不改，包括数字和后缀；"评测/体验/上手"是文章体裁，不是产品名
   - 操作系统与软件：iOS / macOS / Windows / Android / HarmonyOS / 鸿蒙 / ColorOS / MIUI / OneUI / Linux / ChromeOS / SteamOS / Steam / Epic Games Store
   - 硬件规格：骁龙 / 天玑 / 麒麟 / A系列 / M系列 / NPU / GPU / 内存 / 存储 / 刷新率 / 快充 / 电池容量
     **规则**：规格数字保留原文（"5000mAh 电池""120Hz 刷新率"），不要换成中文数量词
   - 游戏：游戏名一律保留原文（含中文游戏名的原译名，如《塞尔达传说：旷野之息》）；游戏平台与引擎 Unity / Unreal Engine / Steam / Epic / Switch
   - 影视音乐：作品名、剧集名、专辑名保留原文（《黑镜》《沙丘》《流浪地球》）；流媒体平台 Netflix / Disney+ / Bilibili / 腾讯视频 / 爱奇艺 / 优酷 / Spotify / Apple Music
   - 电商与生活：比价与团购平台、支付方式、快递与物流公司名保留原文（京东 / 淘宝 / 天猫 / 拼多多 / 唯品会 / 美团 / 闲鱼 / 支付宝 / 微信支付 / 顺丰 / 京东物流）
   - **不要把科技生活内容往 AI 上靠**：iPhone 的处理器性能、相机影像、电池续航、机身工艺就是数码本身，不需要译成"端侧推理""多模态感知"；游戏玩法、影视剧情、消费决策也不套AI 术语
