# 确定性 CLI：把 Skill 沉淀为零成本命令

## 设计背景

### 问题的起点：OpenCLI 的适配器思想

[OpenCLI](https://github.com/jackwener/opencli) 是一个把网站、Electron 应用、本地工具统一抽象为 CLI 命令的框架。它的核心洞察是：

> 网站的 **内部 JSON API**（给自己前端用的）远比 HTML 结构稳定。把"导航到站点 → 借用登录态调内部 API → 变换数据"这个流程固化成一段声明式配置，就能得到确定性的 CLI 命令。

适配器的本质是一个声明式 pipeline：

```js
pipeline: [
  { navigate: 'https://www.bilibili.com' },         // 建立 Cookie 上下文
  { evaluate: `fetch('https://api.bilibili.com/...', {
      credentials: 'include'                         // 借用登录态
  }).then(r => r.json())` },
  { map: { rank: '${{ index+1 }}', title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
]
```

适配器一旦写好，执行时完全不需要 LLM：CLI → CDP → 浏览器内 fetch → JSON 变换 → 输出。

### OpenCLI 架构的问题

OpenCLI 默认通过 **Chrome 扩展 + 本地 daemon** 连接浏览器：

```
CLI → daemon (localhost:19825) → Browser Bridge 扩展 → 已登录的 Chrome
```

这套架构的目的是连接用户**已经在跑的、日常使用的** Chrome，无需重启。代价是：
- 必须安装 Chrome 扩展
- 必须运行 daemon 进程
- 即使设置了 `OPENCLI_CDP_ENDPOINT`，网站适配器仍然强制走 daemon 路径（源码中 `getBrowserFactory` 对非 Electron 站点永远返回 `BrowserBridge`，后者无视 CDP 环境变量）

### 更简洁的替代方案

Chrome 支持用 `--user-data-dir` 持久化 profile：

```bash
google-chrome \
  --user-data-dir=$HOME/.chrome-automation-profile \
  --remote-debugging-port=9222
```

- `--user-data-dir`：把 Cookie、Session、localStorage 写到磁盘，重启后登录态完整恢复
- `--remote-debugging-port`：暴露 CDP WebSocket 端口，外部进程可直接连接

人工登录一次后，后续每次以相同参数启动 Chrome，登录态自动恢复。不需要扩展，不需要 daemon，直接 CDP 直连。

### 两阶段模型

这套方案体现了一个更通用的设计哲学：

```
阶段一（一次性，有 LLM）：用 AI Skill 探索站点、发现 API、写适配器
        ↓ 固化为代码
阶段二（无限次，无 LLM）：纯代码执行，零 token 成本，确定性输出
```

Skill 是探索工具，适配器是沉淀结果。适配器把 LLM 踢出了执行路径。

---

## 架构设计

### 核心组件

```
my-cli/
├── adapters/              # 适配器目录，每个文件是一个命令
│   └── bilibili/
│       └── hot.js
├── src/
│   ├── cdp.js             # CDP 会话：连接、导航、执行 JS、关闭 tab
│   ├── executor.js        # Pipeline 执行器
│   └── output.js          # 输出格式化（table / json / csv）
├── bin/
│   └── cli.js             # CLI 入口
└── package.json
```

### 执行流程

```
mycli bilibili hot --limit 5
         │
         ▼
  bin/cli.js 解析命令和参数
         │
         ▼
  加载 adapters/bilibili/hot.js
         │
         ├─ pipeline 含 navigate/evaluate？
         │      是 ↓                  否 ↓
         │  openSession()          直接执行 fetch steps
         │  创建新 tab
         │
         ▼
  executor.js 顺序执行 pipeline steps
         │
         ▼
  output.js 格式化输出
         │
         ▼
  关闭临时 tab，退出
```

### 两类适配器

| 类型 | pipeline 包含 | 是否需要浏览器 | 典型场景 |
|------|--------------|--------------|---------|
| Public | `fetch` | 否 | HackerNews、公开 API |
| Browser | `navigate` + `evaluate` | 是 | B站、Reddit、小红书 |

`navigate` 的作用不是解析页面，而是让浏览器建立该域名的 Cookie 上下文。`evaluate` 在浏览器内部执行 `fetch + credentials: 'include'`，借用登录态调平台内部 JSON API。

---

## 完整实现

### `package.json`

```json
{
  "name": "my-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "mycli": "bin/cli.js" },
  "dependencies": {
    "ws": "^8.0.0"
  }
}
```

唯一外部依赖是 `ws`（WebSocket 客户端）。如果使用 Bun 运行，连这个依赖也不需要。

### `src/cdp.js`

```js
import { WebSocket } from 'ws';
import { request } from 'node:http';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    request(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject).end();
  });
}

class CDPSession {
  constructor(wsUrl) {
    this._wsUrl = wsUrl;
    this._id = 0;
    this._pending = new Map();
    this._handlers = [];
  }

  async connect() {
    this._ws = new WebSocket(this._wsUrl);
    await new Promise((res, rej) => {
      this._ws.once('open', res);
      this._ws.once('error', rej);
    });
    this._ws.on('message', raw => {
      const msg = JSON.parse(raw);
      if (msg.id != null && this._pending.has(msg.id)) {
        const { resolve, reject } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
      this._handlers.forEach(h => h(msg));
    });
    return this;
  }

  send(method, params = {}) {
    const id = ++this._id;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(eventMethod, fn) {
    const handler = msg => {
      if (msg.method === eventMethod) {
        this._handlers = this._handlers.filter(h => h !== handler);
        fn(msg);
      }
    };
    this._handlers.push(handler);
  }

  async navigate(url) {
    await this.send('Page.enable');
    const loaded = new Promise(resolve => this.once('Page.loadEventFired', resolve));
    await this.send('Page.navigate', { url });
    await loaded;
    await new Promise(r => setTimeout(r, 300)); // 等待 JS 初始化
  }

  async evaluate(code) {
    const result = await this.send('Runtime.evaluate', {
      expression: code,
      awaitPromise: true,
      returnByValue: true,
      timeout: 30000,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed');
    }
    return result.result?.value;
  }

  close() { this._ws?.close(); }
}

export async function openSession() {
  const base = (process.env.OPENCLI_CDP_ENDPOINT ?? 'http://localhost:9222').replace(/\/$/, '');
  // 创建新的空白 tab，不干扰用户现有页面
  const target = await httpGet(`${base}/json/new`);
  const session = new CDPSession(target.webSocketDebuggerUrl);
  await session.connect();
  return { session, targetId: target.id, base };
}

export async function closeTab(base, targetId) {
  try { await httpGet(`${base}/json/close/${targetId}`); } catch {}
}
```

**设计说明**：每次执行开一个新的空白 tab，执行完毕后关闭，不干扰用户正在浏览的页面。

### `src/executor.js`

```js
function render(tmpl, ctx) {
  if (typeof tmpl !== 'string') return tmpl;
  return tmpl.replace(/\$\{\{(.+?)\}\}/g, (_, expr) =>
    Function(...Object.keys(ctx), `return (${expr.trim()})`)(...Object.values(ctx))
  );
}

export async function executePipeline(pipeline, args, session) {
  let data = null;

  for (const step of pipeline) {
    const [op, params] = Object.entries(step)[0];

    if (op === 'fetch') {
      const url = render(params.url ?? params, { args, data });
      data = await fetch(url).then(r => r.json());

    } else if (op === 'navigate') {
      await session.navigate(render(params, { args, data }));

    } else if (op === 'evaluate') {
      data = await session.evaluate(render(params, { args, data }));

    } else if (op === 'filter') {
      const items = Array.isArray(data) ? data : [data];
      data = items.filter((item, index) =>
        Function('item', 'index', 'args', `return !!(${params})`)(item, index, args)
      );

    } else if (op === 'map') {
      const items = Array.isArray(data) ? data : [data];
      data = items.map((item, index) => {
        const ctx = { item, index, args };
        return Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, render(v, ctx)])
        );
      });

    } else if (op === 'limit') {
      const n = typeof params === 'number' ? params : Number(render(String(params), { args, data }));
      if (Array.isArray(data)) data = data.slice(0, n);

    } else {
      throw new Error(`Unknown step: "${op}"`);
    }
  }

  return data;
}
```

模板语法 `${{ expr }}` 与 OpenCLI 保持一致，上下文变量：`item`（当前元素）、`index`（下标）、`args`（命令参数）、`data`（当前数据）。

### `src/output.js`

```js
export function printOutput(data, format, columns) {
  const rows = Array.isArray(data) ? data : [data];
  if (format === 'json') return console.log(JSON.stringify(rows, null, 2));

  const cols = columns ?? Object.keys(rows[0] ?? {});
  const widths = cols.map(c =>
    Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length))
  );
  console.log(cols.map((c, i) => c.padEnd(widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w + 2)).join('+'));
  for (const row of rows)
    console.log(cols.map((c, i) => String(row[c] ?? '').padEnd(widths[i])).join(' | '));
}
```

### `bin/cli.js`

```js
#!/usr/bin/env node
import { openSession, closeTab } from '../src/cdp.js';
import { executePipeline } from '../src/executor.js';
import { printOutput } from '../src/output.js';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [site, command, ...rest] = process.argv.slice(2);
if (!site || !command) {
  console.error('Usage: mycli <site> <command> [--key value] [--format table|json]');
  process.exit(1);
}

const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const key = rest[i].slice(2);
    const val = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
    args[key] = isNaN(Number(val)) || val === true ? val : Number(val);
  }
}
const format = args.format ?? 'table';
delete args.format;

const adapterPath = resolve(`adapters/${site}/${command}.js`);
if (!existsSync(adapterPath)) { console.error(`Not found: ${adapterPath}`); process.exit(1); }

const { default: adapter } = await import(pathToFileURL(adapterPath).href);

for (const def of adapter.args ?? [])
  if (args[def.name] === undefined) args[def.name] = def.default;

const needsBrowser = adapter.pipeline.some(s => 'navigate' in s || 'evaluate' in s);

let session = null, targetId = null, base = null;
try {
  if (needsBrowser) ({ session, targetId, base } = await openSession());
  const result = await executePipeline(adapter.pipeline, args, session);
  printOutput(result, format, adapter.columns);
} finally {
  session?.close();
  if (targetId) await closeTab(base, targetId);
}
```

---

## 适配器编写指南

适配器是一个 ES module，默认导出配置对象：

```js
export default {
  args: [
    { name: 'limit', default: 20 },   // 命令行参数及默认值
  ],
  columns: ['rank', 'title', 'author', 'play'],  // 表格列顺序
  pipeline: [ /* steps */ ],
}
```

### Pipeline Steps

| Step | 参数 | 说明 |
|------|------|------|
| `fetch` | `{ url }` 或字符串 | HTTP GET，结果赋给 data |
| `navigate` | URL 字符串 | 导航到指定 URL，等待页面加载 |
| `evaluate` | JS 代码字符串 | 在浏览器内执行，结果赋给 data |
| `map` | 字段映射对象 | 对数组每个元素做字段提取/重命名 |
| `filter` | JS 表达式字符串 | 过滤数组元素 |
| `limit` | 数字或模板表达式 | 截取前 N 个元素 |

### 示例：Browser 适配器（需登录态）

```js
// adapters/bilibili/hot.js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: [
    { navigate: 'https://www.bilibili.com' },
    { evaluate: `(async () => {
      const res = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1', {
        credentials: 'include'
      });
      const data = await res.json();
      return (data?.data?.list || []).map(v => ({
        title: v.title,
        author: v.owner?.name,
        play: v.stat?.view,
      }));
    })()` },
    { map: {
      rank:   '${{ index + 1 }}',
      title:  '${{ item.title }}',
      author: '${{ item.author }}',
      play:   '${{ item.play }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

### 示例：Public 适配器（无需浏览器）

```js
// adapters/hackernews/top.js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'score', 'author'],
  pipeline: [
    { fetch: { url: 'https://hacker-news.firebaseio.com/v0/topstories.json' } },
    { limit: '${{ args.limit }}' },
    { map: { id: '${{ item }}' } },
    { fetch: { url: 'https://hacker-news.firebaseio.com/v0/item/${{ item.id }}.json' } },
    { map: {
      rank:   '${{ index + 1 }}',
      title:  '${{ item.title }}',
      score:  '${{ item.score }}',
      author: '${{ item.by }}',
    }},
  ],
};
```

---

## 环境准备

### 启动 Chrome（一次性配置）

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir=$HOME/.chrome-automation-profile \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check
```

