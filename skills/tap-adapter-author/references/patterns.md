# TAP 适配器 Pattern 参考

五种获取模式，判断后套对应 pipeline 模板。

---

## 如何判断 Pattern

在浏览器打开目标页面 → DevTools → Network → 过滤 Fetch/XHR：

```
有 JSON 请求？
  ├─ 是 → 可以直接 curl 访问（不需要 cookie）？
  │         ├─ 是 → Pattern A（公开 API）
  │         └─ 否 → 需要登录 cookie？
  │                   ├─ 是 → Pattern B（browserFetch）
  │                   └─ 签名/token 不可复现 → Pattern D（intercept）
  ├─ 单个命令需要 list → detail 多个请求？ → Pattern C（as/from/foreach）
  └─ 否 → 数据直接在 HTML 页面里 → Pattern E（DOM 提取）
```

---

## Pattern A — 公开 JSON API

**特征**：直接 curl 可拿到数据，无需认证。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'entry',
    fields: {
      title: { type: 'string', description: 'Entry title.' },
      score: { type: 'number', description: 'Entry score from the source API.' },
      date: { type: 'string', description: 'Entry creation date.', format: 'date' },
    },
  },
  columns: ['title', 'score', 'date'],
  pipeline: [
    { fetch: 'https://api.example.com/list?count=50' },
    { select: 'data.items' },           // 提取嵌套数组，按实际路径调整
    { map: {
      title: '${{ item.title }}',
      score: '${{ item.score }}',
      date:  '${{ item.created_at }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `fetch` URL 支持模板表达式，如 `'https://api.example.com/list?q=${{ args.keyword }}'`
- 如果数据直接在顶层数组，省略 `select` 步骤
- `output.fields` 必须先经用户确认；JSON 输出只保留这里声明的字段

---

## Pattern B — 带登录态的 API（浏览器 fetch）

**特征**：API 需要登录 cookie，但请求本身无复杂签名，在浏览器上下文里 fetch 即可。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      rank: { type: 'integer', description: 'One-based rank in the returned result set.' },
      title: { type: 'string', description: 'Item title.' },
      author: { type: 'string', description: 'Author display name.' },
      viewCount: { type: 'integer', description: 'View count.', unit: 'views' },
    },
  },
  columns: ['rank', 'title', 'author', 'viewCount'],
  pipeline: [
    { navigate: 'https://example.com' },   // 加载页面以获取 cookie
    { browserFetch: { url: 'https://api.example.com/feed?ps=50' } },
    { select: 'data.list' },
    { map: {
      rank:      '${{ index + 1 }}',
      title:     '${{ item.title }}',
      author:    '${{ item.author.name }}',
      viewCount: '${{ item.stat.view }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `navigate` 负责带入 cookie，目标 URL 通常是站点首页或需要登录的任意页
- `browserFetch` 在浏览器沙箱里执行，默认 `credentials: 'include'`
- 如果需要多请求聚合，套用 Pattern C，把 `fetch` 换成 `browserFetch`

---

## Pattern C — 多请求 list-detail

**特征**：先拿列表，再按列表项逐个请求详情，或者需要多个独立请求后合并。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      title: { type: 'string', description: 'Item title.' },
      status: { type: 'string', description: 'Item status from the detail API.' },
    },
  },
  columns: ['title', 'status'],
  pipeline: [
    { fetch: { url: 'https://api.example.com/items?size=50', as: 'list' } },
    { select: { from: 'list', path: 'items', as: 'items' } },
    {
      foreach: {
        from: 'items',
        as: 'details',
        concurrency: 5,
        steps: [
          { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
          { mapOne: {
            title:  '${{ item.title }}',
            status: '${{ data.status }}',
          }},
        ],
      },
    },
    { select: { from: 'details' } },
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- 只记三个概念：`as` 保存结果，`from` 读取命名结果，`foreach` 遍历数组
- `foreach.from` 可以是任意命名状态路径，如 `items`、`list.items`、`projectDetails`
- `foreach.as` 保存收集后的数组，供后续步骤继续组合
- 需要登录态时，先 `navigate`，并把嵌套步骤里的 `fetch` 换成 `browserFetch`

---

## Pattern D — 拦截隐藏的 XHR/fetch 请求

**特征**：API 请求含动态签名/token，无法直接复现，只能在页面行为触发后捕获响应。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'rankingItem',
    fields: {
      rank: { type: 'integer', description: 'One-based rank in the returned result set.' },
      title: { type: 'string', description: 'Ranking item title.' },
      hotScore: { type: 'number', description: 'Hot score from the source ranking API.' },
    },
  },
  columns: ['rank', 'title', 'hotScore'],
  pipeline: [
    { intercept: {
        capture: 'api/ranking',          // 匹配 URL 中包含该字符串的请求
        trigger: 'navigate:https://example.com/ranking',
        timeout: 10,                     // 等待秒数，默认 8
        select:  'data.list',            // 从响应中提取的路径（可选）
      }
    },
    { map: {
      rank:     '${{ index + 1 }}',
      title:    '${{ item.title }}',
      hotScore: '${{ item.hot_score }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**trigger 前缀说明**：

| 前缀 | 效果 |
|------|------|
| `navigate:<url>` | 导航到 URL，等待页面加载完触发请求 |
| `evaluate:<js>` | 执行 JS（如点击按钮触发加载）|
| `click:<selector>` | 点击 CSS 选择器对应元素 |
| `scroll` | 滚动到页面底部（触发懒加载）|

**注意**：
- `capture` 是 URL 子字符串匹配，越精确越好
- 如果一个动作触发多个匹配请求，`intercept` 返回数组；只有一个则直接返回对象
- `select` 在拿到响应后立即提取路径，等价于之后加一个 `select` 步骤

---

## Pattern E — 从页面 DOM 提取

**特征**：数据直接渲染在 HTML 里，无对应 API。

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'link',
    fields: {
      rank: { type: 'integer', description: 'One-based rank in the rendered list.' },
      title: { type: 'string', description: 'Rendered item title.' },
      url: { type: 'string', description: 'Item destination URL.', format: 'url' },
    },
  },
  columns: ['rank', 'title', 'url'],
  pipeline: [
    { navigate: 'https://example.com/list' },
    { evaluate: `
        Array.from(document.querySelectorAll('.list-item')).map((el, i) => ({
          rank:  i + 1,
          title: el.querySelector('.title')?.textContent?.trim(),
          url:   el.querySelector('a')?.href,
        }))
      ` },
    { map: {
      rank:  '${{ item.rank }}',
      title: '${{ item.title }}',
      url:   '${{ item.url }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `evaluate` 结果已经是数组时，`map` 步骤主要用于列名对齐，可以省略
- 如果页面是 SPA 且数据异步加载，navigate 后会等 800ms，通常够用；不够就改用 Pattern B/D
- `?.` 可选链很重要，DOM 元素可能不存在
