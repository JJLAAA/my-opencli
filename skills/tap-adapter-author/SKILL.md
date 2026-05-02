---
name: tap-adapter-author
description: Use when writing a TAP adapter for a new site or command. Guides from reconnaissance through pipeline assembly, installation, and verification.
allowed-tools: Bash, Read, Write, Edit
---

# tap-adapter-author

你是给 TAP 写适配器的 agent。目标：**从零到 `tap <site> <command>` 输出正确数据的完整闭环**。

TAP 适配器是纯声明式的——没有自定义函数，只有 pipeline 步骤。

---

## 顶层决策树

```
START
  │
  ▼
用户想抓什么数据 / 哪个站点？
  │
  ▼
判断获取模式（→ references/patterns.md）
  │
  ├─ Pattern A: 公开 JSON API         → 直接 fetch
  ├─ Pattern B: 需要登录态的 API      → navigate + browserFetch
  ├─ Pattern C: 多请求 list-detail    → as + from + foreach
  ├─ Pattern D: XHR/fetch 请求被隐藏  → intercept
  └─ Pattern E: 数据在页面 DOM 里     → navigate + evaluate(DOM)
  │
  ▼
验证 API 端点可访问（curl / fetch 测试）
  │
  ▼
解码字段结构
  │
  ▼
设计 args + output.fields schema
  │
  ▼
组装 pipeline（→ references/patterns.md 模板）
  │
  ▼
向用户确认 schema 后安装到 ~/.tap/adapters/<site>/<command>.js
  │
  ▼
运行 tap <site> <command> 验证
  │
  ▼
DONE
```

---

## Runbook

```
[ ] 1. 明确目标
       [ ] 站点域名是什么？
       [ ] 想抓什么数据（列表 / 单条 / 排行）？
       [ ] 用户需要哪些参数（limit / keyword / category）？

[ ] 2. 侦察获取模式
       [ ] 在浏览器打开目标页面，打开 DevTools → Network 过滤 XHR/Fetch
       [ ] 观察：请求是否有 JSON 响应？URL 是否可以直接 curl？
       [ ] 判定 Pattern（A / B / C / D / E），见 references/patterns.md
       ✋ 向用户汇报：Pattern 判断结果 + API 端点 URL，等待确认后再继续

[ ] 3. 验证端点
       [ ] Pattern A：直接 curl 或 fetch 验证
       [ ] Pattern B：需要浏览器 cookie → 检查是否需要先登录
       [ ] Pattern C：确认列表接口和详情接口，优先用 as/from/foreach 表达
       [ ] Pattern D：在 Network Tab 找到被拦截的请求 URL
       [ ] Pattern E：确认数据在 DOM 里可用 document.querySelector 取到
       [ ] 确认：响应 200 + 非 HTML + 含目标数据

[ ] 4. 解码字段
       [ ] 找到 API 响应中目标字段的路径（可能有嵌套，如 data.list[0].title）
       [ ] 列出所有可用字段和类型（不要预先筛选，让用户选）
       [ ] 对比页面可见值确认字段映射正确（数量级 / 单位 / 格式）
       [ ] 为候选字段记录 raw path、示例值、观察到的类型、页面含义和不确定点
       ✋ 向用户汇报：列出全部候选字段 + 每个字段的示例值和含义判断，询问用户需要哪些字段

[ ] 5. 设计接口
       [ ] description：一句话说明该 adapter 返回什么数据、来自哪个站点/范围
       [ ] args：用户可配的参数，如 [{ name: 'limit', default: 20, description: 'Maximum number of items to return.' }]
       [ ] output.fields：按用户确认的字段声明 schema
       [ ] 每个字段必须有 type 和 description，可选 format / unit / nullable / source / examples
       [ ] 命名用 camelCase，单位清晰（如 viewCount 不是 play）
       [ ] columns：如需 table 输出，按 schema 字段顺序排列
       ✋ 向用户汇报：展示 description / args / output.fields / columns / pipeline 草稿，等待最终确认后再写文件

[ ] 6. 组装 pipeline
       [ ] 按 Pattern 选对应模板（references/patterns.md）
       [ ] 用 select 步骤提取嵌套路径（如 data.list）
       [ ] 多请求场景优先只用 as / from / foreach 三个概念，避免把请求逻辑塞进 evaluate 字符串
       [ ] map 步骤映射字段，用 ${{ }} 表达式
       [ ] map 输出 key 必须覆盖 output.fields 中声明的字段
       [ ] 末尾加 limit: '${{ args.limit }}'

[ ] 7. 安装适配器
       [ ] mkdir -p ~/.tap/adapters/<site>/
       [ ] 写入 ~/.tap/adapters/<site>/<command>.js

[ ] 8. 验证
       [ ] 运行 tap <site> <command>
       [ ] 确认 JSON 是 { meta, schema, items } envelope
       [ ] 确认 schema.properties 与 output.fields 一致
       [ ] 确认 items 只包含 schema 声明字段
       [ ] 检查行数、字段值是否与页面一致
       [ ] 如有 limit 参数，测试 tap <site> <command> --limit 5
```

