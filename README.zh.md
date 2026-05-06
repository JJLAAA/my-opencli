# TAP

一个轻量级 CLI 工具，用于执行声明式数据管道，从 Web 数据源抓取并转换数据。

```
tap <site> <command> [--key value]
```

## 核心价值

TAP 的价值在于把业务系统中已经存在、但不适合 Agent 直接消费的数据和操作，封装成稳定、可验证、结构化的 CLI 能力。

最终目标是让 Agent 能基于真实业务上下文进行查询、诊断、汇总、排障和辅助决策，而不需要直接理解复杂 UI，也不需要临时编写一次性爬虫。

## 设计决策：数据访问层，而不是触发型 Skill

TAP 的定位是嵌入到其他 Agent 工作流中的结构化数据访问层。它不包含启发式的”使用 TAP”skill，因为 TAP 的设计初衷不是让 Agent 自主发现并使用它。

使用流程是两阶段、由人类发起的：

1. **人类使用 `tap-adapter-author` 表达意图** — 描述要接入的数据源。Skill 引导完成全流程：站点侦察、端点验证、schema 确认、pipeline 组装，并将适配器安装到 `~/.tap/adapters/<site>/<command>.js`。
2. **适配器被声明进特定的工作流** — 此后，Agent 在该工作流的上下文中运行，将 `tap` 作为结构化数据源调用。Agent 通过 `tap schema` 发现命令契约并执行调用，不需要自行判断是否应该使用 TAP。

这意味着 TAP 的 Agent 友好设计（schema 自省、结构化错误、退出码、JSON 输出）服务的是**已知自己处于 TAP 工作流中的 Agent**，而不是自主探索工具的 Agent。`tap-adapter-author` 是人类侧的入口；TAP 本身是 Agent 侧的执行接口。二者职责分离，互不重叠。

