# TAP

一个轻量级 CLI 工具，用于执行声明式数据管道，从 Web 数据源抓取并转换数据。

```
tap <site> <command> [--key value] [--format json|table]
```

> TAP 是 [opencli](https://github.com/jackwener/opencli) 的简化版本。如需更完整的功能实现，请参考原项目。

---

*[English](README.md)*

---

## 工作原理

TAP 将**抓取什么**与**如何抓取**分离(意图与实现分离)：

- **适配器**（`~/.tap/adapters/<site>/<command>.js`）声明 pipeline —— 一系列描述数据来源和转换方式的步骤。
- **核心引擎**负责执行步骤、管理浏览器会话、格式化输出。

### 执行流程

```
CLI 参数
  └─ 从 ~/.tap/adapters/<site>/<command>.js 加载适配器
       └─ executePipeline(steps, args, cdpSession?)
            └─ printOutput(data, format, columns)
```

Pipeline 按顺序执行每个步骤。每个步骤接收上一步的输出作为 `data`，并产生新的 `data` 传递给下一步。

---

## 安装

**前置依赖：** [Bun](https://bun.sh) 运行时。

```bash
git clone <repo>
cd tap
bun install
bun run build        # 生成 ./tap 二进制文件
```

将二进制文件移到 `$PATH` 中：

```bash
mv tap /usr/local/bin/tap
```

---

## 使用

```bash
# 查看所有站点和命令
tap help

# 查看某个站点的命令
tap help bilibili

# 查看命令的参数说明
tap help bilibili hot
# 或：
tap bilibili hot --help

# 执行命令
tap bilibili hot
tap bilibili hot --limit 10
tap bilibili hot --format table
tap linuxdo news --limit 5
```

### 输出格式

| 参数 | 说明 |
|------|------|
| _（默认）_ / `--format json` | JSON 数组，便于 Agent 解析 |
| `--format table` | ASCII 表格，便于人工阅读 |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TAP_CDP_ENDPOINT` | `http://localhost:9222` | 浏览器适配器使用的 Chrome DevTools Protocol 端点 |
| `TAP_ADAPTERS_DIR` | _（无）_ | 额外的适配器搜索目录（优先于用户和内置适配器） |

### 适配器搜索顺序

设置 `TAP_ADAPTERS_DIR` 时：

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js`
2. `~/.tap/adapters/<site>/<command>.js`
3. `<repo>/adapters/<site>/<command>.js`（内置）

未设置 `TAP_ADAPTERS_DIR` 时：

1. `~/.tap/adapters/<site>/<command>.js`
2. `<repo>/adapters/<site>/<command>.js`（内置）

第一个匹配的文件优先生效。

---

## 适配器参考

### 文件结构

```js
// ~/.tap/adapters/<site>/<command>.js
export default {
  description: '在 help 中显示的简短描述。',
  args: [
    { name: 'limit', default: 20, description: '最多返回多少条。' },
    { name: 'keyword', required: true, description: '搜索关键词。' },
  ],
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: [ /* 步骤数组 */ ],
};
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `description` | 否 | 在 `tap help <site> <command>` 中显示 |
| `args` | 否 | CLI 参数，支持默认值和说明 |
| `columns` | 否 | 表格列名顺序，必须与 map 步骤输出的 key 对应 |
| `pipeline` | 是 | 有序的步骤数组 |

### Pipeline 步骤

每个步骤是一个只含单个 key 的对象，key 名即操作类型。

#### `fetch` — HTTP GET

```js
{ fetch: 'https://api.example.com/data' }
// 或带模板：
{ fetch: { url: 'https://api.example.com/search?q=${{ args.keyword }}' } }
```

返回解析后的 JSON，不需要浏览器。

#### `navigate` — 在浏览器中打开 URL

```js
{ navigate: 'https://example.com' }
```

等待 `Page.loadEventFired` + 800ms SPA 初始化时间。需要 Chrome 开启远程调试。

#### `evaluate` — 在浏览器上下文中执行 JS

```js
{ evaluate: `document.title` }
// 或异步：
{ evaluate: `(async () => {
  const res = await fetch('/api/data');
  return res.json();
})()` }
```

将返回值替换为新的 `data`，运行时拥有完整页面上下文（cookie、session）。

#### `intercept` — 捕获 XHR/fetch 请求

```js
{ intercept: {
  capture: 'api/timeline',       // 匹配的 URL 子串
  trigger: 'navigate:https://example.com/feed',  // 触发请求的动作
  timeout: 8,                    // 等待秒数（默认 8）
  select: 'data.items',         // 从捕获响应中提取的 selector 路径
}}
```

通过在页面中注入代码拦截 `window.fetch` 和 `XMLHttpRequest`。

**trigger 前缀：**

| 前缀 | 示例 |
|------|------|
| `navigate:` | `navigate:https://example.com` |
| `evaluate:` | `evaluate:document.querySelector('.load-more').click()` |
| `click:` | `click:.load-more-btn` |
| `scroll` | `scroll` 或 `scroll:down` / `scroll:up` |

#### `select` — 提取嵌套值

```js
{ select: 'data.list' }
{ select: 'result.0.items' }
{ select: 'data.items[0].title' }
{ select: 'data["hot-list"][*].title' }
{ select: 'groups[*].items[*]' }
```

支持的 selector 语法：

| 语法 | 说明 |
|------|------|
| `data.items.0.title` | 兼容旧点路径，数字片段表示数组下标 |
| `data.items[0].title` | bracket 数组下标 |
| `data["hot-list"]` | quoted key，适合带标点或点号的字段名 |
| `data.items[*].title` | 从数组每个元素中投影同一个字段 |
| `groups[*].items[*]` | 每个 wildcard 展开一层嵌套数组 |

路径不存在时返回 `null`。

#### `map` — 转换数组元素

```js
{ map: {
  rank:   '${{ index + 1 }}',
  title:  '${{ item.title }}',
  author: '${{ item.owner.name }}',
  play:   '${{ item.stat.view }}',
}}
```

支持内联 `select` 先提取再映射：

```js
{ map: {
  select: 'data.list',
  title: '${{ item.title }}',
}}
```

#### `filter` — 按表达式过滤

```js
{ filter: 'item.play > 10000' }
{ filter: 'index < 5' }
```

#### `sort` — 排序

```js
{ sort: { by: 'play', order: 'desc' } }
{ sort: 'title' }
```

#### `limit` — 截取前 N 条

```js
{ limit: 20 }
{ limit: '${{ args.limit }}' }
```

### 模板表达式

模板使用 `${{ expression }}` 语法。可用上下文变量：

| 变量 | 可用步骤 | 说明 |
|------|---------|------|
| `item` | `map`、`filter` | 当前数组元素 |
| `index` | `map`、`filter` | 从 0 开始的索引 |
| `args` | 所有步骤 | 解析后的 CLI 参数（含默认值） |
| `data` | 所有步骤 | 当前 pipeline 数据 |
| `root` | `map` | 内联 select 前的原始数据 |

---

## 适配器模式

### 模式 A — 公开 JSON API

无需浏览器，直接 HTTP 请求。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['title', 'score'],
  pipeline: [
    { fetch: 'https://api.example.com/top' },
    { select: 'data.list' },
    { map: { title: '${{ item.title }}', score: '${{ item.score }}' } },
    { limit: '${{ args.limit }}' },
  ],
};
```

### 模式 B — 需要登录态的 API（浏览器 Cookie）

先 navigate 建立会话，再在浏览器上下文中 fetch。

```js
pipeline: [
  { navigate: 'https://example.com' },
  { evaluate: `(async () => {
    const res = await fetch('/api/feed', { credentials: 'include' });
    return res.json();
  })()` },
  { select: 'data.items' },
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### 模式 C — 拦截 XHR/fetch 请求

捕获页面交互触发的 API 调用。

```js
pipeline: [
  { intercept: {
    capture: '/api/timeline',
    trigger: 'navigate:https://example.com/home',
    timeout: 10,
    select: 'data',
  }},
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### 模式 D — DOM 提取

直接从渲染后的 HTML 中抓取数据。

```js
pipeline: [
  { navigate: 'https://example.com/ranking' },
  { evaluate: `
    [...document.querySelectorAll('.item')].map(el => ({
      title: el.querySelector('.title')?.textContent?.trim(),
      link:  el.querySelector('a')?.href,
    }))
  ` },
  { map: { rank: '${{ index + 1 }}', title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

---

## 浏览器适配器

使用 `navigate`、`evaluate` 或 `intercept` 的适配器需要开启远程调试的 Chrome 实例：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --no-first-run --no-default-browser-check --headless --user-data-dir=~/.chrome-automation-profile

# Linux
google-chrome --remote-debugging-port=9222

# 无头模式
google-chrome --headless --remote-debugging-port=9222
```

TAP 会自动扫描 pipeline 步骤判断是否需要浏览器，每次运行新建一个标签页，结束后自动关闭。

---

## 用 AI 辅助构建适配器

TAP 附带一个 Claude Code skill（`tap-adapter-author`），引导你完成从站点侦察到 `tap <site> <command>` 输出正确数据的完整闭环。

### 前置准备

安装 [Claude Code](https://claude.ai/code)，在本项目目录中即可使用该 skill。

### 工作流

调用 skill，描述你想抓取的内容：

```
/tap-adapter-author

我想抓取 Hacker News 的热门帖子。
```

skill 会引导你完成：

1. **判断获取模式** — 公开 API、需要登录、拦截 XHR 还是 DOM 抓取
2. **验证端点** — 确认 API 返回预期数据
3. **解码字段结构** — 将响应字段映射到输出列
4. **组装 pipeline** — 生成完整的适配器文件
5. **安装适配器** — 写入 `~/.tap/adapters/<site>/<command>.js`
6. **验证** — 运行 `tap <site> <command>` 确认输出正确

### 决策树

```
想抓什么数据？
  │
  ├─ 公开 JSON API（curl 可直接访问）      → 模式 A：直接 fetch
  ├─ 需要浏览器登录/Session              → 模式 B：navigate + evaluate(fetch)
  ├─ XHR 隐藏在页面交互后               → 模式 C：intercept
  └─ 数据只在 DOM 里                    → 模式 D：navigate + evaluate(DOM)
```

每种失败情形（403、空数组、字段缺失等）都有对应的降级路径。

---

## 示例

### 内置：Bilibili 热门视频

```bash
tap bilibili hot
tap bilibili hot --limit 5
tap bilibili hot --format table
```

```json
[
  {
    "rank": "1",
    "title": "...",
    "author": "...",
    "play": "1234567"
  }
]
```

### 内置：Linux.do 新闻

```bash
tap linuxdo news
tap linuxdo news --limit 10
```

---

## 项目结构

```
tap/
├── bin/cli.js              # 入口 — 委托给 src/cli.js
├── src/
│   ├── cli.js              # 参数解析、help 路由、pipeline 编排
│   ├── executor.js         # Pipeline 执行引擎
│   ├── cdp.js              # Chrome DevTools Protocol 会话
│   ├── adapters.js         # 适配器发现与加载
│   ├── help.js             # Help 文本生成
│   └── output.js           # 表格 / JSON 格式化输出
└── adapters/               # 内置适配器
    ├── bilibili/hot.js
    └── linuxdo/news.js
```

用户适配器存放于 `~/.tap/adapters/`，优先级高于内置适配器。

---

## 依赖

| 包 | 用途 |
|----|------|
| `ws` ^8.0.0 | CDP 通信的 WebSocket 客户端 |

运行时：[Bun](https://bun.sh)（构建与执行）。编译后的二进制文件自包含，运行时不依赖 Bun。
