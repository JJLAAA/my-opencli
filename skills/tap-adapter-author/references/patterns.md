# TAP 适配器 Pattern 参考

六种获取模式，判断后套对应 pipeline 模板。

---

## 如何判断 Pattern

**第一步**：先在浏览器打开目标页面，确认页面可访问 + TAP browser 已登录。

**第二步**：侦察 Network → 过滤 Fetch/XHR + 侦察 DOM：

```
有 JSON 请求？
  ├─ 是 → 可以直接 curl 访问（不需要 cookie）？
  │         ├─ 是 → Pattern A（公开 API）
  │         └─ 否 → 需要登录 cookie？
  │                   ├─ 是 → Pattern B（browserFetch JSON API）
  │                   └─ 签名/token 不可复现 → Pattern D（intercept）
  ├─ 单个命令需要 list → detail 多个请求？ → Pattern C（as/from/foreach）
  └─ 否（无 JSON 请求，或 JSON 返回 403/HTML）→
       ├─ 页面已登录 + 有同源 HTML partial endpoint？ → Pattern F（HTML partial + DOMParser）
       ├─ 数据直接在 HTML DOM 里（custom element attributes / 渲染文本）？ → Pattern E（DOM 提取）
       └─ 以上均不可行 → 考虑 OAuth / token（最后手段，需向用户说明原因）
```

⚠️ **公开 JSON 返回 403 或 HTML ≠ 必须 OAuth**。应先按顺序排查 Pattern F → E，再考虑 token。

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

---

## Pattern F — 登录态 HTML partial / infinite-scroll endpoint

**特征**：公开 JSON API 不可用（403/HTML），但页面已登录，站点有同源 HTML partial endpoint（如 `/svc/`、`/api/partial/`），或 infinite-scroll loader 携带下一页 src；用 DOMParser 解析 HTML 即可提取结构化数据。

**典型迹象**：
- 页面渲染正常，但 `.json` 或 `/api/` 返回 403
- DOM 中有 `faceplate-partial[slot="load-after"][src]` 等分页 loader
- Network 有同源请求返回 `text/html`，HTML 中含 custom element（如 `<shreddit-post>`）或列表结构

```js
export default {
  args: [
    { name: 'limit', default: 25, description: 'Maximum number of items to return.' },
    { name: 'category', default: 'hot', description: 'Feed category, e.g. hot / new / top.' },
  ],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      title:        { type: 'string',  description: 'Item title.' },
      url:          { type: 'string',  description: 'Item permalink URL.', format: 'url' },
      score:        { type: 'integer', description: 'Vote score.', unit: 'points' },
      commentCount: { type: 'integer', description: 'Number of comments.', unit: 'comments' },
      author:       { type: 'string',  description: 'Author username.' },
    },
  },
  columns: ['score', 'commentCount', 'author', 'title', 'url'],
  pipeline: [
    { navigate: 'https://example.com/${{ args.category }}/' },
    { evaluate: `(async () => {
        const limit    = Number('${{ args.limit }}') || 25;
        const category = '${{ args.category }}';
        const results  = [];
        const seen     = new Set();

        // 首页 partial endpoint（根据实际站点路径调整）
        let nextUrl = '/svc/example/community-posts/' + category + '/?name=example';

        for (let page = 0; page < 8 && nextUrl && results.length < limit; page++) {
          const res = await fetch(nextUrl, {
            credentials: 'include',
            headers: { Accept: 'text/html, */*' },
          });

          if (!res.ok) throw new Error('Partial request failed: HTTP ' + res.status);

          const html = await res.text();
          const doc  = new DOMParser().parseFromString(html, 'text/html');

          for (const el of doc.querySelectorAll('item-element-selector')) {
            const id = el.getAttribute('id') || el.getAttribute('permalink');
            if (!id || seen.has(id)) continue;
            seen.add(id);

            results.push({
              title:        el.getAttribute('post-title') || '',
              url:          new URL(el.getAttribute('permalink') || '', location.origin).href,
              score:        Number(el.getAttribute('score'))         || 0,
              commentCount: Number(el.getAttribute('comment-count')) || 0,
              author:       el.getAttribute('author')                || '',
            });

            if (results.length >= limit) break;
          }

          // 跟随分页：找下一页 partial src（根据实际 selector 调整）
          nextUrl = doc.querySelector('[slot="load-after"][src]')?.getAttribute('src') || '';
        }

        return results;
      })()` },
    { map: {
      title:        '${{ item.title }}',
      url:          '${{ item.url }}',
      score:        '${{ item.score }}',
      commentCount: '${{ item.commentCount }}',
      author:       '${{ item.author }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

**注意**：
- `navigate` 必须先执行，建立登录态 cookie 上下文；partial endpoint 的 `credentials: include` 依赖这一步
- `nextUrl` 初始值是首页 partial URL，后续从 DOM 的 load-after 元素提取；按实际站点调整 selector
- 用 `seen` Set 去重，避免跨页 item 重复
- 字段值从 custom element attributes 读取，用 `?.` 做可选链防空
- 分页上限（`page < 8`）防止无限循环；实际可按站点调整
- 优先用 partial endpoint 分页；若无 load-after，再考虑 scroll trigger（Pattern D 的 `scroll`）
- 此 Pattern 的 evaluate 代码较长；确保模板表达式 `${{ }}` 内容在字符串拼接时不含换行歧义