> TAP 是 [opencli](https://github.com/jackwener/opencli) 的轻量版本。核心区别是浏览器隔离：TAP 将 Chrome 视为专供 Agent 使用的操作平台，而不是通过 daemon + extension 控制用户日常使用的 Chrome。

---

*[English](README.md)*

---

## 工作原理

TAP 将**抓取什么**与**如何抓取**分离(意图与实现分离)：

- **适配器**（`~/.tap/adapters/<site>/<command>.js`）声明 pipeline —— 一系列描述数据来源和转换方式的步骤。
- **核心引擎**负责执行步骤、管理浏览器会话、格式化输出。

长期方向见：[TAP 长期规划：面向 Agent 的只读业务数据接入层](docs/readonly-data-access-roadmap.md)。

### 执行流程

```
CLI 参数
  └─ 从 ~/.tap/adapters/<site>/<command>.js 加载适配器
       └─ executePipeline(steps, args, cdpSession?)
            └─ printOutput(data, format, { adapter, site, command, args })
```

Pipeline 按顺序执行每个步骤。每个步骤接收上一步的输出作为 `data`，并产生新的 `data` 传递给下一步。步骤也可以用 `as` 保存结果，并在后续用 `from` 读取，让多请求适配器保持可读，不必把编排逻辑塞进一个大脚本里。

---

## TAP 与 OpenCLI 的核心区别

OpenCLI 优先降低使用摩擦：它通过本地 daemon 和 Browser Bridge extension 控制用户已经在使用的 Chrome，因此浏览器型命令可以直接复用用户日常 Chrome profile 里的 cookie、标签页和登录态。

TAP 刻意选择另一种模型：Chrome 是一个**独立的 Agent 操作平台**。浏览器适配器连接到用户显式启动的 remote-debugging Chrome，通常使用独立 profile，例如 `~/.chrome-automation-profile`。你只需要在这个 Agent profile 里登录目标网站一次，之后 TAP 会复用这个 profile 的登录态。

这种隔离带来的好处是：

- Agent 的误操作被限制在 automation profile 内，不会影响人的日常浏览器。
- cookie、localStorage、扩展和标签页状态更可控，问题更容易复现。
- 不需要安装浏览器扩展，也不需要常驻 daemon。
- 代价是首次需要显式初始化：启动 Agent Chrome，并在其中完成登录。

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

显式初始化用户自己的 TAP 文件：

```bash
tap setup
```

`tap setup` 会创建 `~/.tap/`、`~/.tap/adapters/`、`~/.tap/logs/`，并写入默认 `~/.tap/config.json`。已有配置默认保留，只有传入 `--force` 才会覆盖。

**安装范围：** 安装 TAP 二进制文件，包括通过 npm 包分发安装时，只会安装 CLI runtime。适配器包和 assistant skill 都需要显式安装：

```bash
tap adapter install github:<owner>/<repo>
tap skill install codex
```

如果使用 Claude Code，则改用 `tap skill install claude-code`。

npm 分发使用一个很小的主 wrapper 包，加上按平台拆分的 optional binary packages。安装 `@leolee812/tap` 时，npm 只会下载当前 OS/CPU 兼容的二进制包，而不是把所有支持平台的二进制都打进主包。

---

## 使用

```bash
# 查看所有站点和命令
tap help

# 输出已安装版本
tap version
tap --version
tap -v

# 初始化或刷新本地 TAP 文件
tap setup
tap setup --force

# 诊断本地环境
tap doctor

# 发现机器可读的命令契约
tap schema
tap schema <site>
tap schema <site> <command>
tap schema browser start

# 管理 Agent Chrome
tap browser start
tap browser status
tap browser stop

# 安装、列表或移除适配器包
tap adapter install github:<owner>/<repo>
tap adapter install url:<https-url-to-zip-or-tarball>
tap adapter install git:<git-url>
tap adapter install git:<git-url> --force
tap adapter list
tap adapter remove <pack-name>

# 安装适配器后查看某个站点的命令
tap help <site>

# 查看命令的参数说明
tap help <site> <command>
# 或：
tap <site> <command> --help

# 执行适配器命令
tap <site> <command>
tap <site> <command> --limit 10
```

### 输出格式

| 参数 | 说明 |
|------|------|
| _（默认）_ / `--format json` | 数据命令输出包含 `meta`、`schema`、`items` 的 JSON envelope |

JSON 是数据命令唯一支持的输出格式，管理命令也会输出 JSON。`--format json` 仍可显式传入，但对这些命令都是可选的。Help 命令会有意输出面向人阅读的文本。

### Agent 契约发现

Agent 应优先通过 `tap schema` 发现命令和参数，而不是解析 help 文本。

```bash
# 列出适配器命令和管理命令
tap schema

# 列出某个站点的所有命令
tap schema <site>

# 查看某个适配器命令
tap schema <site> <command>

# 查看某个管理命令
tap schema browser start
tap schema doctor
```

`tap schema` 返回包含 `meta.schemaVersion` 和 `commands` 数组的 JSON。每个命令都带有 `schemaCommand` 字段，指向命令级 schema。命令级 schema 会包含参数 flag、类型、默认值、必填标记、枚举/范围约束，以及适用时的输出 schema。

`tap schema <site>` 返回站点级 schema，`meta.kind` 为 `"site"`，列出该站点所有命令。每个命令条目包含 `kind`、`site`、`command`、`name`、`description` 和 `schemaCommand`。如果适配器无法加载，该条目会包含 `loadError` 对象而非 description。未知站点会返回 `code: "unknown_site"` 的结构化使用错误。

查看管理命令 schema 时，只传入 `tap schema` 中列出的命令词即可（例如 `tap schema browser start`）；适配器 flag 不属于 schema 查询参数。

### 退出码

| 码 | 名称 | 含义 | Agent 应对 |
|----|------|------|------------|
| 0 | success | 命令成功 | 解析 stdout |
| 1 | general_error | 意外错误 | 检查错误，通常应停止 |
| 2 | usage_error | 调用错误、未知选项、缺少必需参数、不支持的格式 | 修正命令 |
| 3 | config_error | TAP 配置缺失或无效 | 运行 `tap setup` |
| 4 | browser_error | Chrome/CDP 不可用 | 运行 `tap browser status` / `tap browser start` |
| 5 | upstream_error | 网络或远程 API 失败 | `retryable: true` 时可重试 |
| 6 | adapter_contract_error / adapter_load_error | 适配器输出 schema 无效，或适配器文件无法加载 | 修复适配器的 `output.fields`、JavaScript 语法或模块导出 |

适配器管理命令使用退出码 `2` 表示用法错误（未知源格式、缺少参数），退出码 `5` 表示下载/克隆失败（可重试），退出码 `6` 表示包契约错误（无效的 `tap-adapter.json`、缺少 `adapters/` 目录）和文件冲突。

### 结构化错误

CLI 失败会在 stderr 输出 JSON 错误：

```json
{
  "error": {
    "code": "missing_required_arg",
    "message": "Missing required argument: --subreddit",
    "suggestion": "Run: tap reddit hot --help",
    "retryable": false,
    "details": {}
  }
}
```

适配器加载失败会包含适配器路径；当 TAP 能识别具体问题时，还会在 `error.details.diagnostics` 中提供行级诊断。

### 管理命令 JSON 输出

```bash
# 诊断
tap doctor
# → { "ok": true, "checks": [...], "suggestions": [] }

# 浏览器生命周期
tap browser status
# → { "ok": true, "endpoint": "...", "browser": "Chrome/..." }

tap browser start
# → { "alreadyRunning": false, "endpoint": "...", "chrome": "...", "profile": "..." }

tap browser stop
# → { "stopped": true, "endpoint": "..." }

# 初始化
tap setup
# → { "directories": [...], "config": { "path": "...", "written": true }, ... }

# 适配器管理
tap adapter install github:example/tap-adapters
# → { "ok": true, "action": "install", "pack": {...}, "installed": [...], "overwritten": [], "target": "..." }

tap adapter list
# → { "packs": [...] }

tap adapter remove <pack-name>
# → { "ok": true, "action": "remove", "pack": "...", "removed": [...] }
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TAP_CDP_ENDPOINT` | `http://127.0.0.1:9222` | 浏览器适配器使用的 Chrome DevTools Protocol 端点 |
| `TAP_ADAPTERS_DIR` | _（无）_ | 额外的适配器搜索目录（优先于用户适配器） |
| `TAP_CHROME_PATH` | _（自动检测）_ | `tap browser start` 使用的 Chrome 可执行文件路径 |

### 适配器搜索顺序

设置 `TAP_ADAPTERS_DIR` 时：

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js`
2. `~/.tap/adapters/<site>/<command>.js`

未设置 `TAP_ADAPTERS_DIR` 时：

1. `~/.tap/adapters/<site>/<command>.js`

第一个匹配的文件优先生效。

---

## 适配器参考

### 文件结构

```js
// ~/.tap/adapters/<site>/<command>.js
export default {
  description: '在 help 中显示的简短描述。',
  args: [
    {
      name: 'limit',
      type: 'integer',
      default: 20,
      minimum: 1,
      maximum: 100,
      description: '最多返回多少条。',
    },
    {
      name: 'sort',
      enum: ['hot', 'new'],
      default: 'hot',
      description: '排序方式。',
    },
    {
      name: 'keyword',
      required: true,
      description: '搜索关键词。',
    },
  ],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      rank: {
        type: 'integer',
        description: 'One-based rank in the returned result set.',
      },
      title: {
        type: 'string',
        description: 'Item title.',
      },
    },
  },
  pipeline: [ /* 步骤数组 */ ],
};
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `description` | 否 | 在 `tap help <site> <command>` 中显示 |
| `args` | 否 | CLI 参数，支持默认值、说明和校验元数据 |
| `output.fields` | JSON 输出必填 | 机器可读字段契约，用于生成 JSON schema |
| `pipeline` | 执行数据命令时需要 | Pipeline 引擎按顺序执行的步骤数组 |

