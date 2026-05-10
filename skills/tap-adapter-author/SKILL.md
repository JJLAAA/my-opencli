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
  ├─ Pattern A: 公开 JSON API              → 直接 fetch
  ├─ Pattern B: 需要登录态的 JSON API      → navigate + browserFetch
  ├─ Pattern C: 多请求 list-detail         → as + from + foreach
  ├─ Pattern D: XHR/fetch 请求被隐藏       → intercept
  ├─ Pattern E: 数据在页面 DOM 里          → navigate + evaluate(DOM)
  └─ Pattern F: 登录态 HTML partial 接口   → navigate + evaluate(fetch+DOMParser)
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
       [ ] 先确认页面可访问和登录态：
           [ ] navigate 打开目标页面，确认是否 200 可正常渲染
           [ ] 页面是否包含目标数据（不是 login wall / captcha / blocked）？
           [ ] TAP browser 是否已登录目标站点？
       [ ] 侦察 DOM（现代站点必做）：
           [ ] 是否有 custom element（如 <shreddit-post>、<faceplate-*>）携带 attributes 数据？
           [ ] 是否有 script[type="application/json"] 或 hydration 全局变量（__NEXT_DATA__、__NUXT__ 等）？
           [ ] 是否有 infinite-scroll loader 元素（含 src / href / data-cursor / slot="load-after"）？
       [ ] 侦察 Network：
           [ ] XHR/Fetch 有 JSON 响应？URL 是否可直接 curl？
           [ ] 有同源 HTML partial endpoint（/svc/、/_next/、/api/ 等返回 HTML 片段）？
           [ ] 有 GraphQL / RSC / server component payload？
           [ ] infinite-scroll 翻页请求的 URL 和 cursor 参数？
       [ ] 判定 Pattern（A / B / C / D / E / F），见 references/patterns.md
       ✋ 向用户汇报：Pattern 判断结果 + 候选 endpoint URL，等待确认后再继续

[ ] 3. 验证端点
       [ ] Pattern A：直接 curl 或 fetch 验证，确认 200 + JSON + 含目标数据
       [ ] Pattern B：需要浏览器 cookie → 检查是否需要先登录，browserFetch 测试
       [ ] Pattern C：确认列表接口和详情接口，优先用 as/from/foreach 表达
       [ ] Pattern D：在 Network Tab 找到被拦截的请求 URL
       [ ] Pattern E：确认数据在 DOM 里可用 document.querySelector 取到
       [ ] Pattern F：在浏览器上下文 fetch 同源 HTML partial，DOMParser 解析后确认含目标 item
       ⛔ 端点返回 403 或 HTML 时的判断门禁（不得直接跳 OAuth）：
           [ ] 先打开页面本身，确认浏览器已登录、页面正常渲染
           [ ] 侦察 DOM 是否包含结构化 custom element attributes
           [ ] 侦察同源 partial/GraphQL/HTML endpoint（/svc/、/api/、/_next/ 等）
           [ ] 在浏览器上下文 fetch 候选 URL，带 credentials: include
           [ ] 以上全部路径验证失败后，才能引入 token/apiKey/accessToken 参数

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
       [ ] examples（可选）：写 1-3 个常用调用示例，会在 tap help <site> <command> 中展示
              格式：[{ description?: '说明', args: { limit: 5 } }, ...]
              建议写：默认调用、指定 limit、组合 --fields 的典型用法
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
       [ ] limit 验证（三档必测）：
           [ ] 测试 tap <site> <command> --limit 3（小值）
           [ ] 测试 tap <site> <command>（默认 limit，确认条数符合 default 值）
           [ ] 测试 tap <site> <command> --limit <default+10>（超出首屏/首页数量）
           ⚠️ 依赖无限滚动或分页的 adapter，必须验证超出首屏的数据能正确拉取
       [ ] nullable 字段抽样验证：
           [ ] 对可能为空的字段（正文、图片等），按 item 类型抽样确认
           [ ] 若字段为空，确认是业务上确实为空还是 selector 错误
           [ ] nullable 字段 description 要注明何时为空
