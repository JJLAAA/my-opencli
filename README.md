# TAP

TAP 是一个面向 Agent 的轻量级 CLI 数据访问层。它把业务系统、网页后台、无 API 平台里的数据访问过程，封装成稳定、可验证、机器可读的命令：

```bash
tap <site> <command> [--key value]
```

你可以把 TAP 理解成一层“给 Agent 用的只读业务数据接口”。人负责确认数据源、字段和访问方式；TAP 负责把这些约定固化为 CLI；Agent 在工作流里通过 `tap schema` 发现契约，再通过 `tap <site> <command>` 获取 JSON 数据。

TAP 是 [opencli](https://github.com/jackwener/opencli) 的轻量版本。核心区别是浏览器隔离：TAP 将 Chrome 视为专供 Agent 使用的操作平台，而不是通过 daemon + extension 控制用户日常使用的 Chrome。

长期方向见：[TAP 长期规划：面向 Agent 的只读业务数据接入层](docs/readonly-data-access-roadmap.md)。

---

## 1. 为什么需要 TAP

很多团队的真实业务数据已经存在于内部后台、SaaS、网页控制台或第三方平台中，但这些系统通常不适合 Agent 直接消费：

- UI 复杂，Agent 每次临时点页面不稳定。
- 登录态、Cookie、分页、XHR、字段映射容易散落在一次性脚本里。
- 没有明确 schema，Agent 不知道字段含义、类型和可选参数。
- 错误不可机器判断，自动化流程无法区分“参数错了”“浏览器没开”“上游失败”“适配器坏了”。

TAP 解决的是这个重复性问题：把一个已知数据源的访问路径沉淀成命令，把字段和参数沉淀成契约，把输出和错误沉淀成结构化 JSON。

适合 TAP 的场景：

| 场景 | 用 TAP？ | 原因 |
|------|---------|------|
| 每天从内部后台拉取结构化数据 | 是 | 固定数据源、固定 schema、反复访问 |
| 查询没有 API 的业务系统 | 是 | 可用浏览器登录态、XHR 或 DOM 提取补齐 |
| 给 Agent 工作流提供业务上下文 | 是 | 可通过 `tap schema` 和 JSON 输出稳定集成 |
| 跨任意网站做 deep research | 否 | 更适合 LLM 原生 web browse |
| 解读或总结某篇文章 | 否 | 更适合 LLM 原生 web browse |
| 一次性数据查询且 schema 不固定 | 否 | TAP 的适配器成本不值得 |

TAP 的成本在前期：人类需要编写适配器、约定数据契约、完成安装。这个投入只有在同样的访问模式会反复出现时才值得。

---

## 2. TAP 的核心思想

### 2.1 TAP 是数据访问层，不是触发型 Skill

TAP 不提供一个启发式的“使用 TAP”skill，让 Agent 自己猜什么时候该调用 TAP。它的使用流程是两阶段、由人类发起的：

1. **人类使用 `tap-adapter-author` 表达接入意图**  
   描述要访问的数据源。Skill 引导完成站点侦察、端点验证、schema 确认、pipeline 组装，并把适配器安装到 `~/.tap/adapters/<site>/<command>.js`。

2. **把适配器声明进具体工作流**  
   从这一步开始，Agent 已经处于一个 TAP-enabled workflow 中。它通过 `tap schema` 发现命令契约，然后调用 `tap <site> <command>`，不需要再判断 TAP 是否是合适工具。

因此，`tap-adapter-author` 是人类侧入口；`tap` CLI 是 Agent 侧执行接口。二者职责分离，不重叠。

### 2.2 TAP 分离“抓什么”和“怎么抓”

TAP 的核心设计是把数据管道声明在适配器里，把执行能力放在核心引擎里：

- **适配器**：位于 `~/.tap/adapters/<site>/<command>.js`，声明参数、输出字段和 pipeline。
- **核心引擎**：加载适配器，校验参数和输出契约，执行 pipeline，管理浏览器会话，格式化 JSON 输出。

执行链路如下：

```text
CLI 参数
  └─ 从适配器目录加载 <site>/<command>.js
       └─ 校验 args、output.fields、--format、--fields
            └─ 判断 pipeline 是否需要浏览器
                 └─ executePipeline(steps, args, cdpSession?)
                      └─ printOutput(data, "json", { adapter, site, command, args, fields })
```

Pipeline 按顺序执行。每个步骤接收上一步输出作为 `data`，产生新的 `data`。步骤也可以通过 `as` 把中间结果保存到 `state`，后续用 `from` 读取，这样多请求编排不用写成一大段脚本。

### 2.3 TAP 对 Agent 友好的契约

TAP 面向 Agent 的关键不是“能抓到数据”，而是“能稳定集成”：

- `tap schema` 输出机器可读命令契约。
- 数据命令输出包含 `meta`、`schema`、`items` 的 JSON envelope。
- 参数类型、默认值、必填、枚举和数值范围在运行前校验。
- 错误统一以 JSON 写到 stderr，并带有错误码、建议、是否可重试。
- 退出码区分使用错误、配置错误、浏览器错误、上游错误和适配器契约错误。

---

## 3. 浏览器隔离模型

OpenCLI 优先复用用户正在使用的 Chrome，通过本地 daemon 和 Browser Bridge extension 控制日常浏览器，从而复用日常 profile 里的 cookie 和标签页。

TAP 刻意采用另一种模型：Chrome 是独立的 **Agent 操作平台**。浏览器适配器连接到显式启动的 remote-debugging Chrome，通常使用专用 profile：

```text
~/.chrome-automation-profile
```

你只需要在这个 Agent profile 里登录目标网站一次，之后 TAP 会复用这个 profile 的 cookie、localStorage 和登录态。

这种模型的收益：

- Agent 的误操作限制在 automation profile 内，不影响人的日常浏览器。
- Cookie、localStorage、扩展和标签页状态更可控，更容易复现问题。
- 不需要浏览器扩展，也不需要常驻 daemon。
- 代价是首次需要显式初始化：启动 Agent Chrome，并在其中完成登录。

---

## 4. 安装与初始化

### 4.1 npm 安装（推荐）

```bash
npm install -g @leolee812/tap
tap setup
```

npm 包是一个轻量 wrapper，会自动拉取当前 OS/CPU 对应的预编译二进制文件。使用者不需要安装 Bun，也不需要本地构建。

`tap setup` 会创建：

- `~/.tap/`
- `~/.tap/adapters/`
- `~/.tap/logs/`
- `~/.tap/config.json`

已有配置默认保留；只有传入 `--force` 才会覆盖：

```bash
tap setup --force
```

### 4.2 源码构建（贡献者）

前置依赖：[Bun](https://bun.sh)。

```bash
git clone <repo>
cd tap
bun install
bun run build
mv tap /usr/local/bin/tap
tap setup
```

源码开发时也可以直接运行：

```bash
bun run bin/cli.js <site> <command> --limit 3
```

### 4.3 安装范围

安装 TAP 二进制只安装 CLI runtime：命令解析、pipeline 执行、schema 输出、浏览器控制和本地配置。

TAP 不会默认安装具体站点适配器，也不会自动把 assistant 指令安装进 AI 工具。

如果你想直接获得某个数据源的现成命令，安装适配器包：

```bash
tap adapter install github:<owner>/<repo>
tap adapter install url:<https-url-to-zip-or-tarball>
tap adapter install git:<git-url>
tap adapter install git:<git-url> --force
```

如果你想让 AI coding assistant 帮你编写新适配器，安装 assistant skill：

```bash
tap skill install codex
tap skill install claude-code
```

运行已有适配器不需要 skill。Skill 的作用是教 assistant 按 TAP 工作流编写适配器，并把结果写入本地适配器目录。

---

## 5. 快速使用

### 5.1 查看版本、帮助和本地状态

```bash
# 查看版本
tap version
tap --version
tap -v

# 查看全局帮助
tap help

# 初始化或刷新本地 TAP 文件
tap setup
tap setup --force

# 诊断本地环境
tap doctor
```

### 5.2 发现命令

```bash
# 列出所有站点和命令
tap help

# 安装适配器后查看某个站点的命令
tap help <site>

# 查看某个命令的参数说明
tap help <site> <command>
tap <site> <command> --help
```

### 5.3 执行适配器命令

```bash
tap <site> <command>
tap <site> <command> --limit 10
tap <site> <command> --format json
tap <site> <command> --fields title,url,score
```

数据命令只支持 JSON 输出。`--format json` 可显式传入，但默认就是 JSON。

### 5.4 给 Agent 发现契约

Agent 不应该解析 help 文本，而应该使用 `tap schema`：

```bash
# 列出适配器命令和管理命令
tap schema

# 列出某个站点的所有命令
tap schema <site>

# 查看某个适配器命令
tap schema <site> <command>

# 查看管理命令
tap schema version
tap schema doctor
tap schema setup
tap schema browser status
tap schema browser start
tap schema browser stop
tap schema browser restart
tap schema adapter install
tap schema adapter list
tap schema adapter remove
tap schema skill install
```

`tap schema` 返回 JSON，包含 `meta.schemaVersion` 和 `commands`。每个命令都带有 `schemaCommand`，指向命令级 schema。

`tap schema <site>` 返回站点级 schema，`meta.kind` 为 `"site"`。如果某个适配器无法加载，对应命令条目会包含 `loadError`。

未知站点会返回结构化使用错误：

```json
{
  "error": {
    "code": "unknown_site",
    "message": "Unknown site: example",
    "suggestion": "Run: tap schema",
    "retryable": false,
    "details": { "site": "example" }
  }
}
```

---

## 6. 输出、错误和退出码

### 6.1 JSON 输出格式

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

Runtime 不会从 row key 推断字段含义。适配器必须显式声明 `output.fields`，JSON 输出只包含 schema 声明过的字段。Pipeline 产出的额外字段会被丢弃。

### 6.2 `--fields`

`--fields` 接受逗号分隔字段名：

```bash
tap <site> <command> --fields title,url
```

行为：

- 字段必须来自适配器的 `output.fields`。
- 未知字段不会让命令失败，而是写入 `meta.warnings`。
- 响应中的 `schema.items.properties` 只包含实际返回字段。
- 适配器契约诊断始终按完整声明 schema 评估，不受 `--fields` 影响。
- 如果没有任何有效字段匹配，会回退到完整 schema，并给出 warning。

### 6.3 结构化错误

CLI 失败会在 stderr 输出 JSON：

```json
{
  "error": {
    "code": "missing_required_arg",
    "message": "Missing required argument: --keyword",
    "suggestion": "Run: tap example search --help",
    "retryable": false,
    "details": {}
  }
}
```

适配器加载失败会包含适配器路径；当 TAP 能识别具体问题时，还会在 `error.details.diagnostics` 中提供行级诊断。

### 6.4 退出码

| 码 | 名称 | 含义 | Agent 应对 |
|----|------|------|------------|
| 0 | success | 命令成功 | 解析 stdout |
| 1 | general_error | 意外错误 | 检查错误，通常应停止 |
| 2 | usage_error | 调用错误、未知选项、缺少必需参数、不支持的格式 | 修正命令 |
| 3 | config_error | TAP 配置缺失或无效 | 运行 `tap setup` |
| 4 | browser_error | Chrome/CDP 不可用 | 运行 `tap browser status` 或 `tap browser start` |
| 5 | upstream_error | 网络或远程 API 失败 | `retryable: true` 时可重试 |
| 6 | adapter_contract_error / adapter_load_error | 适配器输出 schema 无效，或适配器文件无法加载 | 修复适配器 |

适配器管理命令使用退出码 `2` 表示用法错误，退出码 `5` 表示下载或 clone 失败，退出码 `6` 表示包契约错误或文件冲突。

### 6.5 管理命令 JSON 输出

```bash
tap doctor
# => { "ok": true, "checks": [...], "suggestions": [] }

tap browser status
# => { "ok": true, "endpoint": "...", "browser": "Chrome/..." }

tap browser start
# => { "alreadyRunning": false, "endpoint": "...", "chrome": "...", "profile": "..." }

tap browser stop
# => { "stopped": true, "endpoint": "..." }

tap browser restart
# => { "stopped": {...}, "started": {...} }

tap setup
# => { "directories": [...], "config": { "path": "...", "written": true }, ... }

tap adapter install github:example/tap-adapters
# => { "ok": true, "action": "install", "pack": {...}, "installed": [...], "overwritten": [], "target": "..." }

tap adapter list
# => { "packs": [...] }

tap adapter remove <pack-name>
# => { "ok": true, "action": "remove", "pack": "...", "removed": [...] }
```

Help 命令有意输出人类可读文本，不输出 JSON。

---

## 7. 浏览器运行时

使用 `navigate`、`evaluate`、`browserFetch` 或 `intercept` 的适配器需要运行中的 Agent Chrome。推荐流程：

```bash
tap setup
tap browser start
tap doctor
```

浏览器命令：

```bash
tap browser status
tap browser start
tap browser start --foreground
tap browser start --headless
tap browser stop
tap browser restart
tap browser restart --foreground
tap browser restart --headless
```

`tap browser start` 默认使用专用自动化 profile（`~/.chrome-automation-profile`），有头 Chrome 默认最小化启动以减少抢焦点。使用 `--foreground` 可正常打开窗口，使用 `--headless` 可隐藏浏览器。

如果日常 Chrome 重启后，Agent Chrome 开始接收系统外链，先启动日常 Chrome，再运行：

```bash
tap browser restart
```

TAP 会扫描适配器 pipeline 判断是否需要浏览器。需要浏览器时，会创建一个 CDP session；支持时每次运行打开一个后台标签页，并在结束后关闭。

---

## 8. 适配器目录与环境变量

### 8.1 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TAP_CDP_ENDPOINT` | `http://127.0.0.1:9222` | 浏览器适配器使用的 Chrome DevTools Protocol 端点 |
| `TAP_ADAPTERS_DIR` | 无 | 额外适配器搜索目录，优先于用户适配器 |
| `TAP_CHROME_PATH` | 自动检测 | `tap browser start` 和 `tap browser restart` 使用的 Chrome 可执行文件路径 |

### 8.2 适配器搜索顺序

设置 `TAP_ADAPTERS_DIR` 时：

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js`
2. `~/.tap/adapters/<site>/<command>.js`

未设置 `TAP_ADAPTERS_DIR` 时：

1. `~/.tap/adapters/<site>/<command>.js`

第一个匹配的文件生效。

---

## 9. 适配器结构

适配器是一个 ESM JavaScript 文件，默认导出一个对象：

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
  examples: [
    {
      description: '搜索最近条目',
      args: { keyword: 'tap', limit: 5 },
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
  pipeline: [
    /* steps */
  ],
};
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `description` | 否 | 在 `tap help <site> <command>` 和 `tap schema` 中显示 |
| `args` | 否 | CLI 参数，支持默认值、说明和校验元数据 |
| `examples` | 否 | 在 `tap help <site> <command>` 中显示的示例，数组项为 `{ description?, args }` |
| `output.fields` | JSON 输出必填 | 机器可读字段契约，用于生成 JSON schema |
| `pipeline` | 执行数据命令时需要 | Pipeline 引擎按顺序执行的步骤数组 |

### 9.1 参数契约

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

Boolean 参数支持：

```bash
tap <site> <command> --flag
tap <site> <command> --flag true
tap <site> <command> --flag false
```

---

## 10. Pipeline 步骤

每个步骤是一个只含单个 key 的对象，key 名就是操作类型。

| 步骤 | 参数 | 是否更新 `data` | 是否需要浏览器 | 说明 |
|------|------|----------------|----------------|------|
| `fetch` | URL 字符串或 `{ url, as? }` | 是，解析后的 JSON 响应 | 否 | 主机侧 HTTP GET。`as` 会把响应保存到 `state`。 |
| `browserFetch` | `{ url, as?, method?, headers?, body?, credentials? }` | 是，解析后的 JSON 响应 | 是 | 在页面上下文执行 `fetch()`。`credentials` 默认是 `include`。 |
| `navigate` | URL 字符串 | 否 | 是 | 打开页面并等待 load + SPA 稳定延迟。 |
| `evaluate` | JS 表达式字符串或 `{ code, as? }` | 是，返回值 | 是 | 在页面上下文执行。对象形式可以用 `as` 保存返回值。 |
| `intercept` | `{ capture, trigger?, timeout?, select?, as? }` | 是，捕获到的 JSON 响应 | 是 | 在触发动作后捕获匹配的 XHR/fetch 响应。 |
| `select` | 路径字符串或 `{ from?, path?, as? }` | 是，选中的值 | 否 | `from` 默认读取当前 `data`，也可读取命名状态或状态路径。 |
| `map` | `{ select?, ...fields }` | 是，映射后的对象数组 | 否 | 映射数组元素。`select` 是从当前 `data` 内联提取源路径。 |
| `mapOne` | `{ ...fields }` | 是，一个映射对象 | 否 | 映射当前值，主要用于 `foreach` 内部。 |
| `foreach` | `{ from?, as?, concurrency?, steps }` | 是，嵌套结果数组 | 取决于嵌套步骤 | 遍历数组并收集每个嵌套 pipeline 的结果。 |
| `filter` | JS 表达式字符串 | 是，过滤后的数组 | 否 | 表达式可使用 `item`、`index`、`args`、`data`、`state`。 |
| `sort` | 字段字符串或 `{ by, order? }` | 是，排序后的数组 | 否 | `order: 'desc'` 表示倒序。 |
| `limit` | 数字或模板字符串 | 是，截取后的数组 | 否 | 通常放在最后。 |

### 10.1 `fetch`

```js
{ fetch: 'https://api.example.com/data' }
{ fetch: { url: 'https://api.example.com/search?q=${{ args.keyword }}' } }
{ fetch: { url: 'https://api.example.com/projects', as: 'projects' } }
```

返回解析后的 JSON，不需要浏览器。

### 10.2 `browserFetch`

```js
{ browserFetch: { url: '/api/feed', as: 'feed' } }
```

在当前浏览器页面中执行 `fetch()`，默认使用 `credentials: 'include'`。当 API 需要 Agent Chrome 登录态时，先 `navigate` 再使用这个步骤。

### 10.3 `navigate`

```js
{ navigate: 'https://example.com' }
```

打开页面，等待 `Page.loadEventFired` 和 SPA 初始化延迟。需要 Chrome 开启远程调试。

### 10.4 `evaluate`

```js
{ evaluate: 'document.title' }
{ evaluate: { code: 'location.href', as: 'currentUrl' } }
{ evaluate: `(async () => {
  const res = await fetch('/api/data');
  return res.json();
})()` }
```

返回值会替换为新的 `data`。运行时拥有完整页面上下文，包括 cookie 和 session。需要保存结果时使用对象形式的 `as`。

在 JavaScript 模板字符串里写 TAP 模板时要转义 `$`，否则 JS 会先解析：

```js
{ evaluate: `document.body.innerText.includes('\${{ args.keyword }}')` }
```

### 10.5 `intercept`

```js
{
  intercept: {
    capture: 'api/timeline',
    trigger: 'navigate:https://example.com/feed',
    timeout: 8,
    select: 'data.items',
  },
}
```

通过在页面中注入代码拦截 `window.fetch` 和 `XMLHttpRequest`。如果只捕获到一个响应，`data` 是该响应；捕获到多个响应，`data` 是响应数组；没有捕获到响应时保留原 `data`。

Trigger 支持：

| 前缀 | 示例 |
|------|------|
| `navigate:` | `navigate:https://example.com` |
| `evaluate:` | `evaluate:document.querySelector('.load-more').click()` |
| `click:` | `click:.load-more-btn` |
| `scroll` | `scroll`、`scroll:down`、`scroll:up` |

### 10.6 `select`

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

路径不存在时返回 `null`。使用 `{ from, path, as }` 可以从命名状态读取数据，并把选出的结果保存成另一个名字。`from` 可以是状态名，也可以是 `projects.items` 这样的状态路径。

### 10.7 `map`

```js
{
  map: {
    rank: '${{ index + 1 }}',
    title: '${{ item.title }}',
    author: '${{ item.owner.name }}',
    play: '${{ item.stat.view }}',
  },
}
```

支持内联 `select`：

```js
{
  map: {
    select: 'data.list',
    title: '${{ item.title }}',
  },
}
```

### 10.8 `mapOne`

```js
{
  mapOne: {
    id: '${{ item.id }}',
    status: '${{ data.status }}',
  },
}
```

将当前值转换成一个对象。它主要用于 `foreach` 内部：`item` 是原始遍历项，`data` 是当前嵌套步骤的结果。

### 10.9 `foreach`

```js
{
  foreach: {
    from: 'items',
    as: 'details',
    concurrency: 5,
    steps: [
      { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
      {
        mapOne: {
          id: '${{ item.id }}',
          title: '${{ item.title }}',
          status: '${{ data.status }}',
        },
      },
    ],
  },
}
```

从当前 `data` 或命名状态路径读取数组，对每个元素执行嵌套步骤，并把每个元素的最终结果收集成数组。默认并发为 4；`concurrency` 至少为 1。嵌套步骤可以读取 `state`，但嵌套步骤内部的局部 `as` 不会写回共享状态；需要用 `foreach.as` 保存收集后的结果。

### 10.10 `filter`、`sort`、`limit`

```js
{ filter: 'item.play > 10000' }
{ filter: 'index < 5' }

{ sort: { by: 'play', order: 'desc' } }
{ sort: 'title' }

{ limit: 20 }
{ limit: '${{ args.limit }}' }
```

`sort` 使用字段值的字符串比较，并启用 numeric 排序。

### 10.11 模板表达式

模板使用 `${{ expression }}` 语法。可用上下文变量：

| 变量 | 可用步骤 | 说明 |
|------|---------|------|
| `item` | `map`、`filter`、`foreach` 子步骤 | 当前数组元素 |
| `index` | `map`、`filter`、`foreach` 子步骤 | 从 0 开始的索引 |
| `args` | 所有步骤 | 解析后的 CLI 参数，包含默认值 |
| `data` | 所有步骤 | 当前 pipeline 数据 |
| `state` | 所有模板 | 通过 `as` 保存的命名状态 |
| `root` | `map` | 内联 select 前的原始数据 |

---

## 11. 常见适配器模式

### 模式 A：公开 JSON API

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

### 模式 B：需要登录态的 API

先 `navigate` 建立会话，再在浏览器上下文中请求。

```js
pipeline: [
  { navigate: 'https://example.com' },
  { browserFetch: { url: '/api/feed' } },
  { select: 'data.items' },
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

也可以用 `evaluate` 手写页面上下文逻辑：

```js
pipeline: [
  { navigate: 'https://example.com' },
  {
    evaluate: `(async () => {
      const res = await fetch('/api/feed', { credentials: 'include' });
      return res.json();
    })()`,
  },
  { select: 'data.items' },
  { map: { title: '${{ item.title }}' } },
],
```

### 模式 C：多请求 list-detail

先获取列表，再以受控并发拉取每个条目的详情。

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
        {
          mapOne: {
            title: '${{ item.title }}',
            status: '${{ data.status }}',
          },
        },
      ],
    },
  },
  { select: { from: 'details' } },
  { limit: '${{ args.limit }}' },
],
```

如果详情 API 需要浏览器 cookie，先 `navigate`，再把同样模式中的 `fetch` 换成 `browserFetch`。

### 模式 D：拦截 XHR/fetch

捕获页面交互触发的 API 调用。

```js
pipeline: [
  {
    intercept: {
      capture: '/api/timeline',
      trigger: 'navigate:https://example.com/home',
      timeout: 10,
      select: 'data',
    },
  },
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### 模式 E：DOM 提取

直接从渲染后的 HTML 中抓取数据。

```js
pipeline: [
  { navigate: 'https://example.com/ranking' },
  {
    evaluate: `
      [...document.querySelectorAll('.item')].map(el => ({
        title: el.querySelector('.title')?.textContent?.trim(),
        link: el.querySelector('a')?.href,
      }))
    `,
  },
  { map: { rank: '${{ index + 1 }}', title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

---

## 12. 用 AI 辅助构建适配器

TAP 附带一个 AI assistant skill：`tap-adapter-author`。它会引导你从站点侦察走到可运行的 `tap <site> <command>` 输出。

### 12.1 安装 Skill

```bash
tap skill install claude-code
tap skill install codex
```

自定义 skills 目录：

```bash
tap skill install codex --target ~/.codex/skills
```

覆盖已有 skill：

```bash
tap skill install claude-code --force
```

### 12.2 浏览器登录准备

需要登录态的浏览器适配器，在使用 skill 前先启动 Agent Chrome 并登录目标站点：

```bash
tap browser start --foreground
```

也可以手动启动 Chrome：

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=~/.chrome-automation-profile \
  --no-first-run \
  --no-default-browser-check
```

Skill 复用已登录的 Agent Chrome profile，不会自动处理认证。

### 12.3 工作流

调用 skill 后描述目标：

```text
/tap-adapter-author

我想抓取 Hacker News 的热门帖子。
```

Skill 会引导完成：

1. 判断获取模式：公开 API、需要登录、list-detail、拦截 XHR 或 DOM 抓取。
2. 验证端点：确认 API 或页面能返回预期数据。
3. 解码字段结构：把响应字段映射到 schema 字段。
4. 确认 schema：核对字段名、raw path、类型、说明、单位、格式和样例。
5. 组装 pipeline：生成包含 `output.fields` 的完整适配器。
6. 安装适配器：写入 `~/.tap/adapters/<site>/<command>.js`。
7. 验证：运行命令并确认 envelope schema 和 items。

决策树：

```text
想抓什么数据？
  │
  ├─ 公开 JSON API（curl 可直接访问）      → 模式 A：直接 fetch
  ├─ 需要浏览器登录/Session              → 模式 B：navigate + browserFetch
  ├─ list-detail 或关联 enrichment 请求  → 模式 C：as + from + foreach
  ├─ XHR 隐藏在页面交互后                → 模式 D：intercept
  └─ 数据只在 DOM 里                     → 模式 E：navigate + evaluate(DOM)
```

TAP 默认不内置具体站点示例适配器。使用 `tap-adapter-author` 创建经过 schema 确认的适配器后再运行：

```bash
tap <site> <command> --limit 5
```

---

## 13. 项目结构

```text
tap/
├── bin/cli.js              # 入口，委托给 src/cli.js
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

## 14. 依赖与运行时

| 包 | 用途 |
|----|------|
| `ws` ^8.0.0 | CDP 通信的 WebSocket 客户端 |

源码运行和构建使用 Bun。编译后的二进制文件自包含，运行时不依赖 Bun。