### 参数契约

Adapter args 既是文档，也是运行时校验。应声明足够的元数据，让 Agent 不需要猜测就能正确调用命令。

| 参数字段 | 说明 |
|----------|------|
| `name` | 不带 `--` 的 flag 名称 |
| `description` | 面向人和 Agent 的参数含义 |
| `required` | 为 `true` 时，缺失值会以退出码 2 失败 |
| `default` | pipeline 执行前应用的默认值 |
| `type` | `string`、`boolean`、`integer` 或 `number`；省略时从 `default` 推断 |
| `enum` | 允许值；非法值会在 adapter 运行前失败 |
| `minimum` / `maximum` | `integer` 和 `number` 参数的数值边界 |
| `format` / `examples` | 通过 `tap schema` 暴露的额外 schema 提示 |

执行适配器命令时，未知 flag、非法类型、枚举不匹配、数值越界、缺少必填参数都会在 stderr 输出结构化 JSON 错误，并给出可执行建议。

### JSON 输出契约

数据命令输出 JSON envelope：

```json
{
  "meta": {
    "site": "example",
    "command": "list",
    "resultType": "list",
    "generatedAt": "2026-05-01T12:00:00.000Z",
    "args": { "limit": 5 }
  },
  "schema": {
    "type": "array",
    "itemName": "item",
    "items": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Item title."
        }
      }
    }
  },
  "items": [
    { "title": "Example" }
  ]
}
```