---

## 降级路径

| 卡在 | 现象 | 跳去 |
|------|------|------|
| Step 2 | Network 没有 XHR | 尝试 Pattern E（DOM 提取）|
| Step 3 | curl 返回 403 | 需要 cookie → 改用 Pattern B |
| Step 3 | 返回 HTML | API 路径不对，重新看 Network |
| Step 3 | 返回 `{"data":[]}` 空数组 | 参数不对，检查 Network 请求参数 |
| Step 4 | 字段含义不清楚 | 对比页面排序推断（如排序后看哪列跟着变）|
| Step 5 | schema 含义无法确认 | 停下来询问用户，不要靠模型猜最终含义 |
| Step 6 | 嵌套结构复杂 | 先用 evaluate 在浏览器跑 JS 确认路径，再翻译成 select 步骤 |
| Step 8 | 输出空 | 检查 select 路径是否正确，在浏览器 console 验证 |
| Step 8 | 字段全是 undefined | map 里的 ${{ item.xxx }} 路径写错，检查实际字段名 |

---

## 参考文件

| 文件 | 什么时候翻 |
|------|----------|
| `references/patterns.md` | Step 2-6：判断 Pattern + 完整 pipeline 模板 |
| `references/field-mapping.md` | Step 6：${{ }} 表达式 + Pipeline Step Reference 速查 |
| `references/adapter-template.md` | Step 6-7：完整适配器结构 |

---

## 关键约定

- 适配器只能用 pipeline 声明式步骤，不能写自定义逻辑函数
- 顶层 `description` 必须写一句业务说明，用于 `tap schema` 全局命令发现；不能省略
- `args` 中每个参数都应写 `description`，让 `tap schema <site> <command>` 能指导 Agent 正确调用
- `output.fields` 是 JSON 输出契约，必须由用户确认后写入；不要从字段名或样例值静默猜最终 schema
- JSON 输出只包含 `output.fields` 声明的字段；未声明字段会被 runtime 丢弃
- `columns` 只决定表格列顺序，必须与 schema/map 输出字段对齐
- 需要浏览器的适配器（Pattern B/D/E，以及使用 `browserFetch` 的 Pattern C）要求本地 Chrome 以 `--remote-debugging-port=9222` 启动
- 适配器路径：`~/.tap/adapters/<site>/<command>.js`（`<site>` 通常是域名主体，如 `bilibili`、`linuxdo`）
- 调试过程中的临时 JSON 文件只落在 `/tmp/`，不要留在项目目录

## Schema 确认规则

写入适配器前必须向用户展示 adapter schema 确认表，并包含顶层 description：

| adapter description | site | command | uncertainty |
|---------------------|------|---------|-------------|
| Fetch recent articles from example.com. | example | articles | low |

| output field | raw path | type | description | sample | uncertainty |
|--------------|----------|------|-------------|--------|-------------|
| title | data.items[].title | string | Item title. | "..." | low |

确认要求：

- 顶层 `description` 必须说明 adapter 的业务用途，不只复述命令名
- 字段名使用 camelCase，表达业务含义，不照搬含糊的上游字段名
- `type` 使用 `string` / `integer` / `number` / `boolean` / `array` / `object`
- `description` 必须说明业务含义，不只复述字段名
- 有单位的数字必须写 `unit`
- 时间、URL、ID 等格式字段应写 `format`
- 不确定字段必须显式标记并询问用户，不允许静默写入