```

---

## 降级路径

| 卡在 | 现象 | 跳去 |
|------|------|------|
| Step 2 | Network 没有 XHR/JSON | 侦察 DOM custom elements / HTML partial → 尝试 Pattern F 或 E |
| Step 3 | curl / fetch 返回 403 | 先执行"403 判断门禁"（见 Step 3），确认浏览器登录态 + 同源接口都无效后再考虑 token |
| Step 3 | 返回 HTML（非 JSON） | 确认是否是 HTML partial（Pattern F）；不是则 API 路径不对，重新看 Network |
| Step 3 | 返回 `{"data":[]}` 空数组 | 参数不对，检查 Network 请求参数 |
| Step 3 | 浏览器页面正常但 API 403 | 优先 Pattern F（同源 HTML partial）；其次 Pattern E（DOM 提取）；最后才考虑 OAuth |
| Step 4 | 字段含义不清楚 | 对比页面排序推断（如排序后看哪列跟着变）|
| Step 5 | schema 含义无法确认 | 停下来询问用户，不要靠模型猜最终含义 |
| Step 6 | 嵌套结构复杂 | 先用 evaluate 在浏览器跑 JS 确认路径，再翻译成 select 步骤 |
| Step 8 | 输出空 | 检查 select 路径是否正确，在浏览器 console 验证 |
| Step 8 | 字段全是 undefined | map 里的 ${{ item.xxx }} 路径写错，检查实际字段名 |
| Step 8 | 默认 limit 实际返回数量不足 | 检查分页逻辑：是否只取了首屏/首页；Pattern F 需跟随 load-after 翻页 |

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
- 顶层 `examples`（可选）：写 1-3 个典型调用示例，在 `tap help` 中展示给用户和 Agent，格式为 `[{ description?, args }]`
- `args` 中每个参数都应写 `description`，让 `tap schema <site> <command>` 能指导 Agent 正确调用
- `output.fields` 是 JSON 输出契约，必须由用户确认后写入；不要从字段名或样例值静默猜最终 schema
- JSON 输出只包含 `output.fields` 声明的字段；未声明字段会被 runtime 丢弃
- `columns` 只决定表格列顺序，必须与 schema/map 输出字段对齐
- 需要浏览器的适配器（Pattern B/D/E/F，以及使用 `browserFetch` 的 Pattern C）要求本地 Chrome 以 `--remote-debugging-port=9222` 启动
- 适配器路径：`~/.tap/adapters/<site>/<command>.js`（`<site>` 通常是域名主体，如 `bilibili`、`linuxdo`）
- 调试过程中的临时 JSON 文件只落在 `/tmp/`，不要留在项目目录

**敏感参数门禁**：新增任何 token / accessToken / apiKey / cookie / secret / session 参数前，必须满足全部条件：
- 已验证浏览器登录态页面不可用（页面本身 blocked 或未登录）
- 已验证同源 HTML partial / GraphQL / internal endpoint 不可用（Pattern F 不可行）
- 已验证页面 DOM 不含结构化目标数据（Pattern E 不可行）
- 已向用户说明为什么以上路径都失败、为什么必须引入该参数
- 参数 `description` 明确说明获取方式、有效期、敏感性；不得把 token 写入 adapter 文件或日志

**不符合此门禁不得引入敏感参数。**

**数据访问优先级**（从最低摩擦到最高）：
1. 公开 JSON/API（无需认证）
2. 浏览器登录态同源 JSON API（Pattern B）
3. 浏览器登录态同源 HTML partial / GraphQL（Pattern F）
4. 页面 DOM / custom element attributes（Pattern E）
5. 用户自然拥有的登录态 cookie（浏览器已登录即可）
6. 外部 token / API key / OAuth（最后手段）

**infinite-scroll 分页约定**：
- 优先寻找 next/cursor/partial endpoint（`slot="load-after"` src、`data-cursor`、`rel="next"` 等）
- 模拟 scrollTo(document.body.scrollHeight) 只能作为最后降级方案
- 不能只测小 limit；必须测试超出首屏数量的 limit 验证分页逻辑

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