Runtime 不会从 row key 推断字段含义。JSON 输出要求 adapter 显式声明 `output.fields`，并且 `items` 只包含 schema 声明过的字段。Pipeline 产出的额外字段会从 JSON 输出中丢弃。数据命令运行前会校验 `output.fields` 契约；格式错误的 pipeline 定义会在执行阶段失败。

### Pipeline 步骤

每个步骤是一个只含单个 key 的对象，key 名即操作类型。

#### Step Reference

| 步骤 | 参数 | 是否更新 `data` | 是否需要浏览器 | 说明 |
|------|------|----------------|----------------|------|
| `fetch` | URL 字符串或 `{ url, as? }` | 解析后的 JSON 响应 | 否 | 主机侧 HTTP GET。`as` 会把响应保存到 `state`。 |
| `browserFetch` | `{ url, as?, method?, headers?, body?, credentials? }` | 解析后的 JSON 响应 | 是 | 在页面上下文执行 `fetch()`。`credentials` 默认是 `include`。 |
| `navigate` | URL 字符串 | 否 | 是 | 打开页面并等待 load + SPA 稳定延迟。 |
| `evaluate` | JS 表达式字符串或 `{ code, as? }` | 返回值 | 是 | 在页面上下文执行。对象形式可以用 `as` 保存返回值。 |
| `intercept` | `{ capture, trigger?, timeout?, select?, as? }` | 捕获到的 JSON 响应 | 是 | 在触发动作后捕获匹配的 XHR/fetch 响应。 |
| `select` | 路径字符串或 `{ from?, path?, as? }` | 选中的值 | 否 | `from` 默认读取当前 `data`，也可读取命名状态或状态路径。 |
| `map` | `{ select?, ...fields }` | 映射后的对象数组 | 否 | 映射数组元素。`select` 是从当前 `data` 内联提取源路径。 |
| `mapOne` | `{ ...fields }` | 一个映射对象 | 否 | 映射当前值，主要用于 `foreach` 内部。 |
| `foreach` | `{ from?, as?, concurrency?, steps }` | 嵌套结果数组 | 取决于嵌套步骤 | 遍历数组并收集每个嵌套 pipeline 的结果。 |
| `filter` | JS 表达式字符串 | 过滤后的数组 | 否 | 表达式可使用 `item`、`index`、`args`、`data`、`state`。 |
| `sort` | 字段字符串或 `{ by, order? }` | 排序后的数组 | 否 | `order: 'desc'` 表示倒序。 |
| `limit` | 数字或模板字符串 | 截取后的数组 | 否 | 通常放在最后。 |

#### `fetch` — HTTP GET

```js
{ fetch: 'https://api.example.com/data' }
// 或带模板：
{ fetch: { url: 'https://api.example.com/search?q=${{ args.keyword }}' } }
// 保存结果供后续步骤使用：
{ fetch: { url: 'https://api.example.com/projects', as: 'projects' } }
```

返回解析后的 JSON，不需要浏览器。

#### `browserFetch` — 在浏览器上下文中 HTTP GET

```js
{ browserFetch: { url: '/api/feed', as: 'feed' } }
```

在当前浏览器页面中执行 `fetch()`，默认使用 `credentials: 'include'`。当 API 需要 Agent Chrome 登录态时，先 `navigate` 再使用这个步骤。