在这个 Chrome 窗口里手动登录目标站点（B站、Reddit 等）。Cookie 写入 `~/.chrome-automation-profile`，之后每次以相同参数启动，登录态自动恢复。

建议写成 alias：

```bash
alias chrome-auto='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir=$HOME/.chrome-automation-profile \
  --remote-debugging-port=9222'
```

### 配置 CDP 端点

```bash
# 写入 ~/.zshrc
export OPENCLI_CDP_ENDPOINT=http://localhost:9222
```

### 安装与运行

```bash
npm install
node bin/cli.js bilibili hot --limit 5
node bin/cli.js bilibili hot --format json
node bin/cli.js hackernews top --limit 10
```

---

## 运行时选择

框架代码（bin/cli.js、src/\*）只做两件事：HTTP GET 和 WebSocket。适配器里的 JS 代码在浏览器内执行，CLI 自身不需要解释 JS 语义。因此运行时可以灵活选择：

| 运行时 | 说明 |
|--------|------|
| Node.js | 需要 `npm install`（ws 依赖） |
| Bun | 内置 WebSocket，零依赖，可编译为单文件二进制 |
| Python | 系统预装，替换 cdp.js 即可，依赖 `websockets` |
| Go/Rust | 编译为静态二进制，分发无需任何运行时 |

用 Bun 编译为独立二进制：

```bash
bun build bin/cli.js --compile --outfile mycli
./mycli bilibili hot --limit 5   # 不需要任何运行时
```

---

## 与 OpenCLI 的对比

| | OpenCLI | 本方案 |
|--|---------|--------|
| 浏览器连接 | 扩展 + daemon | CDP 直连（`--remote-debugging-port`） |
| 登录态来源 | 借用用户日常 Chrome | `--user-data-dir` 持久化 profile |
| 依赖 | npm 包 + Chrome 扩展 | 仅 `ws`（或 Bun 零依赖） |
| 适配器格式 | 相同的 pipeline DSL | 相同的 pipeline DSL |
| 确定性 | ✅ | ✅ |
| 零 LLM 成本 | ✅ | ✅ |
| 代码量 | 完整框架 | ~180 行 |