#### `navigate` — 在浏览器中打开 URL

```js
{ navigate: 'https://example.com' }
```

等待 `Page.loadEventFired` + 800ms SPA 初始化时间。需要 Chrome 开启远程调试。

#### `evaluate` — 在浏览器上下文中执行 JS

```js
{ evaluate: `document.title` }
{ evaluate: { code: `location.href`, as: 'currentUrl' } }
// 或异步：
{ evaluate: `(async () => {
  const res = await fetch('/api/data');
  return res.json();
})()` }
```

将返回值替换为新的 `data`，运行时拥有完整页面上下文（cookie、session）。需要用 `as` 保存结果时使用对象形式。

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
{ select: { from: 'projects', path: 'items', as: 'items' } }
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

使用 `{ from, path, as }` 可以从命名状态读取数据，并把选出的结果保存成另一个名字。`from` 可以是状态名，也可以是 `projects.items` 这样的状态路径。

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

#### `mapOne` — 转换单个值

```js
{ mapOne: {
  id: '${{ item.id }}',
  status: '${{ data.status }}',
}}
```

将当前值转换成一个对象。它主要用于 `foreach` 内部：`item` 是原始遍历项，`data` 是当前嵌套步骤的结果。

#### `foreach` — 遍历列表并执行步骤

```js
{
  foreach: {
    from: 'items',
    as: 'details',
    concurrency: 5,
    steps: [
      { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
      { mapOne: {
        id: '${{ item.id }}',
        title: '${{ item.title }}',
        status: '${{ data.status }}',
      }},
    ],
  },
}
```

从当前 `data` 或命名状态路径读取数组，对每个元素执行嵌套步骤，并把每个元素的最终结果收集成数组。嵌套步骤可以读取 `state`，但嵌套步骤内部的局部 `as` 不会写回共享状态；需要用 `foreach.as` 保存收集后的结果。

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
| `state` | 所有模板 | 通过 `as` 保存的命名状态 |
| `root` | `map` | 内联 select 前的原始数据 |

---

## 适配器模式

### 模式 A — 公开 JSON API

无需浏览器，直接 HTTP 请求。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'entry',
    fields: {
      title: {
        type: 'string',
        description: 'Entry title.',
      },
      score: {
        type: 'number',
        description: 'Entry score from the source API.',
      },
    },
  },
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

### 模式 C — 多请求 list-detail

先获取列表，再以受控并发拉取每个条目的详情，最后返回收集好的详情行。

```js
pipeline: [
  { fetch: { url: 'https://api.example.com/items', as: 'list' } },
  { select: { from: 'list', path: 'items', as: 'items' } },
  {
    foreach: {
      from: 'items',
      as: 'details',
      concurrency: 5,
      steps: [
        { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
        { mapOne: {
          title: '${{ item.title }}',
          status: '${{ data.status }}',
        }},
      ],
    },
  },
  { select: { from: 'details' } },
  { limit: '${{ args.limit }}' },
],
```

如果详情 API 需要浏览器 cookie，先 `navigate`，再把同样模式中的 `fetch` 换成 `browserFetch`。

### 模式 D — 拦截 XHR/fetch 请求

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

### 模式 E — DOM 提取

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

使用 `navigate`、`evaluate`、`browserFetch` 或 `intercept` 的适配器需要开启远程调试的 Agent Chrome 实例。推荐流程是：

```bash
tap setup
tap browser start
tap doctor
```

TAP 会自动扫描 pipeline 步骤判断是否需要浏览器，每次运行新建一个标签页，结束后自动关闭。

`tap browser start` 默认使用专用自动化 profile（`~/.chrome-automation-profile`），让 Agent 浏览器与日常 Chrome profile 分离。有头 Chrome 默认以最小化方式启动；如果希望正常打开窗口，使用 `tap browser start --foreground`，如果需要完全隐藏浏览器，使用 `tap browser start --headless`。只有某个适配器需要登录态时，才需要在这个 Agent Chrome profile 中登录目标网站一次。之后 TAP 会复用该 profile 的 cookie 和本地状态。TAP 每次运行会尽量创建后台标签页，并在结束后关闭。

---

## 用 AI 辅助构建适配器

TAP 附带一个 AI assistant skill（`tap-adapter-author`），引导你完成从站点侦察到 `tap <site> <command>` 输出正确数据的完整闭环。

### 前置准备

按你使用的 assistant 显式安装 skill：

```bash
tap skill install claude-code
tap skill install codex
```

如果需要自定义 skills 目录，使用 `--target <dir>`；如果目标 skill 已存在并需要覆盖文件，使用 `--force`：

```bash
tap skill install codex --target ~/.codex/skills
tap skill install claude-code --force
```

需要登录态的浏览器适配器（Pattern B/D/E），在使用 skill 前需要先启动 Chrome 并登录目标站点：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=~/.chrome-automation-profile \
  --no-first-run \
  --no-default-browser-check
```

skill 复用已登录的 Agent Chrome profile，不会自动处理认证。这个 profile 与日常 Chrome 是刻意分离的。

### 工作流

调用 skill，描述你想抓取的内容：

```
/tap-adapter-author

我想抓取 Hacker News 的热门帖子。
```

skill 会引导你完成：

1. **判断获取模式** — 公开 API、需要登录、拦截 XHR 还是 DOM 抓取
2. **验证端点** — 确认 API 返回预期数据
3. **解码字段结构** — 将响应字段映射到经过 schema 确认的输出字段
4. **确认 schema** — 核对字段名、raw path、类型、说明、单位、格式和样例
5. **组装 pipeline** — 生成包含 `output.fields` 的完整适配器文件
6. **安装适配器** — 写入 `~/.tap/adapters/<site>/<command>.js`
7. **验证** — 运行 `tap <site> <command>` 确认 envelope schema 和 items

### 决策树

```
想抓什么数据？
  │
  ├─ 公开 JSON API（curl 可直接访问）      → 模式 A：直接 fetch
  ├─ 需要浏览器登录/Session              → 模式 B：navigate + browserFetch
  ├─ list-detail 或关联 enrichment 请求  → 模式 C：as + from + foreach
  ├─ XHR 隐藏在页面交互后               → 模式 D：intercept
  └─ 数据只在 DOM 里                    → 模式 E：navigate + evaluate(DOM)
```

每种失败情形（403、空数组、字段缺失等）都有对应的降级路径。

---

## 示例

TAP 默认不再内置具体站点示例适配器。使用 `tap-adapter-author` 在 `~/.tap/adapters/<site>/<command>.js` 下创建经过 schema 确认的适配器后再运行：

```bash
tap <site> <command> --limit 5
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
│   ├── adapter-manager.js  # 适配器包安装/列表/移除
│   ├── schema.js           # 机器可读命令 schema 生成
│   ├── output.js           # JSON 格式化输出
│   ├── help.js             # Help 文本生成
│   ├── browser.js          # Agent Chrome 生命周期管理
│   ├── doctor.js           # 本地环境诊断
│   ├── setup.js            # TAP 初始化
│   ├── skills.js           # AI skill 安装
│   ├── config.js           # 配置文件读取
│   └── bundled-skills.js   # 编译二进制内嵌的 skill 资源
├── skills/                 # 内置 assistant skills 的源码副本
│   └── tap-adapter-author/
└── npm/
    ├── run.js              # npm bin wrapper，选择平台包
    ├── install.js          # 本地开发时设置可执行权限
    ├── platforms/          # 生成的 optional 二进制平台包
    │   ├── tap-darwin-arm64/
    │   ├── tap-darwin-x64/
    │   └── tap-linux-x64/
    └── skills/             # npm 包中的内置 assistant skills 副本
        └── tap-adapter-author/
```

用户适配器存放于 `~/.tap/adapters/`。开发或其他工作流需要指定自定义适配器目录时，使用 `TAP_ADAPTERS_DIR`。

---

## 依赖

| 包 | 用途 |
|----|------|
| `ws` ^8.0.0 | CDP 通信的 WebSocket 客户端 |

运行时：[Bun](https://bun.sh)（构建与执行）。编译后的二进制文件自包含，运行时不依赖 Bun。
